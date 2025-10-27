import { useState, useEffect, ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { InviteGate } from "./InviteGate";

const ADMIN_WALLET = "2h49osyS4nJE3RUDYxAPHwocVo8QmAcJXDkdVm8Hs6Dw";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { publicKey, connected } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkAccess();
  }, [publicKey, connected]);

  const checkAccess = async () => {
    setIsLoading(true);

    // If not connected, show invite gate
    if (!connected || !publicKey) {
      setHasAccess(false);
      setIsLoading(false);
      return;
    }

    const walletAddress = publicKey.toString();

    // Admin wallet always has access
    if (walletAddress === ADMIN_WALLET) {
      console.log("[ProtectedRoute] Admin wallet detected, granting access");
      setHasAccess(true);
      setIsLoading(false);
      return;
    }

    try {
      // Check user's access status in profiles table
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("access_status")
        .eq("wallet_address", walletAddress)
        .single();

      if (error) {
        console.error("[ProtectedRoute] Error fetching profile:", error);
        setHasAccess(false);
        setIsLoading(false);
        return;
      }

      // Grant access only if approved
      const approved = profile?.access_status === "approved";
      console.log("[ProtectedRoute] Access check:", { walletAddress, accessStatus: profile?.access_status, approved });
      setHasAccess(approved);
    } catch (error) {
      console.error("[ProtectedRoute] Unexpected error:", error);
      setHasAccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccessGranted = () => {
    console.log("[ProtectedRoute] Access granted, refreshing...");
    setHasAccess(true);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-background to-primary/5">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show invite gate if no access
  if (!hasAccess) {
    return <InviteGate onAccessGranted={handleAccessGranted} />;
  }

  // Render protected content
  return <>{children}</>;
};

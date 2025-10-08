import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { PurchaseGate } from "@/components/play/PurchaseGate";
import { CameraTracker } from "@/components/play/CameraTracker";
import { SessionStats } from "@/components/play/SessionStats";
import { LifetimeStats } from "@/components/play/LifetimeStats";
import { SessionsTable } from "@/components/play/SessionsTable";

const Play = () => {
  const { connected, publicKey } = useWallet();
  const { toast } = useToast();
  const [hasPurchased, setHasPurchased] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionStats, setSessionStats] = useState({
    puffCount: 0,
    points: 0,
    duration: 0,
  });

  // Check if user has purchased vices
  useEffect(() => {
    const checkPurchaseStatus = async () => {
      if (!publicKey) {
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from("vice_purchases")
        .select("id")
        .limit(1)
        .maybeSingle();

      setHasPurchased(!!data);
      setIsLoading(false);
    };

    checkPurchaseStatus();
  }, [publicKey]);

  // Session timer
  useEffect(() => {
    if (!isSessionActive) return;

    const timer = setInterval(() => {
      setSessionStats((prev) => ({
        ...prev,
        duration: prev.duration + 1,
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [isSessionActive]);

  const handleStartSession = async () => {
    if (!publicKey) return;

    try {
      const { data, error } = await supabase
        .from("puff_sessions")
        .insert({
          user_id: publicKey.toString(),
          puff_count: 0,
          points_earned: 0,
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentSessionId(data.id);
      setIsSessionActive(true);
      setSessionStats({ puffCount: 0, points: 0, duration: 0 });

      toast({
        title: "Session Started",
        description: "Start smoking to earn points!",
      });
    } catch (error) {
      console.error("Error starting session:", error);
      toast({
        title: "Error",
        description: "Failed to start session. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEndSession = async () => {
    if (!currentSessionId) return;

    try {
      const { error } = await supabase
        .from("puff_sessions")
        .update({
          ended_at: new Date().toISOString(),
          puff_count: sessionStats.puffCount,
          points_earned: sessionStats.points,
          duration_seconds: sessionStats.duration,
        })
        .eq("id", currentSessionId);

      if (error) throw error;

      setIsSessionActive(false);
      setCurrentSessionId(null);

      toast({
        title: "Session Ended",
        description: `You earned ${sessionStats.points} points from ${sessionStats.puffCount} puffs!`,
      });
    } catch (error) {
      console.error("Error ending session:", error);
      toast({
        title: "Error",
        description: "Failed to end session properly.",
        variant: "destructive",
      });
    }
  };

  const handlePuffDetected = async () => {
    if (!currentSessionId || !isSessionActive) return;

    const newPuffCount = sessionStats.puffCount + 1;
    const newPoints = sessionStats.points + 20; // 20 points per puff

    setSessionStats((prev) => ({
      ...prev,
      puffCount: newPuffCount,
      points: newPoints,
    }));

    // Record puff event
    await supabase.from("puff_events").insert({
      session_id: currentSessionId,
      user_id: publicKey?.toString(),
      confidence_score: 0.95,
    });
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
        <Navbar />
        <main className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[80vh]">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Connect Your Wallet First
          </h1>
          <p className="text-muted-foreground text-center max-w-md">
            Please connect your Solana wallet to continue playing.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
        <Navbar />
        <main className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[80vh]">
          <p className="text-2xl text-muted-foreground">Loading...</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Navbar />
      <main className="container mx-auto px-4 py-24 md:py-32">
        {!hasPurchased ? (
          <PurchaseGate onPurchaseComplete={() => setHasPurchased(true)} />
        ) : (
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Camera Tracker */}
            <CameraTracker
              onPuffDetected={handlePuffDetected}
              isActive={isSessionActive}
              onStartSession={handleStartSession}
              onEndSession={handleEndSession}
            />

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SessionStats
                puffCount={sessionStats.puffCount}
                points={sessionStats.points}
                duration={sessionStats.duration}
              />
              <LifetimeStats />
            </div>

            {/* Sessions Table */}
            <SessionsTable />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Play;

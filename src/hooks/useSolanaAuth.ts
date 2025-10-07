import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { User, Session } from '@supabase/supabase-js';

export const useSolanaAuth = () => {
  const wallet = useWallet();
  const { publicKey, connected, disconnect } = wallet;
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Listen to auth state changes
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_OUT') {
          toast({
            title: "Disconnected",
            description: "You have been signed out.",
          });
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    if (!publicKey || !wallet.connected || !wallet.signIn) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    setIsAuthenticating(true);

    try {
      // Create a wrapper that ensures proper type compatibility
      const walletAdapter = {
        ...wallet,
        signIn: async (input?: any) => {
          const result = await wallet.signIn!(input);
          // Ensure we return an array of SolanaSignInOutput
          return Array.isArray(result) ? result : [result];
        }
      };

      const { data, error } = await supabase.auth.signInWithWeb3({
        chain: 'solana',
        statement: 'I accept the Terms of Service and sign in to Puff Quest with my Solana wallet',
        wallet: walletAdapter as any,
      });

      if (error) throw error;

      if (data.session) {
        const walletAddress = publicKey.toBase58();
        toast({
          title: "Authentication successful",
          description: `Welcome, ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`,
        });
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      
      if (error.message?.includes('User rejected')) {
        toast({
          title: "Signature rejected",
          description: "You rejected the signature request.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Authentication failed",
          description: error.message || "Failed to authenticate with your wallet.",
          variant: "destructive",
        });
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      await disconnect();
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign out failed",
        description: error.message || "Failed to sign out.",
        variant: "destructive",
      });
    }
  };

  return {
    user,
    session,
    isAuthenticating,
    connected,
    publicKey,
    signIn,
    signOut,
  };
};

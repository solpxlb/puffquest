import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import bs58 from 'bs58';
import type { User, Session } from '@supabase/supabase-js';

export const useSolanaAuth = () => {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
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

  // Generate Sign-In with Solana (SIWS) message following EIP-4361 standard
  const generateSIWSMessage = (walletAddress: string): string => {
    const domain = window.location.host;
    const origin = window.location.origin;
    const statement = 'Sign in to Puff Quest with your Solana wallet';
    const issuedAt = new Date().toISOString();
    const nonce = Math.random().toString(36).substring(2, 15);

    return `${domain} wants you to sign in with your Solana account:
${walletAddress}

${statement}

URI: ${origin}
Version: 1
Chain ID: mainnet
Nonce: ${nonce}
Issued At: ${issuedAt}`;
  };

  const signIn = async () => {
    if (!publicKey || !signMessage) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    setIsAuthenticating(true);

    try {
      const walletAddress = publicKey.toBase58();
      
      // Generate SIWS message
      const message = generateSIWSMessage(walletAddress);
      const messageBytes = new TextEncoder().encode(message);

      // Request signature from wallet
      const signature = await signMessage(messageBytes);
      const signatureBase58 = bs58.encode(signature);

      // Authenticate with Supabase using Web3 provider
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'web3',
        token: signatureBase58,
        nonce: walletAddress,
      });

      if (error) throw error;

      if (data.session) {
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

import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { SMOKE_MINT } from "@/lib/SmokeClaimContract";
import { supabase } from "@/integrations/supabase/client";

export const useWalletTokenBalance = () => {
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: ['wallet-token-balance', publicKey?.toBase58()],
    queryFn: async (): Promise<number> => {
      if (!publicKey || !SMOKE_MINT) return 0;

      try {
        // Get RPC URL from backend
        const { data: rpcData } = await supabase.functions.invoke('get-rpc-url');
        const rpcUrl = rpcData?.rpcUrl || "https://api.mainnet-beta.solana.com";
        const connection = new Connection(rpcUrl);

        // Get the user's token account address
        const userTokenAccount = await getAssociatedTokenAddress(
          SMOKE_MINT,
          publicKey
        );

        // Get the token account info
        const accountInfo = await getAccount(connection, userTokenAccount);

        // Return the balance (accountInfo.amount is in the smallest unit, so we need to convert)
        // Assuming $SMOKE has same decimals as SOL (9) - adjust if different
        return Number(accountInfo.amount) / Math.pow(10, 9);
      } catch (error) {
        // If token account doesn't exist, balance is 0
        console.log('Token account not found or error fetching balance:', error);
        return 0;
      }
    },
    enabled: !!publicKey && !!SMOKE_MINT,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
};
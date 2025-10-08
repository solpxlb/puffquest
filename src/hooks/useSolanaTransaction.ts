import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { supabase } from "@/integrations/supabase/client";

export const useSolanaTransaction = () => {
  const { publicKey, signTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);

  const sendSol = async (amountSol: number): Promise<string> => {
    if (!publicKey || !signTransaction) {
      throw new Error("Wallet not connected");
    }

    setIsLoading(true);

    try {
      // Get RPC URL from edge function
      const { data: rpcData, error: rpcError } = await supabase.functions.invoke("get-rpc-url");
      
      if (rpcError || !rpcData?.rpcUrl) {
        throw new Error("Failed to get RPC URL");
      }

      // Get team wallet address from edge function
      const { data: walletData, error: walletError } = await supabase.functions.invoke("get-team-wallet");
      
      if (walletError || !walletData?.teamWallet) {
        throw new Error("Failed to get team wallet address");
      }

      const connection = new Connection(rpcData.rpcUrl, "confirmed");
      const teamWalletAddress = new PublicKey(walletData.teamWallet);

      // Convert SOL to lamports
      const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: teamWalletAddress,
          lamports,
        })
      );

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign transaction
      const signedTransaction = await signTransaction(transaction);

      // Send transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());

      // Confirm transaction
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });

      return signature;
    } catch (error: any) {
      console.error("Transaction error:", error);
      
      if (error.message?.includes("insufficient")) {
        throw new Error("Insufficient SOL balance in your wallet");
      }
      if (error.message?.includes("User rejected")) {
        throw new Error("Transaction was rejected");
      }
      
      throw new Error(error.message || "Transaction failed");
    } finally {
      setIsLoading(false);
    }
  };

  return { sendSol, isLoading };
};

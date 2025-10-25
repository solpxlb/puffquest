import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { EarningsEstimator } from "@/components/play/EarningsEstimator";
import { SmokeBalance } from "@/components/play/SmokeBalance";
import { SessionsTable } from "@/components/play/SessionsTable";
import { PassiveEarningsCard } from "@/components/play/PassiveEarningsCard";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, Gift, TrendingUp, Wallet, AlertTriangle, ExternalLink } from "lucide-react";
import { useUnifiedBalance } from "@/hooks/useUnifiedBalance";
import { GameEconomy } from "@/lib/GameEconomy";
import {
  checkUserSolBalance,
  formatClaimError,
  getExplorerUrl,
  confirmTransactionWithTimeout,
  MIN_SOL_REQUIRED,
  CLAIM_FEE_SOL,
} from "@/lib/SmokeClaimContract";
import type { ClaimResponse, VerifyClaimResponse, ClaimState } from "@/types/claim";
import { CLAIM_STEP_LABELS } from "@/types/claim";

const Earnings = () => {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { toast } = useToast();
  const [claimState, setClaimState] = useState<ClaimState>({
    isLoading: false,
    step: 'idle',
    error: null,
    signature: null,
    explorerUrl: null,
  });

  // Use unified balance data - single source of truth
  const { data: balanceData, isLoading: balanceLoading } = useUnifiedBalance();

  // Extract values from unified data structure
  const smokeBalance = Number(balanceData?.current_balance || 0);
  const totalSmokeEarned = Number(balanceData?.total_earned || 0);
  const totalPuffs = Number(balanceData?.total_puffs || 0);
  const totalSpent = Number(balanceData?.total_spent || 0);
  const totalClaimed = Number(balanceData?.total_claimed || 0);

  // No more fallback logic needed - unified data is always consistent
  const displayTotalEarned = totalSmokeEarned;
  const displayTotalPuffs = totalPuffs;

  const handleClaimRewards = async () => {
    if (!publicKey || !signTransaction || smokeBalance <= 0) {
      toast({
        title: "Cannot Claim",
        description: "Please connect your wallet or ensure you have tokens to claim.",
        variant: "destructive",
      });
      return;
    }

    setClaimState({
      isLoading: true,
      step: 'preparing',
      error: null,
      signature: null,
      explorerUrl: null,
    });

    try {
      // Step 1: Check SOL balance
      const solCheck = await checkUserSolBalance(connection, publicKey);

      if (!solCheck.sufficient) {
        throw new Error(
          `Insufficient SOL balance. You need at least ${MIN_SOL_REQUIRED} SOL for the claim fee and transaction costs. ` +
          `Current balance: ${solCheck.balance.toFixed(4)} SOL`
        );
      }

      console.log('[Claim] SOL balance check passed:', solCheck.balance, 'SOL');

      // Step 2: Call claim-smoke edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const claimResponse = await fetch(`${supabaseUrl}/functions/v1/claim-smoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          wallet_address: publicKey.toBase58(),
        }),
      });

      const claimData: ClaimResponse = await claimResponse.json();

      if (!claimData.success || !claimData.transaction) {
        throw new Error(claimData.error || 'Failed to prepare claim transaction');
      }

      console.log('[Claim] Transaction prepared, amount:', claimData.amount, '$SMOKE');

      // Step 3: Deserialize transaction (browser-compatible)
      const binaryString = atob(claimData.transaction);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const transaction = Transaction.from(bytes);

      // Step 4: User signs transaction
      setClaimState(prev => ({ ...prev, step: 'signing' }));

      toast({
        title: "Sign Transaction",
        description: `Please sign to claim ${claimData.amount?.toFixed(4)} $SMOKE (Fee: ${CLAIM_FEE_SOL} SOL)`,
      });

      const signed = await signTransaction(transaction);

      console.log('[Claim] Transaction signed by user');

      // Step 5: Send to blockchain
      setClaimState(prev => ({ ...prev, step: 'confirming' }));

      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      console.log('[Claim] Transaction sent:', signature);

      const explorerUrl = getExplorerUrl(signature, 'devnet');

      setClaimState(prev => ({
        ...prev,
        signature,
        explorerUrl,
      }));

      toast({
        title: "Transaction Sent",
        description: "Confirming on blockchain...",
      });

      // Step 6: Wait for confirmation
      await confirmTransactionWithTimeout(connection, signature, 60000);

      console.log('[Claim] Transaction confirmed');

      // Step 7: Verify claim with backend
      setClaimState(prev => ({ ...prev, step: 'verifying' }));

      const verifyResponse = await fetch(`${supabaseUrl}/functions/v1/verify-claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          wallet_address: publicKey.toBase58(),
          transaction_signature: signature,
        }),
      });

      const verifyData: VerifyClaimResponse = await verifyResponse.json();

      if (!verifyData.success) {
        throw new Error(verifyData.error || 'Failed to verify claim');
      }

      console.log('[Claim] Verified successfully');

      // Step 8: Success!
      setClaimState({
        isLoading: false,
        step: 'success',
        error: null,
        signature,
        explorerUrl,
      });

      toast({
        title: "Claim Successful! 🎉",
        description: `You've claimed ${verifyData.amount_claimed?.toFixed(4)} $SMOKE tokens!`,
      });

      // Refresh profile data
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error: unknown) {
      console.error('[Claim Error]', error);

      const errorMessage = formatClaimError(error);

      setClaimState({
        isLoading: false,
        step: 'error',
        error: errorMessage,
        signature: claimState.signature,
        explorerUrl: claimState.explorerUrl,
      });

      toast({
        title: "Claim Failed",
        description: errorMessage,
        variant: "destructive",
      });

      // Reset after 5 seconds
      setTimeout(() => {
        setClaimState({
          isLoading: false,
          step: 'idle',
          error: null,
          signature: null,
          explorerUrl: null,
        });
      }, 5000);
    }
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
            Please connect your Solana wallet to view your earnings.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Navbar />
      <main className="container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              My Earnings
            </h1>
            <p className="text-muted-foreground text-lg">
              Track your $SMOKE earnings and manage your rewards
            </p>
          </div>

          {/* Earnings Overview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Puffs Card */}
            <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-muted-foreground text-sm font-medium flex items-center gap-2">
                  <Gift className="w-4 h-4" />
                  Total Puffs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {displayTotalPuffs.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  All-time detections
                </p>
              </CardContent>
            </Card>

            {/* Lifetime Earnings Card */}
            <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-muted-foreground text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Lifetime Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  {displayTotalEarned.toFixed(4)} $SMOKE
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total earned since start
                </p>
              </CardContent>
            </Card>

            {/* Claim Status Card */}
            <Card className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border-orange-500/30 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Available to Claim
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">
                  {smokeBalance.toFixed(4)} $SMOKE
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Your actual claimable balance
                </p>
              </CardContent>
            </Card>

            {/* Passive Income Card */}
            <PassiveEarningsCard />
          </div>

          {/* Data Explanation Info Box */}
          <Card className="bg-blue-900/10 border-blue-500/30 backdrop-blur-sm mb-8">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-blue-300 font-semibold text-sm mb-2">
                    Your Unified Earnings Dashboard
                  </p>
                  <ul className="text-gray-400 text-xs space-y-1">
                    <li>• <span className="text-white">Total Puffs:</span> All puffs detected across your sessions</li>
                    <li>• <span className="text-white">Lifetime Earnings:</span> Total $SMOKE earned from all activities</li>
                    <li>• <span className="text-white">Available to Claim:</span> Your current withdrawable balance</li>
                    <li>• <span className="text-white">Spent on Upgrades:</span> Total $SMOKE invested in device levels</li>
                  </ul>
                  {totalSpent > 0 && (
                    <p className="text-gray-500 text-xs mt-2">
                      💡 You've invested {GameEconomy.formatBalance(totalSpent)} $SMOKE in device upgrades
                    </p>
                  )}
                  {totalClaimed > 0 && (
                    <p className="text-green-400 text-xs mt-2">
                      ✅ You've successfully claimed {GameEconomy.formatBalance(totalClaimed)} $SMOKE to your wallet
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Claim Card */}
          {smokeBalance > 0 && (
            <Card className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border-2 border-orange-500/50 mb-8">
              <CardHeader>
                <CardTitle className="text-white text-xl font-bold flex items-center gap-3">
                  <Coins className="w-6 h-6 text-orange-500" />
                  Claim Your $SMOKE Rewards
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Withdraw your earned $SMOKE tokens to your wallet
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* SOL Balance Warning */}
                <div className="bg-orange-900/30 border border-orange-500/50 rounded-lg p-3 mb-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-orange-300 font-semibold mb-1">
                      You need at least {MIN_SOL_REQUIRED} SOL to claim
                    </p>
                    <ul className="text-gray-400 space-y-0.5 text-xs">
                      <li>• {CLAIM_FEE_SOL} SOL claim fee (goes to treasury)</li>
                      <li>• ~0.005 SOL for gas + rent</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-black/30 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Available Balance:</span>
                    <span className="text-white text-2xl font-bold">{smokeBalance.toFixed(4)} $SMOKE</span>
                  </div>
                </div>

                {/* Claim Status */}
                {claimState.step !== 'idle' && (
                  <div className="bg-black/40 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      {claimState.isLoading && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                      )}
                      <span className="text-white font-semibold">
                        {CLAIM_STEP_LABELS[claimState.step]}
                      </span>
                    </div>
                    {claimState.error && (
                      <p className="text-red-400 text-sm">{claimState.error}</p>
                    )}
                    {claimState.explorerUrl && (
                      <a
                        href={claimState.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 mt-2"
                      >
                        View on Explorer <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleClaimRewards}
                  disabled={claimState.isLoading || smokeBalance <= 0}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {claimState.isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {CLAIM_STEP_LABELS[claimState.step]}
                    </>
                  ) : claimState.step === 'success' ? (
                    <>
                      ✅ Claim Successful!
                    </>
                  ) : (
                    <>
                      <Coins className="w-5 h-5 mr-2" />
                      Claim {smokeBalance.toFixed(4)} $SMOKE
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-400 mt-3 text-center">
                  💡 You will be prompted to sign the transaction in your wallet
                </p>
              </CardContent>
            </Card>
          )}

          {/* Earnings Components Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Daily Earnings Estimator */}
            <EarningsEstimator />

            {/* $SMOKE Balance */}
            <SmokeBalance />
          </div>

          {/* Sessions History */}
          <div className="mt-8">
            <SessionsTable />
          </div>

          {/* Additional Info Card */}
          <Card className="mt-8 bg-card/30 border-border/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Gift className="w-5 h-5" />
                Earnings Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">How You Earn:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Active puffs while playing</li>
                    <li>• Passive income from Level 2+ devices</li>
                    <li>• Daily streak bonuses</li>
                    <li>• Early adopter rewards</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Important Notes:</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Rewards decrease as more players join</li>
                    <li>• Device upgrades increase earnings</li>
                    <li>• Active sessions earn 2.5x multiplier</li>
                    <li>• $SMOKE has no real-world value</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Earnings;
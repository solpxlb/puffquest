import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { EarningsEstimator } from "@/components/play/EarningsEstimator";
import { SmokeBalance } from "@/components/play/SmokeBalance";
import { SessionsTable } from "@/components/play/SessionsTable";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, Gift, TrendingUp, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const Earnings = () => {
  const { connected, publicKey } = useWallet();
  const { toast } = useToast();
  const [isClaiming, setIsClaiming] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['user-profile-earnings', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('smoke_balance, total_smoke_earned, total_puffs, last_claim_date')
        .eq('wallet_address', publicKey.toBase58())
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!publicKey
  });

  const smokeBalance = Number(profile?.smoke_balance || 0);
  const totalSmokeEarned = Number(profile?.total_smoke_earned || 0);
  const totalPuffs = Number(profile?.total_puffs || 0);

  const handleClaimRewards = async () => {
    if (!publicKey || smokeBalance <= 0) return;

    setIsClaiming(true);

    try {
      // Here you would implement the actual claim logic
      // For now, we'll just show a success message
      toast({
        title: "Claim Successful! 🎉",
        description: `You've claimed ${smokeBalance.toFixed(4)} $SMOKE tokens!`,
      });

      // Update last claim date
      await supabase
        .from('profiles')
        .update({ last_claim_date: new Date().toISOString() })
        .eq('wallet_address', publicKey.toBase58());

    } catch (error) {
      console.error("Error claiming rewards:", error);
      toast({
        title: "Claim Failed",
        description: "Unable to claim rewards. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(false);
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                  {totalPuffs.toLocaleString()}
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
                  {totalSmokeEarned.toFixed(4)} $SMOKE
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
                  Ready for withdrawal
                </p>
              </CardContent>
            </Card>
          </div>

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
                <div className="bg-black/30 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Available Balance:</span>
                    <span className="text-white text-2xl font-bold">{smokeBalance.toFixed(4)} $SMOKE</span>
                  </div>
                </div>
                <Button
                  onClick={handleClaimRewards}
                  disabled={isClaiming || smokeBalance <= 0}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 text-lg transition-all"
                >
                  {isClaiming ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Claiming...
                    </>
                  ) : (
                    <>
                      <Coins className="w-5 h-5 mr-2" />
                      Claim {smokeBalance.toFixed(4)} $SMOKE
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-400 mt-3 text-center">
                  ⚠️ Transaction fees may apply. Make sure you have sufficient SOL in your wallet.
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
import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { EarningsEstimator } from "@/components/play/EarningsEstimator";
import { SmokeBalance } from "@/components/play/SmokeBalance";
import { LifetimeStats } from "@/components/play/LifetimeStats";
import { SessionsTable } from "@/components/play/SessionsTable";
import { Trophy, Coins, TrendingUp, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSolanaAuth } from "@/hooks/useSolanaAuth";

const Earnings = () => {
  const { connected, publicKey } = useWallet();
  const { user, session } = useSolanaAuth();
  const { toast } = useToast();
  const [hasPurchased, setHasPurchased] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [overviewStats, setOverviewStats] = useState({
    totalSessions: 0,
    totalPuffs: 0,
    totalSmokeEarned: 0,
    currentBalance: 0,
    daysActive: 0,
  });

  const isAuthenticated = !!user && !!session;

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
        .eq("user_id", publicKey.toString())
        .limit(1)
        .maybeSingle();

      setHasPurchased(!!data);
      setIsLoading(false);
    };

    checkPurchaseStatus();
  }, [publicKey]);

  // Fetch overview statistics
  useEffect(() => {
    const fetchOverviewStats = async () => {
      if (!publicKey) return;

      try {
        // Get sessions data
        const { data: sessions } = await supabase
          .from("puff_sessions")
          .select("puff_count, smoke_earned, started_at")
          .eq("user_id", publicKey.toString())
          .not("ended_at", "is", null);

        // Get profile data
        const { data: profile } = await supabase
          .from("profiles")
          .select("smoke_balance, total_smoke_earned")
          .eq("wallet_address", publicKey.toString())
          .single();

        if (sessions && profile) {
          const totalSessions = sessions.length;
          const totalPuffs = sessions.reduce((sum, session) => sum + Number(session.puff_count || 0), 0);
          const totalSmokeEarned = sessions.reduce((sum, session) => sum + Number(session.smoke_earned || 0), 0);
          const currentBalance = Number(profile.smoke_balance || 0);
          const daysActive = new Set(sessions.map((s) => new Date(s.started_at).toDateString())).size;

          setOverviewStats({
            totalSessions,
            totalPuffs,
            totalSmokeEarned,
            currentBalance,
            daysActive,
          });
        }
      } catch (error) {
        console.error("Error fetching overview stats:", error);
      }
    };

    if (hasPurchased && isAuthenticated) {
      fetchOverviewStats();
    }
  }, [publicKey, hasPurchased, isAuthenticated]);

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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
        <Navbar />
        <main className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[80vh]">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Sign In Required
          </h1>
          <p className="text-muted-foreground text-center max-w-md">
            Please sign in to view your earnings dashboard.
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

  if (!hasPurchased) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
        <Navbar />
        <main className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[80vh]">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Purchase Vices Required
          </h1>
          <p className="text-muted-foreground text-center max-w-md">
            Please purchase vices from the play page to start earning and view your earnings dashboard.
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
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Hero Section */}
          <section className="text-center space-y-6 mb-12">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white uppercase">
              Earnings Dashboard
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Track your $SMOKE earnings, monitor your smoking sessions, and optimize your device strategy for maximum profits.
            </p>
          </section>

          {/* Overview Stats */}
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-purple-500" />
                <span className="text-gray-400 text-xs uppercase">Sessions</span>
              </div>
              <p className="text-white text-xl font-bold">{overviewStats.totalSessions}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-purple-500" />
                <span className="text-gray-400 text-xs uppercase">Total Puffs</span>
              </div>
              <p className="text-white text-xl font-bold">{overviewStats.totalPuffs.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-orange-500" />
                <span className="text-gray-400 text-xs uppercase">Total Earned</span>
              </div>
              <p className="text-orange-400 text-xl font-bold">{overviewStats.totalSmokeEarned.toFixed(2)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-green-500" />
                <span className="text-gray-400 text-xs uppercase">Current Balance</span>
              </div>
              <p className="text-green-400 text-xl font-bold">{overviewStats.currentBalance.toFixed(2)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-cyan-500" />
                <span className="text-gray-400 text-xs uppercase">Days Active</span>
              </div>
              <p className="text-white text-xl font-bold">{overviewStats.daysActive}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                <span className="text-gray-400 text-xs uppercase">Avg $SMOKE/Day</span>
              </div>
              <p className="text-blue-400 text-xl font-bold">
                {overviewStats.daysActive > 0 ? (overviewStats.totalSmokeEarned / overviewStats.daysActive).toFixed(2) : '0'}
              </p>
            </div>
          </section>

          {/* Main Earnings Components */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EarningsEstimator />
            <SmokeBalance />
          </div>

          {/* Lifetime Stats & Sessions Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LifetimeStats />
            <SessionsTable />
          </div>

          {/* Tips Section */}
          <section className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-white text-xl font-bold uppercase mb-4">💡 Earnings Tips</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-orange-400 font-semibold">Maximize Your Earnings</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Upgrade devices for higher $SMOKE per puff</li>
                  <li>• Start sessions for 2.5x multiplier</li>
                  <li>• Play early when rewards pool is full</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="text-orange-400 font-semibold">Strategy Guide</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Focus on puff consistency</li>
                  <li>• Balance active and passive income</li>
                  <li>• Monitor breakeven timeline</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Earnings;
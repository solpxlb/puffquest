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
import { DevicesOwned } from "@/components/play/DevicesOwned";
import type { PuffAnalysis } from "@/lib/MediaPipeSetup";
import { GameEconomy } from "@/lib/GameEconomy";
import { useSmokeEconomy } from "@/hooks/useSmokeEconomy";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

const Play = () => {
  const { connected, publicKey } = useWallet();
  const { toast } = useToast();
  const { globalStats } = useSmokeEconomy();
  const [hasPurchased, setHasPurchased] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionStats, setSessionStats] = useState({
    puffCount: 0,
    smoke: 0,
    duration: 0,
  });

  // Fetch user's device levels for dynamic points calculation
  const { data: deviceLevels } = useQuery({
    queryKey: ['device-levels', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return { vape: 0, cigarette: 0, cigar: 0 };
      
      const { data, error } = await supabase
        .from('profiles')
        .select('device_levels')
        .eq('wallet_address', publicKey.toBase58())
        .single();

      if (error) return { vape: 0, cigarette: 0, cigar: 0 };
      return data?.device_levels as { vape: number; cigarette: number; cigar: number };
    },
    enabled: !!publicKey
  });

  // Calculate dynamic $SMOKE per puff
  const calculateSmokeForPuff = () => {
    if (!globalStats || !deviceLevels) return 20;

    return GameEconomy.calculatePuffSmoke(
      deviceLevels,
      {
        totalPlayers: globalStats.totalPlayers,
        rewardsPoolRemaining: globalStats.rewardsPoolRemaining,
        circulatingSupply: globalStats.circulatingSupply
      },
      isSessionActive
    );
  };

  const smokePerPuff = calculateSmokeForPuff();
  const sessionMultiplier = isSessionActive ? 2.5 : 1.0;

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
          smoke_earned: 0,
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentSessionId(data.id);
      setIsSessionActive(true);
      setSessionStats({ puffCount: 0, smoke: 0, duration: 0 });

      toast({
        title: "Session Started",
        description: "Start smoking to earn $SMOKE!",
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
      // Update session with current stats
      const { error } = await supabase
        .from("puff_sessions")
        .update({
          ended_at: new Date().toISOString(),
          puff_count: sessionStats.puffCount,
          smoke_earned: sessionStats.smoke,
          duration_seconds: sessionStats.duration,
        })
        .eq("id", currentSessionId);

      if (error) throw error;

      toast({
        title: "Session Ended",
        description: `You earned ${sessionStats.smoke.toFixed(2)} $SMOKE from ${sessionStats.puffCount} puffs!`,
      });

      setIsSessionActive(false);
      setCurrentSessionId(null);
    } catch (error) {
      console.error("Error ending session:", error);
      toast({
        title: "Error",
        description: "Failed to end session properly.",
        variant: "destructive",
      });
    }
  };

  const handlePuffDetected = async (puffAnalysis: PuffAnalysis) => {
    if (!currentSessionId || !isSessionActive || !publicKey) return;

    const earnedSmoke = smokePerPuff;

    // Update stats immediately
    setSessionStats((prev) => ({
      ...prev,
      puffCount: prev.puffCount + 1,
      smoke: prev.smoke + earnedSmoke,
    }));

    toast({
      title: "Puff Detected! 🔥",
      description: `${puffAnalysis.confidence.toFixed(0)}% confidence - +${earnedSmoke} $SMOKE`,
    });

    // Try to record event for analytics (non-blocking) and update profile
    try {
      await supabase
        .from("puff_events")
        .insert({
          session_id: currentSessionId,
          user_id: publicKey.toString(),
          confidence_score: puffAnalysis.confidence,
          mouth_height: puffAnalysis.metrics.mouthHeight,
          mouth_width: puffAnalysis.metrics.mouthWidth,
          aspect_ratio: puffAnalysis.metrics.aspectRatio,
          lip_pursing: puffAnalysis.metrics.lipPursing,
          cheek_puff: puffAnalysis.metrics.cheekPuff,
          mouth_pucker: puffAnalysis.metrics.mouthPucker,
          jaw_open: puffAnalysis.metrics.jawOpen,
          max_aspect_ratio: parseFloat(puffAnalysis.details.maxAspectRatio),
          max_pursing: parseFloat(puffAnalysis.details.maxPursing),
          max_cheek_puff: parseFloat(puffAnalysis.details.maxCheekPuff),
          max_mouth_pucker: parseFloat(puffAnalysis.details.maxMouthPucker),
          sequence_score: puffAnalysis.details.sequenceScore,
          detection_reason: puffAnalysis.reason,
          smoke_awarded: earnedSmoke
        });

      // Update user profile with new $SMOKE and puff count
      const { data: profile } = await supabase
        .from('profiles')
        .select('smoke_balance, total_smoke_earned, total_puffs')
        .eq('wallet_address', publicKey.toBase58())
        .single();

      if (profile) {
        await supabase
          .from('profiles')
          .update({
            smoke_balance: Number(profile.smoke_balance || 0) + earnedSmoke,
            total_smoke_earned: Number(profile.total_smoke_earned || 0) + earnedSmoke,
            total_puffs: Number(profile.total_puffs || 0) + 1,
            last_active_date: new Date().toISOString().split('T')[0]
          })
          .eq('wallet_address', publicKey.toBase58());
      }
    } catch (error) {
      console.error("Error recording puff event:", error);
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
                smoke={sessionStats.smoke}
                duration={sessionStats.duration}
                smokePerPuff={smokePerPuff}
                multiplier={sessionMultiplier}
              />
              <LifetimeStats />
            </div>

            {/* Devices Owned */}
            <DevicesOwned />

            {/* Earnings Link */}
            <div className="bg-gradient-to-r from-orange-900/20 to-red-900/20 rounded-lg p-6 border-2 border-orange-500/30">
              <div className="text-center">
                <h3 className="text-white text-xl font-bold mb-3">View Your Earnings</h3>
                <p className="text-gray-300 mb-4">
                  Track your $SMOKE balance, daily earnings, and claim your rewards
                </p>
                <Link
                  to="/earnings"
                  className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-6 rounded-lg transition-all"
                >
                  📊 View Earnings
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Play;

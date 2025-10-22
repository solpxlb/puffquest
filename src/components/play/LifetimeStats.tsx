import { Trophy, Coins, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";

export const LifetimeStats = () => {
  const { publicKey } = useWallet();
  const [stats, setStats] = useState({
    totalPuffs: 0,
    totalSmoke: 0,
    daysActive: 0,
  });

  useEffect(() => {
    const fetchLifetimeStats = async () => {
      if (!publicKey) return;

      try {
        // Primary approach: Aggregate data from all completed sessions
        const { data: sessions, error: sessionsError } = await supabase
          .from("puff_sessions")
          .select("puff_count, smoke_earned, started_at")
          .eq("user_id", publicKey.toString())
          .not("ended_at", "is", null); // Only include completed sessions

        if (!sessionsError && sessions && sessions.length > 0) {
          // Calculate totals from sessions
          const totalPuffs = sessions.reduce((sum, session) => sum + Number(session.puff_count || 0), 0);
          const totalSmoke = sessions.reduce((sum, session) => sum + Number(session.smoke_earned || 0), 0);

          // Calculate unique active days
          const uniqueDays = new Set(
            sessions.map((s) => new Date(s.started_at).toDateString())
          ).size;

          setStats({
            totalPuffs,
            totalSmoke,
            daysActive: uniqueDays,
          });
        } else {
          // Fallback: Try to get data from profiles table
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("total_smoke_earned, total_puffs")
            .eq("wallet_address", publicKey.toString())
            .single();

          if (!profileError && profile) {
            const { data: sessionsForDays } = await supabase
              .from("puff_sessions")
              .select("started_at")
              .eq("user_id", publicKey.toString());

            const uniqueDays = sessionsForDays
              ? new Set(sessionsForDays.map((s) => new Date(s.started_at).toDateString())).size
              : 0;

            setStats({
              totalPuffs: Number(profile.total_puffs || 0),
              totalSmoke: Number(profile.total_smoke_earned || 0),
              daysActive: uniqueDays,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching lifetime stats:", error);
        // Set default values on error
        setStats({
          totalPuffs: 0,
          totalSmoke: 0,
          daysActive: 0,
        });
      }
    };

    fetchLifetimeStats();
  }, [publicKey]);

  return (
    <div className="bg-gray-700 rounded-lg p-6 border-2 border-gray-600 hover:border-gray-500 transition-colors">
      <h3 className="text-white text-xl font-bold uppercase mb-6 border-b-2 border-gray-600 pb-2">
        Lifetime Stats
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-purple-500" />
            <span className="text-gray-300 text-sm uppercase">Total Puffs</span>
          </div>
          <span className="text-white text-3xl font-bold">{stats.totalPuffs.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coins className="w-6 h-6 text-orange-500" />
            <span className="text-gray-300 text-sm uppercase">$SMOKE Earned</span>
          </div>
          <span className="text-orange-400 text-3xl font-bold">{stats.totalSmoke.toFixed(4)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-cyan-500" />
            <span className="text-gray-300 text-sm uppercase">Days Active</span>
          </div>
          <span className="text-white text-3xl font-bold">{stats.daysActive}</span>
        </div>
      </div>
    </div>
  );
};
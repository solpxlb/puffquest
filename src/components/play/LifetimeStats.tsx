import { Trophy, Coins, Calendar, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { useSmokeEconomy } from "@/hooks/useSmokeEconomy";

export const LifetimeStats = () => {
  const { publicKey } = useWallet();
  const { getConversionRate } = useSmokeEconomy();
  const [stats, setStats] = useState({
    totalPuffs: 0,
    totalPoints: 0,
    totalSmoke: 0,
    daysActive: 0,
  });

  useEffect(() => {
    const fetchLifetimeStats = async () => {
      if (!publicKey) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("total_points_earned, total_smoke_earned, total_puffs")
        .eq("wallet_address", publicKey.toString())
        .single();

      if (profile) {
        const { data: sessions } = await supabase
          .from("puff_sessions")
          .select("started_at")
          .eq("user_id", publicKey.toString());

        const uniqueDays = sessions 
          ? new Set(sessions.map((s) => new Date(s.started_at).toDateString())).size 
          : 0;

        setStats({
          totalPuffs: Number(profile.total_puffs || 0),
          totalPoints: Number(profile.total_points_earned || 0),
          totalSmoke: Number(profile.total_smoke_earned || 0),
          daysActive: uniqueDays,
        });
      }
    };

    fetchLifetimeStats();
  }, [publicKey]);

  const conversionRate = getConversionRate();
  const pointsNeededForNextSmoke = conversionRate - (stats.totalPoints % conversionRate);

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
            <TrendingUp className="w-6 h-6 text-green-500" />
            <span className="text-gray-300 text-sm uppercase">Points Balance</span>
          </div>
          <span className="text-white text-3xl font-bold">{stats.totalPoints.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-cyan-500" />
            <span className="text-gray-300 text-sm uppercase">Days Active</span>
          </div>
          <span className="text-white text-3xl font-bold">{stats.daysActive}</span>
        </div>

        <div className="pt-4 border-t border-gray-600">
          <p className="text-gray-400 text-xs">
            {pointsNeededForNextSmoke.toLocaleString()} more points until next $SMOKE
          </p>
        </div>
      </div>
    </div>
  );
};

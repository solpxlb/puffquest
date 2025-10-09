import { Trophy, DollarSign, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@solana/wallet-adapter-react";

export const LifetimeStats = () => {
  const { publicKey } = useWallet();
  const [stats, setStats] = useState({
    totalPuffs: 0,
    totalPoints: 0,
    daysActive: 0,
  });

  useEffect(() => {
    const fetchLifetimeStats = async () => {
      if (!publicKey) return;

      const { data: events } = await supabase
        .from("puff_events")
        .select("points_awarded, detected_at")
        .eq("user_id", publicKey.toString());

      if (events) {
        const totalPuffs = events.length;
        const totalPoints = events.reduce((sum, e) => sum + (e.points_awarded || 20), 0);
        
        // Calculate unique days
        const uniqueDays = new Set(
          events.map((e) => new Date(e.detected_at).toDateString())
        ).size;

        setStats({
          totalPuffs,
          totalPoints,
          daysActive: uniqueDays,
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
            <DollarSign className="w-6 h-6 text-green-500" />
            <span className="text-gray-300 text-sm uppercase">Total Points</span>
          </div>
          <span className="text-white text-3xl font-bold">{stats.totalPoints.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-cyan-500" />
            <span className="text-gray-300 text-sm uppercase">Days Active</span>
          </div>
          <span className="text-white text-2xl font-bold">{stats.daysActive}</span>
        </div>
      </div>
    </div>
  );
};

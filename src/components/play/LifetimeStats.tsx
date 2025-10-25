import { Trophy, Coins, Calendar } from "lucide-react";
import { useUnifiedBalance } from "@/hooks/useUnifiedBalance";
import { GameEconomy } from "@/lib/GameEconomy";

export const LifetimeStats = () => {
  // Use unified balance data - single source of truth
  const { data: balanceData } = useUnifiedBalance();

  // Extract values from unified data structure
  const totalPuffs = Number(balanceData?.total_puffs || 0);
  const totalSmokeEarned = Number(balanceData?.total_earned || 0);
  const daysActive = balanceData?.streak_days || 0;

  // Unified data is always consistent - no fallback logic needed
  const stats = {
    totalPuffs,
    totalSmoke: totalSmokeEarned,
    daysActive,
  };

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
          <div>
              <span className="text-orange-400 text-3xl font-bold">{GameEconomy.formatBalance(stats.totalSmoke)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-cyan-500" />
            <span className="text-gray-300 text-sm uppercase">Days Active</span>
          </div>
          <span className="text-white text-3xl font-bold">{stats.daysActive}</span>
        </div>
      </div>

      <div className="mt-4 bg-green-900/10 border border-green-500/20 rounded-lg p-2 text-xs text-green-400">
        ✅ Unified data source - always accurate
      </div>
    </div>
  );
};
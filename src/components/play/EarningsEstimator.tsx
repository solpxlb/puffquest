import { TrendingUp, AlertTriangle, Users, Flame } from "lucide-react";
import { useSmokeEconomy } from "@/hooks/useSmokeEconomy";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@solana/wallet-adapter-react";
import { GameEconomy } from "@/lib/GameEconomy";

export const EarningsEstimator = () => {
  const { publicKey } = useWallet();
  const { globalStats, getConversionRate } = useSmokeEconomy();

  const { data: profile } = useQuery({
    queryKey: ['user-device-levels', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('device_levels')
        .eq('wallet_address', publicKey.toBase58())
        .single();

      if (error) throw error;
      return data?.device_levels as { vape: number; cigarette: number; cigar: number };
    },
    enabled: !!publicKey
  });

  if (!globalStats || !profile) {
    return null;
  }

  const deviceLevels = profile || { vape: 0, cigarette: 0, cigar: 0 };
  const totalPlayers = globalStats.totalPlayers;
  const conversionRate = getConversionRate();
  
  const estimate = GameEconomy.estimateDailyEarnings(
    deviceLevels,
    {
      totalPlayers: globalStats.totalPlayers,
      rewardsPoolRemaining: globalStats.rewardsPoolRemaining,
      circulatingSupply: globalStats.circulatingSupply,
      currentConversionRate: conversionRate
    }
  );

  const breakeven = GameEconomy.canBreakevenIn3Days(
    deviceLevels,
    {
      totalPlayers: globalStats.totalPlayers,
      rewardsPoolRemaining: globalStats.rewardsPoolRemaining,
      circulatingSupply: globalStats.circulatingSupply,
      currentConversionRate: conversionRate
    }
  );

  // Warning levels
  const isEarlyAdopter = totalPlayers < 50;
  const isLateJoiner = totalPlayers >= 100;
  const canBreakeven = breakeven.canBreakeven;

  return (
    <div className={`rounded-lg p-6 border-2 transition-all ${
      isEarlyAdopter 
        ? 'bg-green-900/20 border-green-500/50' 
        : isLateJoiner 
        ? 'bg-red-900/20 border-red-500/50'
        : 'bg-yellow-900/20 border-yellow-500/50'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TrendingUp className={`w-7 h-7 ${
            isEarlyAdopter ? 'text-green-500' : isLateJoiner ? 'text-red-500' : 'text-yellow-500'
          }`} />
          <h3 className="text-white text-xl font-bold uppercase">Daily Earnings</h3>
        </div>
        <div className="flex items-center gap-2 bg-black/30 rounded-full px-3 py-1">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="text-white text-sm font-bold">{totalPlayers}</span>
          <span className="text-gray-400 text-xs">players</span>
        </div>
      </div>

      {/* Earnings Breakdown */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-black/30 rounded-lg p-4">
          <p className="text-gray-400 text-xs uppercase mb-1">From Puffs</p>
          <p className="text-white text-2xl font-bold">{estimate.pointsFromPuffs.toLocaleString()}</p>
          <p className="text-gray-500 text-xs">pts/day</p>
        </div>
        <div className="bg-black/30 rounded-lg p-4">
          <p className="text-gray-400 text-xs uppercase mb-1">Passive</p>
          <p className="text-white text-2xl font-bold">{estimate.pointsFromPassive.toLocaleString()}</p>
          <p className="text-gray-500 text-xs">pts/day</p>
        </div>
      </div>

      {/* $SMOKE Earnings */}
      <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-300 text-sm uppercase mb-1">Daily $SMOKE</p>
            <p className="text-orange-400 text-3xl font-bold">
              {estimate.smokeEarned.toFixed(4)}
            </p>
          </div>
          <Flame className="w-10 h-10 text-orange-500 animate-pulse" />
        </div>
        <p className="text-gray-400 text-xs mt-2">
          @ {conversionRate.toLocaleString()} pts = 1 $SMOKE
        </p>
      </div>

      {/* Breakeven Status */}
      <div className={`rounded-lg p-3 flex items-start gap-3 ${
        canBreakeven 
          ? 'bg-green-900/20 border border-green-500/30' 
          : 'bg-red-900/20 border border-red-500/30'
      }`}>
        <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
          canBreakeven ? 'text-green-500' : 'text-red-500'
        }`} />
        <div>
          {canBreakeven ? (
            <>
              <p className="text-green-400 font-bold text-sm">
                ✅ Breakeven in {breakeven.daysToBreakeven} days
              </p>
              <p className="text-gray-400 text-xs mt-1">
                You're early enough to profit! Keep puffing.
              </p>
            </>
          ) : (
            <>
              <p className="text-red-400 font-bold text-sm">
                ⚠️ Breakeven in {breakeven.daysToBreakeven} days
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {isLateJoiner 
                  ? "You're late. Deflation is brutal. Don't expect profits."
                  : "Act fast! The pool is depleting rapidly."
                }
              </p>
            </>
          )}
        </div>
      </div>

      {/* FOMO Generator */}
      {isEarlyAdopter && (
        <div className="mt-4 bg-green-900/20 border border-green-500/30 rounded-lg p-3">
          <p className="text-green-400 font-bold text-sm">🔥 EARLY ADOPTER BONUS</p>
          <p className="text-gray-300 text-xs mt-1">
            You're one of the first {totalPlayers} players. Earnings are at peak!
          </p>
        </div>
      )}
    </div>
  );
};

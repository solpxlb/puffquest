import { TrendingUp, AlertTriangle, Users, Flame } from "lucide-react";
import { useSmokeEconomy } from "@/hooks/useSmokeEconomy";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@solana/wallet-adapter-react";
import { GameEconomy } from "@/lib/GameEconomy";

export const EarningsEstimator = () => {
  const { publicKey } = useWallet();
  const { globalStats } = useSmokeEconomy();

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
  
  const estimate = GameEconomy.estimateDailyEarnings(
    deviceLevels,
    {
      totalPlayers: globalStats.totalPlayers,
      rewardsPoolRemaining: globalStats.rewardsPoolRemaining,
      circulatingSupply: globalStats.circulatingSupply
    }
  );

  const breakeven = GameEconomy.canBreakevenIn3Days(
    deviceLevels,
    {
      totalPlayers: globalStats.totalPlayers,
      rewardsPoolRemaining: globalStats.rewardsPoolRemaining,
      circulatingSupply: globalStats.circulatingSupply
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
          <p className="text-white text-2xl font-bold">{estimate.smokeFromPuffs.toLocaleString()}</p>
          <p className="text-gray-500 text-xs">$SMOKE/day</p>
        </div>
        <div className="bg-black/30 rounded-lg p-4">
          <p className="text-gray-400 text-xs uppercase mb-1">Passive</p>
          <p className="text-white text-2xl font-bold">{estimate.smokeFromPassive.toLocaleString()}</p>
          <p className="text-gray-500 text-xs">$SMOKE/day</p>
        </div>
      </div>

      {/* $SMOKE Earnings */}
      <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-300 text-sm uppercase mb-1">Total Daily $SMOKE</p>
            <p className="text-orange-400 text-3xl font-bold">
              {estimate.totalSmoke.toFixed(2)}
            </p>
          </div>
          <Flame className="w-10 h-10 text-orange-500 animate-pulse" />
        </div>
        <p className="text-gray-400 text-xs mt-2">
          Earned directly, no conversion needed!
        </p>
      </div>

      </div>
  );
};
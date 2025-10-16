import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GameEconomy } from "@/lib/GameEconomy";

interface GlobalStats {
  totalPlayers: number;
  totalPointsDistributed: number;
  totalSmokeDistributed: number;
  rewardsPoolRemaining: number;
  circulatingSupply: number;
  teamAllocation: number;
  currentConversionRate: number;
  lastUpdated: string;
}

export const useSmokeEconomy = () => {
  const { data: globalStats, isLoading, error, refetch } = useQuery({
    queryKey: ['global-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_stats')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) throw error;

      return {
        totalPlayers: Number(data.total_players) || 0,
        totalPointsDistributed: Number(data.total_points_distributed) || 0,
        totalSmokeDistributed: Number(data.total_smoke_distributed) || 0,
        rewardsPoolRemaining: Number(data.rewards_pool_remaining) || 45000000,
        circulatingSupply: Number(data.circulating_supply) || 40000000,
        teamAllocation: Number(data.team_allocation) || 5000000,
        currentConversionRate: Number(data.current_conversion_rate) || 10000,
        lastUpdated: data.last_updated
      } as GlobalStats;
    },
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000 // Consider data stale after 30 seconds
  });

  const getConversionRate = () => {
    if (!globalStats) return 10000;
    
    return GameEconomy.getPointsToSmokeRate({
      totalPlayers: globalStats.totalPlayers,
      rewardsPoolRemaining: globalStats.rewardsPoolRemaining,
      circulatingSupply: globalStats.circulatingSupply,
      currentConversionRate: globalStats.currentConversionRate
    });
  };

  const convertPointsToSmoke = (points: number) => {
    const rate = getConversionRate();
    return points / rate;
  };

  const convertSmokeToPoints = (smoke: number) => {
    const rate = getConversionRate();
    return smoke * rate;
  };

  return {
    globalStats,
    isLoading,
    error,
    refetch,
    getConversionRate,
    convertPointsToSmoke,
    convertSmokeToPoints
  };
};

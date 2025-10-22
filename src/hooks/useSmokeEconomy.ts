import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface GlobalStats {
  totalPlayers: number;
  totalSmokeDistributed: number;
  rewardsPoolRemaining: number;
  circulatingSupply: number;
  teamAllocation: number;
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
        totalSmokeDistributed: Number(data.total_smoke_distributed) || 0,
        rewardsPoolRemaining: Number(data.rewards_pool_remaining) || 45000000,
        circulatingSupply: Number(data.circulating_supply) || 40000000,
        teamAllocation: Number(data.team_allocation) || 5000000,
        lastUpdated: data.last_updated
      } as GlobalStats;
    },
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000 // Consider data stale after 30 seconds
  });

  return {
    globalStats,
    isLoading,
    error,
    refetch
  };
};
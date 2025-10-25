import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UnifiedBalance {
  user_id: string;
  current_balance: number;
  total_earned: number;
  total_spent: number;
  total_claimed: number;
  total_puffs: number;
  device_levels: { vape: number; cigarette: number; cigar: number };
  last_passive_claim: string | null;
  passive_accumulated: number;
  streak_days: number;
  last_active_date: string | null;
  first_seen_at: string;
  updated_at: string;
  created_at: string;
}

export const useUnifiedBalance = () => {
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: ['unified-balance', publicKey?.toBase58()],
    queryFn: async (): Promise<UnifiedBalance | null> => {
      if (!publicKey) return null;

      const { data, error } = await supabase
        .from('user_smoke_balance')
        .select('*')
        .eq('user_id', publicKey.toBase58())
        .single();

      if (error) {
        // If no record exists, create one with defaults
        if (error.code === 'PGRST116') {
          const { data: newData, error: insertError } = await supabase
            .from('user_smoke_balance')
            .insert({
              user_id: publicKey.toBase58(),
              current_balance: 0,
              total_earned: 0,
              total_spent: 0,
              total_claimed: 0,
              total_puffs: 0,
              device_levels: { vape: 0, cigarette: 0, cigar: 0 },
              streak_days: 0,
            })
            .select('*')
            .single();

          if (insertError) throw insertError;
          return newData;
        }
        throw error;
      }

      return data;
    },
    enabled: !!publicKey,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
};

export const useGlobalStats = () => {
  return useQuery({
    queryKey: ['global-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_stats')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) throw error;
      return data;
    },
    refetchInterval: 300000, // Refetch every 5 minutes
    staleTime: 60000, // Consider data stale after 1 minute
  });
};
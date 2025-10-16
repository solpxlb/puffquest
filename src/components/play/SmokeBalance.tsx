import { Coins, TrendingDown, ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSmokeEconomy } from "@/hooks/useSmokeEconomy";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const SmokeBalance = () => {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const { getConversionRate, convertPointsToSmoke } = useSmokeEconomy();
  const [isConverting, setIsConverting] = useState(false);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['user-profile', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('smoke_balance, total_points_earned')
        .eq('wallet_address', publicKey.toBase58())
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!publicKey
  });

  const smokeBalance = Number(profile?.smoke_balance || 0);
  const pointsBalance = Number(profile?.total_points_earned || 0);
  const conversionRate = getConversionRate();
  const potentialSmoke = convertPointsToSmoke(pointsBalance);

  const handleConvertAll = async () => {
    if (pointsBalance < conversionRate) {
      toast({
        title: "Insufficient Points",
        description: `You need at least ${conversionRate.toLocaleString()} points to convert to $SMOKE`,
        variant: "destructive"
      });
      return;
    }

    setIsConverting(true);
    try {
      const { data, error } = await supabase.functions.invoke('convert-points-to-smoke', {
        body: { pointsToConvert: pointsBalance }
      });

      if (error) throw error;

      toast({
        title: "Conversion Successful! 🎉",
        description: `Converted ${pointsBalance.toLocaleString()} points to ${data.smokeEarned.toFixed(4)} $SMOKE`
      });

      // Refetch profile
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    } catch (error: any) {
      toast({
        title: "Conversion Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-orange-900/20 to-red-900/20 rounded-lg p-6 border-2 border-orange-500/30 hover:border-orange-500/50 transition-colors">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Coins className="w-8 h-8 text-orange-500" />
          <h3 className="text-white text-xl font-bold uppercase">$SMOKE Balance</h3>
        </div>
      </div>

      {/* Current Balance */}
      <div className="mb-6">
        <p className="text-gray-400 text-sm uppercase mb-2">Available</p>
        <p className="text-white text-4xl font-bold">{smokeBalance.toFixed(4)} <span className="text-orange-500">$SMOKE</span></p>
      </div>

      {/* Conversion Calculator */}
      <div className="bg-black/30 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-gray-400 text-xs uppercase mb-1">Your Points</p>
            <p className="text-white text-2xl font-bold">{pointsBalance.toLocaleString()}</p>
          </div>
          <ArrowRightLeft className="w-5 h-5 text-gray-500" />
          <div className="text-right">
            <p className="text-gray-400 text-xs uppercase mb-1">Converts To</p>
            <p className="text-orange-500 text-2xl font-bold">{potentialSmoke.toFixed(4)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-gray-400 text-xs">
          <TrendingDown className="w-4 h-4" />
          <span>Rate: {conversionRate.toLocaleString()} pts = 1 $SMOKE</span>
        </div>
      </div>

      {/* Convert Button */}
      <Button
        onClick={handleConvertAll}
        disabled={pointsBalance < conversionRate || isConverting}
        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold uppercase"
      >
        {isConverting ? 'Converting...' : 'Convert All Points'}
      </Button>

      {pointsBalance < conversionRate && (
        <p className="text-red-400 text-xs text-center mt-2">
          Need {(conversionRate - pointsBalance).toLocaleString()} more points to convert
        </p>
      )}
    </div>
  );
};

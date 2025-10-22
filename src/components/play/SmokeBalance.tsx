import { Coins, TrendingUp } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const SmokeBalance = () => {
  const { publicKey } = useWallet();

  const { data: profile } = useQuery({
    queryKey: ['user-profile', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('smoke_balance, total_smoke_earned')
        .eq('wallet_address', publicKey.toBase58())
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!publicKey
  });

  const smokeBalance = Number(profile?.smoke_balance || 0);
  const totalSmokeEarned = Number(profile?.total_smoke_earned || 0);

  return (
    <div className="space-y-6">
      {/* $SMOKE Balance Card */}
      <div className="bg-gradient-to-br from-orange-900/20 to-red-900/20 rounded-lg p-6 border-2 border-orange-500/30 hover:border-orange-500/50 transition-colors">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Coins className="w-8 h-8 text-orange-500" />
            <h3 className="text-white text-xl font-bold uppercase">$SMOKE Balance</h3>
          </div>
        </div>

        {/* Current Balance */}
        <div className="mb-6">
          <p className="text-gray-400 text-sm uppercase mb-2">Current Balance</p>
          <p className="text-white text-4xl font-bold">{smokeBalance.toFixed(4)} <span className="text-orange-500">$SMOKE</span></p>
        </div>

        {/* Lifetime Earnings */}
        <div className="bg-black/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <p className="text-gray-400 text-sm uppercase">Lifetime Earned</p>
            </div>
            <p className="text-green-400 text-2xl font-bold">{totalSmokeEarned.toFixed(4)}</p>
          </div>
        </div>
        </div>

      {/* Spend $SMOKE Section */}
      {smokeBalance > 0 && (
        <div className="bg-card rounded-lg p-6 border-2 border-border">
          <h3 className="text-foreground text-lg font-bold uppercase mb-4">
            💰 Spend Your $SMOKE
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            Upgrade your devices below to earn more $SMOKE per puff and generate passive income!
          </p>
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-xs text-muted-foreground">
            ℹ️ First upgrade is always FREE! Check the "My Devices" section below to upgrade.
          </div>
        </div>
      )}
    </div>
  );
};
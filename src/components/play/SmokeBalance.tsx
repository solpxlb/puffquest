import { Coins, TrendingUp, Wallet } from "lucide-react";
import { useUnifiedBalance } from "@/hooks/useUnifiedBalance";
import { useWalletTokenBalance } from "@/hooks/useWalletTokenBalance";
import { GameEconomy } from "@/lib/GameEconomy";

export const SmokeBalance = () => {
  // Use wallet token balance for current balance and unified data for lifetime stats
  const { data: walletSmokeBalance } = useWalletTokenBalance();
  const { data: balanceData, isLoading } = useUnifiedBalance();

  const smokeBalance = walletSmokeBalance || 0;
  const totalSmokeEarned = Number(balanceData?.total_earned || 0);
  const totalSpent = Number(balanceData?.total_spent || 0);
  const totalClaimed = Number(balanceData?.total_claimed || 0);

  // Unified data is always consistent - no fallback logic needed
  const displayTotalEarned = totalSmokeEarned;

  return (
    <div className="space-y-6">
      {/* $SMOKE Balance Card */}
      <div className="bg-gradient-to-br from-orange-900/20 to-red-900/20 rounded-lg p-6 border-2 border-orange-500/30 hover:border-orange-500/50 transition-colors">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Wallet className="w-8 h-8 text-orange-500" />
            <h3 className="text-white text-xl font-bold uppercase">Wallet $SMOKE</h3>
          </div>
        </div>

        {/* Current Balance */}
        <div className="mb-6">
          <p className="text-gray-400 text-sm uppercase mb-2">Current Balance</p>
          <p className="text-white text-4xl font-bold">{GameEconomy.formatBalance(smokeBalance)} <span className="text-orange-500">$SMOKE</span></p>
        </div>

        {/* Lifetime Earnings */}
        <div className="bg-black/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <p className="text-gray-400 text-sm uppercase">Lifetime Earned</p>
            </div>
            <p className="text-green-400 text-2xl font-bold">{GameEconomy.formatBalance(displayTotalEarned)}</p>
          </div>
        </div>

        {/* Spending Breakdown */}
        {(totalSpent > 0 || totalClaimed > 0) && (
          <div className="bg-black/30 rounded-lg p-4 mt-4">
            <p className="text-gray-400 text-xs uppercase mb-3">Balance Breakdown</p>
            <div className="space-y-2">
              {totalSpent > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-orange-400 text-xs">Spent on Upgrades</span>
                  <span className="text-orange-400 font-bold">-{GameEconomy.formatBalance(totalSpent)}</span>
                </div>
              )}
              {totalClaimed > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-blue-400 text-xs">Claimed to Wallet</span>
                  <span className="text-blue-400 font-bold">-{GameEconomy.formatBalance(totalClaimed)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 bg-primary/10 border border-primary/30 rounded-lg p-3 text-xs text-muted-foreground">
          ℹ️ Wallet balance - tokens are transferred to contract for upgrades
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
import { useState, useEffect } from "react";
import { Clock, Zap, Info } from "lucide-react";
import { useUnifiedBalance, useGlobalStats } from "@/hooks/useUnifiedBalance";
import { GameEconomy } from "@/lib/GameEconomy";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const PassiveEarningsCard = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute for real-time display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Use unified data sources - single queries, no redundancy
  const { data: balanceData } = useUnifiedBalance();
  const { data: globalStats } = useGlobalStats();

  if (!balanceData || !globalStats) {
    return null;
  }

  const deviceLevels = balanceData.device_levels as { vape: number; cigarette: number; cigar: number };
  const lastPassiveClaim = balanceData.last_passive_claim;

  // Check if user has any Level 2+ devices
  const hasPassiveDevices = deviceLevels.vape >= 2 || deviceLevels.cigarette >= 2 || deviceLevels.cigar >= 2;

  if (!hasPassiveDevices) {
    return (
      <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-muted-foreground text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Passive Income
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm mb-2">No passive income yet</p>
            <p className="text-xs text-muted-foreground">
              Upgrade devices to Level 2+ to earn passive $SMOKE
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate hourly passive rate using simplified method
  const stats = {
    totalPlayers: globalStats.total_players || 1,
    rewardsPoolRemaining: globalStats.rewards_pool_remaining || 45000000,
    circulatingSupply: globalStats.circulating_supply || 0,
  };

  // Use the new simplified method from GameEconomy
  const passiveIncome = GameEconomy.calculatePassiveIncomeDisplay(
    deviceLevels,
    stats,
    (currentTime.getTime() - (lastPassiveClaim ? new Date(lastPassiveClaim).getTime() : currentTime.getTime())) / (1000 * 60 * 60)
  );

  const { hourlyRate, accumulatedAmount, cappedHours, isNearCap } = passiveIncome;

  // Calculate next auto-update (cron runs at minute 0 of every hour)
  const minutesUntilNextHour = 60 - currentTime.getMinutes();

  return (
    <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-2 border-purple-500/30 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-500" />
          Passive Income
        </CardTitle>
        <CardDescription className="text-gray-400 text-xs">
          Auto-updates every hour
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hourly Rate */}
        <div className="bg-black/30 rounded-lg p-3">
          <p className="text-gray-400 text-xs uppercase mb-1">Earning Rate</p>
          <p className="text-purple-400 text-xl font-bold">
            {hourlyRate.toFixed(2)} $SMOKE/hr
          </p>
        </div>

        {/* Accumulated */}
        <div className="bg-black/30 rounded-lg p-3">
          <p className="text-gray-400 text-xs uppercase mb-1">Accumulated ({cappedHours.toFixed(1)}h)</p>
          <p className="text-green-400 text-xl font-bold">
            ~{GameEconomy.formatBalance(accumulatedAmount)} $SMOKE
          </p>
          {isNearCap && (
            <p className="text-yellow-400 text-xs mt-1">
              ⚠️ Approaching 24h cap
            </p>
          )}
        </div>

        {/* Next Update */}
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-black/20 rounded-lg p-2">
          <Clock className="w-3 h-3" />
          <span>Next auto-update in {minutesUntilNextHour}m</span>
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 text-xs text-gray-500 bg-blue-900/10 border border-blue-500/20 rounded-lg p-2">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>
            Passive income is automatically added to your balance every hour. Maximum 24 hours can accumulate.
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

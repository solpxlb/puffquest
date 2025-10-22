import { GameEconomy } from "@/lib/GameEconomy";
import { useSmokeEconomy } from "@/hooks/useSmokeEconomy";
import { TrendingUp, Zap, DollarSign } from "lucide-react";

interface DeviceStatsTableProps {
  deviceType: "vape" | "cigarette" | "cigar";
  currentLevel: number;
}

export const DeviceStatsTable = ({ deviceType, currentLevel }: DeviceStatsTableProps) => {
  const { globalStats } = useSmokeEconomy();

  const getStatsForLevel = (level: number) => {
    const deviceLevels = { vape: 0, cigarette: 0, cigar: 0, [deviceType]: level };
    
    const defaultStats = {
      totalPlayers: 1,
      rewardsPoolRemaining: 45000000,
      circulatingSupply: 40000000,
    };

    const smokePerPuff = GameEconomy.calculatePuffSmoke(
      deviceLevels,
      globalStats || defaultStats,
      true
    );

    const passivePerHour = level === 0 ? 0 : GameEconomy.calculatePassiveIncome(
      deviceLevels,
      globalStats || defaultStats,
      1
    );

    const upgradeCost = GameEconomy.getUpgradeCost(level);

    return {
      smokePerPuff: Math.round(smokePerPuff),
      passivePerHour: Math.round(passivePerHour),
      upgradeCost,
    };
  };

  const levels = Array.from({ length: 11 }, (_, i) => i);

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h3 className="text-foreground text-xl font-bold uppercase mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5" />
        {deviceType.toUpperCase()} UPGRADE PATH
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-muted-foreground uppercase py-3 px-2">Level</th>
              <th className="text-right text-muted-foreground uppercase py-3 px-2">
                <div className="flex items-center justify-end gap-1">
                  <Zap className="w-4 h-4" />
                  $SMOKE/Puff
                </div>
              </th>
              <th className="text-right text-muted-foreground uppercase py-3 px-2">
                <div className="flex items-center justify-end gap-1">
                  <TrendingUp className="w-4 h-4" />
                  $SMOKE/Hr
                </div>
              </th>
              <th className="text-right text-muted-foreground uppercase py-3 px-2">
                <div className="flex items-center justify-end gap-1">
                  <DollarSign className="w-4 h-4" />
                  Upgrade Cost
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {levels.map((level) => {
              const stats = getStatsForLevel(level);
              const isCurrentLevel = level === currentLevel;

              return (
                <tr
                  key={level}
                  className={`border-b border-border/50 ${
                    isCurrentLevel ? "bg-primary/10 font-bold" : ""
                  }`}
                >
                  <td className="py-3 px-2 text-foreground">
                    {level === 0 ? "Not Owned" : `Level ${level}`}
                    {isCurrentLevel && (
                      <span className="ml-2 text-primary text-xs">← YOU ARE HERE</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right text-foreground">
                    {level === 0 ? "-" : stats.smokePerPuff}
                  </td>
                  <td className="py-3 px-2 text-right text-foreground">
                    {level === 0 ? "-" : stats.passivePerHour}
                  </td>
                  <td className="py-3 px-2 text-right">
                    {level === 0 ? (
                      <span className="text-muted-foreground">0.2 SOL</span>
                    ) : level === 1 ? (
                      <span className="text-green-500">FREE</span>
                    ) : level === 10 ? (
                      <span className="text-muted-foreground">MAX</span>
                    ) : (
                      <span className="text-orange-500">{stats.upgradeCost} $SMOKE</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-4 bg-muted/20 rounded-lg">
        <p className="text-xs text-muted-foreground">
          💡 <strong>Pro Tip:</strong> Higher levels earn more $SMOKE per puff AND generate passive
          $SMOKE while you're offline. The first upgrade is always free!
        </p>
      </div>
    </div>
  );
};
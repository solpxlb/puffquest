/**
 * PHASE 1B: GAME ECONOMY CORE
 * 
 * Brutal deflationary tokenomics:
 * - First 50-100 users: God mode earnings, can make good profits
 * - Users 100+: Brutal deflation, breakeven at best in 3 days
 * - Points → $SMOKE conversion gets worse over time
 * - Device upgrades require $SMOKE (exponential costs)
 * - Passive income for Level 2+ devices (deflationary)
 */

interface GlobalStats {
  totalPlayers: number;
  rewardsPoolRemaining: number;
  circulatingSupply: number;
}

interface DeviceLevels {
  vape: number;
  cigarette: number;
  cigar: number;
}

export class GameEconomy {
  // Constants
  private static readonly INITIAL_POOL = 45_000_000;

  /**
   * Calculate dynamic $SMOKE per puff (DIRECT REWARDS)
   * Factors:
   * - Device levels (higher = more $SMOKE)
   * - Total players (more players = deflation)
   * - Pool remaining (lower pool = deflation)
   * - Active session multiplier (2.5x when camera is on)
   */
  static calculatePuffSmoke(
    deviceLevels: DeviceLevels,
    stats: GlobalStats,
    isActiveSession: boolean = false
  ): number {
    // Base $SMOKE from device levels
    const vapeSmoke = deviceLevels.vape * 5;
    const cigaretteSmoke = deviceLevels.cigarette * 8;
    const cigarSmoke = deviceLevels.cigar * 12;
    const baseSmoke = 20 + vapeSmoke + cigaretteSmoke + cigarSmoke;
    
    // Deflation factor (reduces points as game progresses)
    const { totalPlayers, rewardsPoolRemaining } = stats;
    let deflationFactor = 1.0;
    
    if (totalPlayers < 50) {
      deflationFactor = 1.2; // Early adopter bonus
    } else if (totalPlayers < 100) {
      deflationFactor = 1.0; // Normal rate
    } else {
      // Brutal deflation
      const poolDepletionFactor = 1 - (rewardsPoolRemaining / this.INITIAL_POOL);
      deflationFactor = Math.max(0.1, 1 - (poolDepletionFactor * 0.8) - ((totalPlayers - 100) * 0.001));
    }
    
    // Active session multiplier
    const sessionMultiplier = isActiveSession ? 2.5 : 1.0;
    
    // Daily streak multiplier
    const streakMultiplier = this.getStreakMultiplier(1); // Default to 1 day
    
    const finalSmoke = Math.floor(baseSmoke * deflationFactor * sessionMultiplier * streakMultiplier);
    return Math.max(1, finalSmoke); // Minimum 1 $SMOKE
  }

  /**
   * Calculate passive $SMOKE for Level 2+ devices (DIRECT REWARDS)
   * - Only devices at Level 2 or higher earn passive $SMOKE
   * - Hourly rate based on device level and type
   * - Maximum 24 hours can accumulate (must claim daily)
   * - Subject to deflation
   */
  static calculatePassiveIncome(
    deviceLevels: DeviceLevels,
    stats: GlobalStats,
    hoursSinceLastClaim: number
  ): number {
    // Cap at 24 hours
    const effectiveHours = Math.min(hoursSinceLastClaim, 24);
    
    // Calculate hourly passive $SMOKE rate
    let hourlySmoke = 0;
    
    // Vape: 10 $SMOKE/hr per level (starting at Level 2)
    if (deviceLevels.vape >= 2) {
      hourlySmoke += (deviceLevels.vape - 1) * 10;
    }
    
    // Cigarette: 15 $SMOKE/hr per level (starting at Level 2)
    if (deviceLevels.cigarette >= 2) {
      hourlySmoke += (deviceLevels.cigarette - 1) * 15;
    }
    
    // Cigar: 25 $SMOKE/hr per level (starting at Level 2)
    if (deviceLevels.cigar >= 2) {
      hourlySmoke += (deviceLevels.cigar - 1) * 25;
    }
    
    // Apply deflation
    const { totalPlayers } = stats;
    let deflationFactor = 1.0;
    
    if (totalPlayers >= 100) {
      deflationFactor = Math.max(0.2, 1 - ((totalPlayers - 100) * 0.002));
    }
    
    const totalSmoke = Math.floor(hourlySmoke * effectiveHours * deflationFactor);
    return totalSmoke;
  }

  /**
   * Get device upgrade cost in $SMOKE
   * - Level 1 → 2: FREE (first purchase with SOL)
   * - Level 2 → 3: 1 $SMOKE
   * - Level 3 → 4: 3 $SMOKE
   * - Level 4 → 5: 10 $SMOKE
   * - Level 5+: Exponential growth
   */
  static getUpgradeCost(currentLevel: number): number {
    if (currentLevel === 0) {
      return 0; // First purchase is SOL, not $SMOKE
    }
    
    if (currentLevel === 1) {
      return 0; // Level 1→2 is included in initial SOL purchase
    }
    
    // Exponential costs for Level 2+
    const baseCost = 1;
    const exponent = currentLevel - 1;
    return Math.floor(baseCost * Math.pow(3, exponent));
  }

  /**
   * Calculate streak multiplier for daily login
   * - 1-2 days: 1.0x (no bonus)
   * - 3-6 days: 1.1x
   * - 7-13 days: 1.25x
   * - 14-29 days: 1.5x
   * - 30+ days: 2.0x
   */
  static getStreakMultiplier(streakDays: number): number {
    if (streakDays < 3) return 1.0;
    if (streakDays < 7) return 1.1;
    if (streakDays < 14) return 1.25;
    if (streakDays < 30) return 1.5;
    return 2.0;
  }

  /**
   * Estimate daily $SMOKE earnings for a user (DIRECT REWARDS)
   * Assumes:
   * - 30 puffs/day
   * - 50% active session time
   * - Passive income for 24 hours
   */
  static estimateDailyEarnings(
    deviceLevels: DeviceLevels,
    stats: GlobalStats,
    streakDays: number = 1
  ): {
    smokeFromPuffs: number;
    smokeFromPassive: number;
    totalSmoke: number;
  } {
    const avgPuffsPerDay = 30;
    const activeSessionRatio = 0.5;
    
    // $SMOKE from active puffing
    const activePuffs = Math.floor(avgPuffsPerDay * activeSessionRatio);
    const passivePuffs = avgPuffsPerDay - activePuffs;
    
    const activeSmoke = activePuffs * this.calculatePuffSmoke(deviceLevels, stats, true);
    const passiveSmoke = passivePuffs * this.calculatePuffSmoke(deviceLevels, stats, false);
    const puffSmoke = activeSmoke + passiveSmoke;
    
    // $SMOKE from passive income (24 hours)
    const passiveIncome = this.calculatePassiveIncome(deviceLevels, stats, 24);
    
    const totalSmoke = puffSmoke + passiveIncome;
    
    return {
      smokeFromPuffs: puffSmoke,
      smokeFromPassive: passiveIncome,
      totalSmoke
    };
  }

  /**
   * Check if user can breakeven in 3 days
   * SOL purchase cost: 0.05 SOL (~$10)
   * Need to earn back at least 0.05 SOL worth of $SMOKE
   */
  static canBreakevenIn3Days(
    deviceLevels: DeviceLevels,
    stats: GlobalStats,
    smokeToSolRate: number = 0.01 // Assume 1 $SMOKE = 0.01 SOL
  ): {
    canBreakeven: boolean;
    daysToBreakeven: number;
    dailyEarnings: number;
  } {
    const solCost = 0.05;
    const smokeNeeded = solCost / smokeToSolRate; // $SMOKE needed to breakeven
    
    const daily = this.estimateDailyEarnings(deviceLevels, stats);
    const daysToBreakeven = smokeNeeded / daily.totalSmoke;
    
    return {
      canBreakeven: daysToBreakeven <= 3,
      daysToBreakeven: Math.ceil(daysToBreakeven),
      dailyEarnings: daily.totalSmoke
    };
  }
}

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useSolanaTransaction } from "@/hooks/useSolanaTransaction";
import { GameEconomy } from "@/lib/GameEconomy";
import { useSmokeEconomy } from "@/hooks/useSmokeEconomy";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWalletTokenBalance } from "@/hooks/useWalletTokenBalance";
import { transferSmokeToTreasury, checkUserSmokeBalance, checkTransactionStatus } from "@/lib/SmokeClaimContract";
import { Connection } from "@solana/web3.js";
import { DeviceStatsTable } from "./DeviceStatsTable";
import { Zap, TrendingUp, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type DeviceType = "vape" | "cigarette" | "cigar";

interface DeviceLevels {
  vape: number;
  cigarette: number;
  cigar: number;
}

const DEVICE_CONFIG = {
  vape: {
    name: "VAPE",
    image: "https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/Vape.png",
  },
  cigarette: {
    name: "CIGARETTE",
    image: "https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/Cig.png",
  },
  cigar: {
    name: "CIGAR",
    image: "https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/Cigar.png",
  },
};


const getDeviceImage = (deviceType: DeviceType, level: number): string => {
  if (deviceType === "vape" && level > 0) {
    return `https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/Vape/level${level}vape.svg`;
  }
  if (deviceType === "cigarette" && level > 0) {
    return `https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/Cigs/level${level}cig.svg`;
  }
  if (deviceType === "cigar" && level > 0) {
    return `https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/Cigar/level${level}cigar.svg`;
  }
  return DEVICE_CONFIG[deviceType].image;
};

export const DevicesOwned = () => {
  const { publicKey, signTransaction } = useWallet();
  const { toast } = useToast();
  const { sendSol, isLoading: isTransacting } = useSolanaTransaction();
  const { globalStats } = useSmokeEconomy();
  const queryClient = useQueryClient();
  const { data: walletSmokeBalance } = useWalletTokenBalance();
  const [deviceLevels, setDeviceLevels] = useState<DeviceLevels>({
    vape: 0,
    cigarette: 0,
    cigar: 0,
  });
  const [viewingStats, setViewingStats] = useState<DeviceType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<{
    deviceType: DeviceType;
    signature: string;
    upgradeCost: number;
  } | null>(null);

  useEffect(() => {
    const fetchDevices = async () => {
      if (!publicKey) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_smoke_balance")
        .select("device_levels")
        .eq("user_id", publicKey.toString())
        .single();

      if (error) {
        console.error("Error fetching devices:", error);
        setIsLoading(false);
        return;
      }

      if (data?.device_levels) {
        const levels = data.device_levels as Record<string, number>;
        setDeviceLevels({
          vape: levels.vape ?? 0,
          cigarette: levels.cigarette ?? 0,
          cigar: levels.cigar ?? 0,
        });
      }
      setIsLoading(false);
    };

    fetchDevices();
  }, [publicKey]);

  const handleBuyDevice = async (deviceType: DeviceType) => {
    if (!publicKey) return;

    try {
      // Send SOL transaction
      const signature = await sendSol(0.2);

      // Initialize device at level 1
      const newLevels = { ...deviceLevels, [deviceType]: 1 };

      const { error } = await supabase
        .from("user_smoke_balance")
        .update({
          device_levels: newLevels,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", publicKey.toString());

      if (error) throw error;

      setDeviceLevels(newLevels);

      toast({
        title: "Device Purchased!",
        description: `You now own a ${DEVICE_CONFIG[deviceType].name}`,
      });
    } catch (error) {
      console.error("Error buying device:", error);
      toast({
        title: "Purchase Failed",
        description: "Failed to purchase device. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpgradeDevice = async (deviceType: DeviceType, retrySignature?: string) => {
    if (!publicKey || !signTransaction) return;

    const currentLevel = deviceLevels[deviceType];
    const upgradeCost = GameEconomy.getUpgradeCost(currentLevel);
    const smokeBalance = walletSmokeBalance || 0;

    if (smokeBalance < upgradeCost && !retrySignature) {
      toast({
        title: "Insufficient $SMOKE",
        description: `You need ${upgradeCost} $SMOKE to upgrade. You have ${smokeBalance.toFixed(4)} $SMOKE in your wallet.`,
        variant: "destructive",
      });
      return;
    }

    setIsUpgrading(true);
    let tokenTransferSignature = retrySignature;

    try {
      // Get RPC URL from backend
      const { data: rpcData } = await supabase.functions.invoke('get-rpc-url');
      const rpcUrl = rpcData?.rpcUrl || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");

      // Step 1: Handle token transfer (skip if retrying with existing signature)
      if (!retrySignature) {
        toast({
          title: "Processing Token Transfer",
          description: "Please approve the $SMOKE token transfer to upgrade your device.",
        });

        try {
          const result = await transferSmokeToTreasury(
            connection,
            publicKey,
            signTransaction,
            upgradeCost
          );
          tokenTransferSignature = result.signature;
        } catch (transferError: unknown) {
          const error = transferError as Error;
          console.error("Token transfer error:", error);

          // Check if this is a "transaction already processed" error
          if (error.message.includes('already been processed')) {
            toast({
              title: "Transaction Already Processed",
              description: "It looks like your transfer was already processed. Let's check and retry the upgrade...",
              variant: "default",
            });
            // We'll continue to try the upgrade with whatever signature we can find
            return;
          }

          throw transferError;
        }
      }

      if (!tokenTransferSignature) {
        throw new Error("No transaction signature available");
      }

      console.log("Proceeding with upgrade using signature:", tokenTransferSignature);

      // Step 2: Verify the transaction status and call backend upgrade
      toast({
        title: "Verifying Transfer",
        description: "Confirming your token transfer and upgrading device...",
      });

      const { data, error } = await supabase.functions.invoke('upgrade-device', {
        body: { deviceType, transactionSignature: tokenTransferSignature }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error);
      }

      // Step 3: Update local state on success
      const newLevels = { ...deviceLevels, [deviceType]: data.newLevel };
      setDeviceLevels(newLevels);

      // Clear any pending transaction
      setPendingTransaction(null);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['unified-balance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-token-balance'] });

      toast({
        title: "Device Upgraded! 🎉",
        description: `${DEVICE_CONFIG[deviceType].name} is now level ${data.newLevel}. Transferred ${upgradeCost} $SMOKE to contract.`,
      });

    } catch (error: unknown) {
      console.error("Error upgrading device:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upgrade device. Please try again.";

      // If we have a transaction signature, save it for potential retry
      if (tokenTransferSignature && !errorMessage.includes('Insufficient')) {
        setPendingTransaction({
          deviceType,
          signature: tokenTransferSignature,
          upgradeCost
        });

        toast({
          title: "Upgrade Failed - Tokens Transferred",
          description: "Your $SMOKE tokens were transferred but the device upgrade failed. You can retry the upgrade without spending more tokens.",
          variant: "destructive",
          action: (
            <button
              onClick={() => handleUpgradeDevice(deviceType, tokenTransferSignature)}
              className="ml-2 px-2 py-1 text-xs bg-primary text-primary-foreground rounded"
            >
              Retry Upgrade
            </button>
          ),
        });
      } else {
        toast({
          title: "Upgrade Failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsUpgrading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border-t-2 border-foreground p-6">
        <p className="text-muted-foreground">Loading devices...</p>
      </div>
    );
  }

  const getDeviceStats = (deviceType: DeviceType, level: number) => {
    if (level === 0 || !globalStats) return null;

    const deviceLevelsForCalc = { vape: 0, cigarette: 0, cigar: 0, [deviceType]: level };
    const smokePerPuff = GameEconomy.calculatePuffSmoke(deviceLevelsForCalc, globalStats, true);
    const passivePerHour = GameEconomy.calculatePassiveIncome(deviceLevelsForCalc, globalStats, 1);

    return {
      smokePerPuff: Math.round(smokePerPuff),
      passivePerHour: Math.round(passivePerHour),
    };
  };

  return (
    <div className="bg-card rounded-lg border-t-2 border-foreground p-6">
      <h2 className="text-foreground text-2xl font-bold uppercase border-b-2 border-border pb-3 mb-6">
        MY DEVICES
      </h2>

      {viewingStats && (
        <div className="mb-6">
          <Button
            onClick={() => setViewingStats(null)}
            variant="outline"
            className="mb-4"
          >
            ← Back to Devices
          </Button>
          <DeviceStatsTable
            deviceType={viewingStats}
            currentLevel={deviceLevels[viewingStats]}
          />
        </div>
      )}

      {!viewingStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {(Object.keys(DEVICE_CONFIG) as DeviceType[]).map((deviceType) => {
            const config = DEVICE_CONFIG[deviceType];
            const level = deviceLevels[deviceType];
            const isOwned = level > 0;
            const isMaxLevel = level >= 10;
            const upgradeCost = GameEconomy.getUpgradeCost(level);
            const stats = getDeviceStats(deviceType, level);
            const canAffordUpgrade = (walletSmokeBalance || 0) >= upgradeCost;

          return (
            <div
              key={deviceType}
              className={`bg-black rounded-lg border-2 p-6 transition-all ${
                isOwned
                  ? "border-border hover:border-muted"
                  : "border-muted opacity-75"
              }`}
            >
              {/* Device Image */}
              <div className="flex justify-center mb-4">
                <img
                  src={getDeviceImage(deviceType, level)}
                  alt={config.name}
                  className={`w-40 h-40 object-contain ${
                    !isOwned ? "grayscale opacity-50" : ""
                  }`}
                  onError={(e) => {
                    e.currentTarget.src = DEVICE_CONFIG[deviceType].image;
                  }}
                />
              </div>

              {/* Device Name */}
              <h3 className="text-foreground text-xl font-bold uppercase text-center mb-2">
                {config.name}
              </h3>

              {/* Level Display */}
              <p className="text-muted-foreground text-sm uppercase text-center mb-3">
                {isOwned ? `LEVEL ${level}/10` : "NOT OWNED"}
              </p>

              {/* Device Stats */}
              {isOwned && stats && (
                <div className="bg-muted/20 rounded-lg p-3 mb-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Zap className="w-3 h-3" /> $SMOKE/Puff
                    </span>
                    <span className="text-foreground font-bold">{stats.smokePerPuff}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> $SMOKE/Hr
                    </span>
                    <span className="text-foreground font-bold">{stats.passivePerHour}</span>
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              {isOwned && (
                <div className="w-full bg-background rounded-full h-2 mb-4">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(level / 10) * 100}%` }}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {!isOwned ? (
                  <Button
                    onClick={() => handleBuyDevice(deviceType)}
                    disabled={isTransacting}
                    className="w-full"
                    variant="outline"
                  >
                    BUY FOR 0.2 SOL
                  </Button>
                ) : isMaxLevel ? (
                  <Button disabled className="w-full" variant="secondary">
                    ⭐ MAX LEVEL
                  </Button>
                ) : (
                  <>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-full">
                            <Button
                              disabled
                              className="w-full opacity-60"
                              variant="outline"
                            >
                              🚀 COMING SOON
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs space-y-1">
                            <p className="font-bold">Device upgrades coming soon!</p>
                            <p>Available after $SMOKE token launch</p>
                            <p className="text-muted-foreground mt-2">Cost: {upgradeCost} $SMOKE</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}

                {isOwned && (
                  <Button
                    onClick={() => setViewingStats(deviceType)}
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                  >
                    <Info className="w-3 h-3 mr-1" />
                    View Upgrade Path
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};

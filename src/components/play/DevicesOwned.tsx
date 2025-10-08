import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useSolanaTransaction } from "@/hooks/useSolanaTransaction";

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

const calculateUpgradeCost = (currentLevel: number): number => {
  return 0.2 + currentLevel * 0.1;
};

const getDeviceImage = (deviceType: DeviceType, level: number): string => {
  if (deviceType === "vape" && level > 0) {
    return `https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/Vape/level${level}vape.svg`;
  }
  return DEVICE_CONFIG[deviceType].image;
};

export const DevicesOwned = () => {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const { sendSol, isLoading: isTransacting } = useSolanaTransaction();
  const [deviceLevels, setDeviceLevels] = useState<DeviceLevels>({
    vape: 0,
    cigarette: 0,
    cigar: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDevices = async () => {
      if (!publicKey) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("device_levels")
        .eq("wallet_address", publicKey.toString())
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
        .from("profiles")
        .update({ device_levels: newLevels })
        .eq("wallet_address", publicKey.toString());

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

  const handleUpgradeDevice = async (deviceType: DeviceType) => {
    if (!publicKey) return;

    const currentLevel = deviceLevels[deviceType];
    const cost = calculateUpgradeCost(currentLevel);

    try {
      // Send SOL transaction
      await sendSol(cost);

      // Upgrade device level
      const newLevels = { ...deviceLevels, [deviceType]: currentLevel + 1 };

      const { error } = await supabase
        .from("profiles")
        .update({ device_levels: newLevels })
        .eq("wallet_address", publicKey.toString());

      if (error) throw error;

      setDeviceLevels(newLevels);

      toast({
        title: "Device Upgraded!",
        description: `${DEVICE_CONFIG[deviceType].name} is now level ${currentLevel + 1}`,
      });
    } catch (error) {
      console.error("Error upgrading device:", error);
      toast({
        title: "Upgrade Failed",
        description: "Failed to upgrade device. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border-t-2 border-foreground p-6">
        <p className="text-muted-foreground">Loading devices...</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border-t-2 border-foreground p-6">
      <h2 className="text-foreground text-2xl font-bold uppercase border-b-2 border-border pb-3 mb-6">
        MY DEVICES
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {(Object.keys(DEVICE_CONFIG) as DeviceType[]).map((deviceType) => {
          const config = DEVICE_CONFIG[deviceType];
          const level = deviceLevels[deviceType];
          const isOwned = level > 0;
          const isMaxLevel = level >= 10;
          const upgradeCost = calculateUpgradeCost(level);

          return (
            <div
              key={deviceType}
              className={`bg-secondary rounded-lg border-2 p-6 transition-all ${
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
                  className={`w-32 h-32 object-contain ${
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

              {/* Progress Bar */}
              {isOwned && (
                <div className="w-full bg-background rounded-full h-2 mb-4">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(level / 10) * 100}%` }}
                  />
                </div>
              )}

              {/* Action Button */}
              <div className="flex flex-col items-center gap-2">
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
                    MAX LEVEL
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => handleUpgradeDevice(deviceType)}
                      disabled={isTransacting}
                      className="w-full"
                      variant="outline"
                    >
                      UPGRADE
                    </Button>
                    <span className="text-muted-foreground text-sm">
                      {upgradeCost.toFixed(1)} SOL
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

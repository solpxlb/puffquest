import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Twitter } from "lucide-react";

interface InviteGateProps {
  onAccessGranted: () => void;
}

export const InviteGate = ({ onAccessGranted }: InviteGateProps) => {
  const { publicKey, connected } = useWallet();
  const { toast } = useToast();
  const [inviteCode, setInviteCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmitInviteCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connected || !publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!inviteCode.trim()) {
      toast({
        title: "Invalid Code",
        description: "Please enter an invite code",
        variant: "destructive",
      });
      return;
    }

    setIsValidating(true);

    try {
      const { data, error } = await supabase.functions.invoke("validate-invite-code", {
        body: {
          code: inviteCode.toUpperCase().trim(),
          walletAddress: publicKey.toString(),
        },
      });

      if (error) {
        console.error("[InviteGate] Error validating code:", error);
        toast({
          title: "Invalid Code",
          description: error.message || "This invite code is invalid or has already been used",
          variant: "destructive",
        });
        return;
      }

      if (data?.valid) {
        toast({
          title: "Welcome to Puff Quest! 🎉",
          description: "Your invite code has been verified. Enjoy the game!",
        });
        onAccessGranted();
      }
    } catch (error) {
      console.error("[InviteGate] Unexpected error:", error);
      toast({
        title: "Error",
        description: "Failed to validate invite code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url(https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/puffquest_hero_bg.svg)' }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left - Invite Form */}
          <div className="flex justify-center lg:justify-end lg:mr-12 z-10">
            <div className="w-full max-w-md">
              <div className="bg-card/70 backdrop-blur-md border-2 border-primary/30 rounded-lg p-8 shadow-2xl">
                {/* Header */}
                <div className="text-center mb-6">
                  <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                    Puff Quest
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Beta Access - Invite Only
                  </p>
                </div>

                {/* Invite Code Form */}
                <form onSubmit={handleSubmitInviteCode} className="space-y-6">
                  {/* Wallet Connection */}
                  {!connected ? (
                    <div className="space-y-3">
                      <p className="text-sm text-center text-muted-foreground">
                        Connect your wallet to continue
                      </p>
                      <div className="flex justify-center">
                        <WalletMultiButton className="!bg-transparent !border-2 !border-white !text-white hover:!bg-white/10 hover:!border-white !rounded-lg !px-6 !py-3 !font-bold" />
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Connected Wallet Display */}
                      <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Connected Wallet</p>
                        <p className="text-sm font-mono text-white truncate">
                          {publicKey?.toString()}
                        </p>
                      </div>

                      {/* Invite Code Input */}
                      <div className="space-y-2">
                        <label htmlFor="inviteCode" className="block text-sm font-medium text-white">
                          Invite Code
                        </label>
                        <input
                          type="text"
                          id="inviteCode"
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                          placeholder="XXXXXXXX"
                          className="w-full px-4 py-3 bg-background border-2 border-primary/30 rounded-lg text-white text-center font-mono text-lg tracking-wider uppercase focus:outline-none focus:border-primary transition-colors"
                          maxLength={8}
                          disabled={isValidating}
                        />
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={isValidating || !inviteCode.trim()}
                        className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
                      >
                        {isValidating ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Validating...
                          </>
                        ) : (
                          "Redeem Invite Code"
                        )}
                      </button>
                    </>
                  )}
                </form>

                {/* Waitlist Info (Future) */}
                <div className="mt-6 pt-6 border-t border-primary/20">
                  <p className="text-xs text-center text-muted-foreground">
                    Don't have an invite code?{" "}
                    <span className="text-primary cursor-not-allowed">
                      Join the waitlist (coming soon)
                    </span>
                  </p>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    Money for nothing. Puffs for free.
                  </p>
                </div>
              </div>

              {/* Social Media Icons */}
              <div className="flex items-center justify-center gap-3 mt-6">
                <a
                  href="https://x.com/puffquest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-black transition-all p-2.5 flex items-center justify-center rounded"
                  aria-label="Follow us on X"
                >
                  <Twitter className="w-5 h-5" />
                </a>
                <a
                  href="https://discord.gg/puffquest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-black transition-all p-2.5 flex items-center justify-center rounded"
                  aria-label="Join our Discord"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Right - Character Image */}
          <div className="hidden lg:flex justify-end z-10">
            <img
              src="https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/puffquest_hero_char.svg"
              alt="Puff Quest Character"
              className="w-full max-w-md lg:max-w-lg xl:max-w-xl h-auto object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

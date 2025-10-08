import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSolanaTransaction } from "@/hooks/useSolanaTransaction";
import { useSolanaAuth } from "@/hooks/useSolanaAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type Vice = "vape" | "cigarette" | "cigar";

interface ViceCard {
  id: Vice;
  name: string;
  imageUrl: string;
  price: number;
}

const VICES: ViceCard[] = [
  {
    id: "vape",
    name: "Vape",
    imageUrl: "https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/Vape.png",
    price: 0.2,
  },
  {
    id: "cigarette",
    name: "Cigarette",
    imageUrl: "https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/Cig.png",
    price: 0.2,
  },
  {
    id: "cigar",
    name: "Cigar",
    imageUrl: "https://xgisixdxffyvwsfsnjsu.supabase.co/storage/v1/object/public/assets/Cigar.png",
    price: 0.2,
  },
];

const Play = () => {
  const [selectedVices, setSelectedVices] = useState<Vice[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { connected, publicKey } = useWallet();
  const { session, signIn, isAuthenticating } = useSolanaAuth();
  const { sendSol } = useSolanaTransaction();
  const { toast } = useToast();
  const navigate = useNavigate();

  const toggleVice = (vice: Vice) => {
    setSelectedVices((prev) =>
      prev.includes(vice) ? prev.filter((v) => v !== vice) : [...prev, vice]
    );
  };

  const totalAmount = selectedVices.length * 0.2;

  const handleContinue = async () => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    if (selectedVices.length === 0) {
      toast({
        title: "No Vice Selected",
        description: "Please select at least one vice to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Ensure user has a Supabase session/profile
      if (!session) {
        toast({
          title: "Authenticating",
          description: "Signing in with your wallet...",
        });
        
        await signIn();
        
        // Wait a moment for the session to be established
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Step 1: Send SOL transaction
      toast({
        title: "Processing Transaction",
        description: "Sending transaction...",
      });

      const signature = await sendSol(totalAmount);

      // Step 2: Verify transaction via edge function
      toast({
        title: "Verifying Transaction",
        description: "Please wait while we verify your purchase...",
      });

      const { data, error } = await supabase.functions.invoke("purchase-vices", {
        body: {
          viceTypes: selectedVices,
          transactionSignature: signature,
          walletAddress: publicKey.toString(),
        },
      });

      if (error) throw error;

      // Step 3: Show success
      toast({
        title: "Purchase Successful! 🎉",
        description: (
          <div className="flex flex-col gap-2">
            <p>Your vices have been added to your profile.</p>
            <a
              href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              View on Solscan
            </a>
          </div>
        ),
      });

      // Step 4: Redirect after success
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error: any) {
      console.error("Purchase error:", error);
      toast({
        title: "Transaction Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
        <Navbar />
        <main className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[80vh]">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Connect Your Wallet First
          </h1>
          <p className="text-muted-foreground text-center max-w-md">
            Please connect your Solana wallet to continue playing.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Navbar />
      <main className="container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              Choose Your Vice
            </h1>
            <p className="text-muted-foreground text-lg">
              (Degenerates Can Choose Multiple Vices)
            </p>
          </div>

          {/* Vice Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {VICES.map((vice) => {
              const isSelected = selectedVices.includes(vice.id);
              return (
                <button
                  key={vice.id}
                  onClick={() => toggleVice(vice.id)}
                  disabled={isProcessing}
                  className={`
                    group relative overflow-hidden rounded-lg p-6 
                    transition-all duration-300 transform hover:scale-105
                    border-2 bg-card/50 backdrop-blur-sm
                    ${
                      isSelected
                        ? "border-primary shadow-lg shadow-primary/50"
                        : "border-border hover:border-primary/50"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <div className="aspect-square mb-4 flex items-center justify-center">
                    <img
                      src={vice.imageUrl}
                      alt={vice.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{vice.name}</h3>
                  <p className="text-primary text-xl font-semibold">
                    {vice.price} SOL
                  </p>
                  {isSelected && (
                    <div className="absolute top-4 right-4 bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center">
                      ✓
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Total and Continue Button */}
          <div className="flex items-center justify-center gap-8">
            <p className="text-3xl font-bold">
              Total: {totalAmount.toFixed(1)} SOL
            </p>
            <Button
              size="lg"
              onClick={handleContinue}
              disabled={selectedVices.length === 0 || isProcessing}
              className="text-xl px-12 py-6 h-auto"
            >
              {isProcessing
                ? "Processing..."
                : `Continue & Pay ${totalAmount.toFixed(1)} SOL`}
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Play;

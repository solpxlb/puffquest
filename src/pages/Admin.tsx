import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Copy, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ADMIN_WALLET = "2h49osyS4nJE3RUDYxAPHwocVo8QmAcJXDkdVm8Hs6Dw";

interface InviteCode {
  id: string;
  code: string;
  created_at: string;
  used_by: string | null;
  used_at: string | null;
  is_active: boolean;
}

const Admin = () => {
  const { publicKey, connected } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingCodes, setIsLoadingCodes] = useState(true);
  const [codeCount, setCodeCount] = useState(5);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [newlyGeneratedCodes, setNewlyGeneratedCodes] = useState<string[]>([]);

  // Check if user is admin
  const isAdmin = connected && publicKey?.toString() === ADMIN_WALLET;

  useEffect(() => {
    if (!isAdmin && connected) {
      toast({
        title: "Access Denied",
        description: "Admin access required",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [isAdmin, connected, navigate, toast]);

  useEffect(() => {
    if (isAdmin) {
      loadInviteCodes();
    }
  }, [isAdmin]);

  const loadInviteCodes = async () => {
    setIsLoadingCodes(true);
    try {
      const { data, error } = await supabase
        .from("invite_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setInviteCodes(data || []);
    } catch (error) {
      console.error("[Admin] Error loading codes:", error);
      toast({
        title: "Error",
        description: "Failed to load invite codes",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCodes(false);
    }
  };

  const handleGenerateCodes = async () => {
    if (!publicKey) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-invite-codes", {
        body: {
          count: codeCount,
          walletAddress: publicKey.toString(),
        },
      });

      if (error) throw error;

      const generatedCodes = data.codes.map((c: any) => c.code);
      setNewlyGeneratedCodes(generatedCodes);

      toast({
        title: "Success!",
        description: `Generated ${data.count} invite code(s)`,
      });

      // Reload codes
      await loadInviteCodes();
    } catch (error) {
      console.error("[Admin] Error generating codes:", error);
      toast({
        title: "Error",
        description: "Failed to generate invite codes",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `Code "${text}" copied to clipboard`,
    });
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
        <Navbar />
        <main className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[80vh]">
          <h1 className="text-4xl font-bold text-center mb-4">Admin Panel</h1>
          <p className="text-muted-foreground text-center">
            Please connect your wallet to access the admin panel
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
        <Navbar />
        <main className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[80vh]">
          <h1 className="text-4xl font-bold text-center mb-4">Access Denied</h1>
          <p className="text-muted-foreground text-center">
            You don't have permission to access this page
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  const unusedCodes = inviteCodes.filter((c) => !c.used_by);
  const usedCodes = inviteCodes.filter((c) => c.used_by);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Navbar />
      <main className="container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
              Admin Panel
            </h1>
            <p className="text-muted-foreground">
              Manage invite codes and access control
            </p>
          </div>

          {/* Generate Codes Section */}
          <div className="bg-card border-2 border-primary/30 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Generate Invite Codes</h2>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label htmlFor="codeCount" className="block text-sm font-medium text-white mb-2">
                  Number of codes (1-100)
                </label>
                <input
                  type="number"
                  id="codeCount"
                  min="1"
                  max="100"
                  value={codeCount}
                  onChange={(e) => setCodeCount(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 bg-background border-2 border-primary/30 rounded-lg text-white focus:outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={handleGenerateCodes}
                disabled={isGenerating}
                className="bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-white font-bold py-2 px-6 rounded-lg transition-all flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate"
                )}
              </button>
            </div>

            {/* Newly Generated Codes */}
            {newlyGeneratedCodes.length > 0 && (
              <div className="mt-6 bg-primary/10 border border-primary/30 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Newly Generated Codes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {newlyGeneratedCodes.map((code) => (
                    <div
                      key={code}
                      className="flex items-center justify-between bg-background/50 rounded px-3 py-2"
                    >
                      <span className="font-mono text-white">{code}</span>
                      <button
                        onClick={() => copyToClipboard(code)}
                        className="text-primary hover:text-primary/80 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border-2 border-primary/30 rounded-lg p-6 text-center">
              <p className="text-3xl font-bold text-white">{inviteCodes.length}</p>
              <p className="text-muted-foreground text-sm mt-1">Total Codes</p>
            </div>
            <div className="bg-card border-2 border-green-500/30 rounded-lg p-6 text-center">
              <p className="text-3xl font-bold text-white">{unusedCodes.length}</p>
              <p className="text-muted-foreground text-sm mt-1">Unused</p>
            </div>
            <div className="bg-card border-2 border-orange-500/30 rounded-lg p-6 text-center">
              <p className="text-3xl font-bold text-white">{usedCodes.length}</p>
              <p className="text-muted-foreground text-sm mt-1">Used</p>
            </div>
          </div>

          {/* All Invite Codes */}
          <div className="bg-card border-2 border-primary/30 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">All Invite Codes</h2>

            {isLoadingCodes ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground mt-2">Loading codes...</p>
              </div>
            ) : inviteCodes.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No invite codes generated yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-primary/20">
                      <th className="text-left py-3 px-4 text-white font-semibold">Code</th>
                      <th className="text-left py-3 px-4 text-white font-semibold">Status</th>
                      <th className="text-left py-3 px-4 text-white font-semibold">Used By</th>
                      <th className="text-left py-3 px-4 text-white font-semibold">Created</th>
                      <th className="text-center py-3 px-4 text-white font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inviteCodes.map((code) => (
                      <tr key={code.id} className="border-b border-primary/10">
                        <td className="py-3 px-4">
                          <span className="font-mono text-white">{code.code}</span>
                        </td>
                        <td className="py-3 px-4">
                          {code.used_by ? (
                            <span className="inline-flex items-center gap-1 text-orange-400">
                              <XCircle className="w-4 h-4" />
                              Used
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-green-400">
                              <CheckCircle className="w-4 h-4" />
                              Available
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {code.used_by ? (
                            <span className="font-mono text-xs text-muted-foreground">
                              {code.used_by.slice(0, 8)}...
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-sm">
                          {new Date(code.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => copyToClipboard(code.code)}
                            className="text-primary hover:text-primary/80 transition-colors"
                          >
                            <Copy className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;

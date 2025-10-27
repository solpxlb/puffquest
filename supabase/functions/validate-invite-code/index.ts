import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { code, walletAddress } = await req.json();

    console.log("[Validate Invite] Request received:", { code, walletAddress });

    if (!code || !walletAddress) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: code and walletAddress" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Check if invite code exists and is valid
    const { data: inviteCode, error: inviteError } = await supabase
      .from("invite_codes")
      .select("*")
      .eq("code", code.toUpperCase())
      .eq("is_active", true)
      .is("used_by", null)
      .single();

    if (inviteError || !inviteCode) {
      console.error("[Validate Invite] Invalid code:", inviteError);
      return new Response(
        JSON.stringify({
          error: "Invalid or already used invite code",
          valid: false
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Validate Invite] Valid code found:", inviteCode.code);

    // 2. Mark invite code as used
    const { error: updateCodeError } = await supabase
      .from("invite_codes")
      .update({
        used_by: walletAddress,
        used_at: new Date().toISOString(),
      })
      .eq("code", code.toUpperCase());

    if (updateCodeError) {
      console.error("[Validate Invite] Error updating code:", updateCodeError);
      return new Response(
        JSON.stringify({ error: "Failed to redeem invite code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Update user profile to approved status
    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({
        access_status: "approved",
        invite_code_used: code.toUpperCase(),
        approved_at: new Date().toISOString(),
      })
      .eq("wallet_address", walletAddress);

    if (updateProfileError) {
      console.error("[Validate Invite] Error updating profile:", updateProfileError);
      // Rollback invite code usage
      await supabase
        .from("invite_codes")
        .update({ used_by: null, used_at: null })
        .eq("code", code.toUpperCase());

      return new Response(
        JSON.stringify({ error: "Failed to approve user access" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Validate Invite] Successfully approved user:", walletAddress);

    return new Response(
      JSON.stringify({
        success: true,
        valid: true,
        message: "Invite code successfully redeemed! You now have access to Puff Quest.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Validate Invite] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_WALLET = "2h49osyS4nJE3RUDYxAPHwocVo8QmAcJXDkdVm8Hs6Dw";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { count = 1, walletAddress } = await req.json();

    console.log("[Generate Codes] Request received:", { count, walletAddress });

    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: "Missing walletAddress" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify admin access
    if (walletAddress !== ADMIN_WALLET) {
      console.error("[Generate Codes] Unauthorized wallet:", walletAddress);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (count < 1 || count > 100) {
      return new Response(
        JSON.stringify({ error: "Count must be between 1 and 100" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Generate Codes] Generating", count, "invite codes");

    // Generate unique codes
    const codes = [];
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No ambiguous chars
    const codeLength = 8;

    for (let i = 0; i < count; i++) {
      let code = "";
      for (let j = 0; j < codeLength; j++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }

      // Check if code already exists (rare but possible)
      const { data: existing } = await supabase
        .from("invite_codes")
        .select("code")
        .eq("code", code)
        .single();

      if (existing) {
        console.log("[Generate Codes] Duplicate code detected, regenerating");
        i--; // Retry this iteration
        continue;
      }

      codes.push({
        code,
        created_by: walletAddress,
        is_active: true,
      });
    }

    // Insert codes into database
    const { data: insertedCodes, error: insertError } = await supabase
      .from("invite_codes")
      .insert(codes)
      .select();

    if (insertError) {
      console.error("[Generate Codes] Error inserting codes:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate invite codes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Generate Codes] Successfully generated", insertedCodes.length, "codes");

    return new Response(
      JSON.stringify({
        success: true,
        codes: insertedCodes.map((c) => ({
          code: c.code,
          createdAt: c.created_at,
        })),
        count: insertedCodes.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Generate Codes] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

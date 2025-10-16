import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { pointsToConvert } = await req.json();
    if (!pointsToConvert || pointsToConvert <= 0) {
      throw new Error('Invalid points amount');
    }

    // Get user's wallet address
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('wallet_address, total_points_earned, smoke_balance')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error('Profile not found');

    // Check if user has enough points
    if (profile.total_points_earned < pointsToConvert) {
      throw new Error('Insufficient points');
    }

    // Get global stats for conversion rate
    const { data: stats, error: statsError } = await supabase
      .from('global_stats')
      .select('*')
      .eq('id', 1)
      .single();

    if (statsError || !stats) throw new Error('Failed to fetch conversion rate');

    const conversionRate = stats.current_conversion_rate;
    const smokeEarned = pointsToConvert / conversionRate;

    // Check if pool has enough $SMOKE
    if (stats.rewards_pool_remaining < smokeEarned) {
      throw new Error('Rewards pool depleted');
    }

    // Update user profile
    const newSmokeBalance = Number(profile.smoke_balance) + smokeEarned;
    const newTotalSmokeEarned = Number(profile.total_smoke_earned || 0) + smokeEarned;
    const newPointsBalance = Number(profile.total_points_earned) - pointsToConvert;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        smoke_balance: newSmokeBalance,
        total_smoke_earned: newTotalSmokeEarned,
        total_points_earned: newPointsBalance
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // Log transaction
    const { error: txError } = await supabase
      .from('smoke_transactions')
      .insert({
        user_id: profile.wallet_address,
        transaction_type: 'convert',
        amount: smokeEarned,
        points_converted: pointsToConvert,
        balance_after: newSmokeBalance,
        description: `Converted ${pointsToConvert} points to ${smokeEarned.toFixed(4)} $SMOKE`,
        metadata: { conversion_rate: conversionRate }
      });

    if (txError) console.error('Failed to log transaction:', txError);

    console.log(`✅ Converted ${pointsToConvert} points → ${smokeEarned.toFixed(4)} $SMOKE for ${profile.wallet_address}`);

    return new Response(
      JSON.stringify({
        success: true,
        smokeEarned,
        newBalance: newSmokeBalance,
        conversionRate,
        pointsConverted: pointsToConvert
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Error converting points:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

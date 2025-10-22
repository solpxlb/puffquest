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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Updating global stats...');

    // Count total unique players (wallets with at least 1 puff)
    const { count: totalPlayers, error: playersError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gt('total_puffs', 0);

    if (playersError) throw playersError;

    // Sum total $SMOKE distributed
    const { data: smokeData, error: smokeError } = await supabase
      .from('profiles')
      .select('total_smoke_earned');

    if (smokeError) throw smokeError;

    const totalSmokeDistributed = smokeData?.reduce(
      (sum, profile) => sum + (Number(profile.total_smoke_earned) || 0),
      0
    ) || 0;

    // Calculate rewards pool remaining
    const initialPool = 45_000_000;
    const rewardsPoolRemaining = initialPool - totalSmokeDistributed;

    // Update global stats
    const { error: updateError } = await supabase
      .from('global_stats')
      .update({
        total_players: totalPlayers || 0,
        total_smoke_distributed: totalSmokeDistributed,
        rewards_pool_remaining: rewardsPoolRemaining,
        last_updated: new Date().toISOString()
      })
      .eq('id', 1);

    if (updateError) throw updateError;

    console.log('✅ Global stats updated:', {
      totalPlayers: totalPlayers || 0,
      totalSmokeDistributed,
      rewardsPoolRemaining,
    });

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          totalPlayers: totalPlayers || 0,
          totalSmokeDistributed,
          rewardsPoolRemaining,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Error updating global stats:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// GameEconomy calculations (duplicated from frontend for edge function use)
const calculatePassiveIncome = (
  deviceLevels: { vape: number; cigarette: number; cigar: number },
  globalStats: any,
  hoursSinceLastClaim: number
): number => {
  const cappedHours = Math.min(hoursSinceLastClaim, 24);
  
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

  if (hourlySmoke === 0) return 0;

  // Apply deflation
  const totalPlayers = Math.max(globalStats.total_players || 1, 1);
  let deflationFactor = 1.0;
  
  if (totalPlayers >= 100) {
    deflationFactor = Math.max(0.2, 1 - ((totalPlayers - 100) * 0.002));
  }

  return Math.floor(hourlySmoke * cappedHours * deflationFactor);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting passive income calculation...');

    // Fetch global stats
    const { data: globalStats, error: statsError } = await supabase
      .from('global_stats')
      .select('*')
      .eq('id', 1)
      .single();

    if (statsError) {
      console.error('Error fetching global stats:', statsError);
      throw statsError;
    }

    // Fetch all users with Level 2+ devices
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, wallet_address, device_levels, smoke_balance, total_smoke_earned, last_passive_claim')
      .or('device_levels->>vape.gte.2,device_levels->>cigarette.gte.2,device_levels->>cigar.gte.2');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} users with passive income eligible devices`);

    let totalPassiveAwarded = 0;
    let usersProcessed = 0;

    // Process each user
    for (const profile of profiles || []) {
      const deviceLevels = profile.device_levels as { vape: number; cigarette: number; cigar: number };
      const lastClaim = profile.last_passive_claim ? new Date(profile.last_passive_claim) : new Date();
      const now = new Date();
      const hoursSinceLastClaim = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);

      // Only process if at least 1 hour has passed
      if (hoursSinceLastClaim < 1) {
        continue;
      }

      const passiveSmoke = calculatePassiveIncome(deviceLevels, globalStats, hoursSinceLastClaim);

      if (passiveSmoke > 0) {
        const newSmokeBalance = (profile.smoke_balance || 0) + passiveSmoke;
        const newTotalSmoke = (profile.total_smoke_earned || 0) + passiveSmoke;

        // Update profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            smoke_balance: newSmokeBalance,
            total_smoke_earned: newTotalSmoke,
            last_passive_claim: now.toISOString(),
          })
          .eq('id', profile.id);

        if (updateError) {
          console.error(`Error updating profile ${profile.wallet_address}:`, updateError);
          continue;
        }

        // Log transaction
        const { error: txError } = await supabase
          .from('smoke_transactions')
          .insert({
            user_id: profile.wallet_address,
            transaction_type: 'earn_passive',
            amount: passiveSmoke,
            balance_after: newSmokeBalance,
            description: `Passive income: ${passiveSmoke} $SMOKE`,
            metadata: {
              hours_claimed: Math.min(hoursSinceLastClaim, 24),
              device_levels: deviceLevels,
            },
          });

        if (txError) {
          console.error(`Error logging transaction for ${profile.wallet_address}:`, txError);
        }

        totalPassiveAwarded += passiveSmoke;
        usersProcessed++;
        console.log(`Awarded ${passiveSmoke} $SMOKE to ${profile.wallet_address}`);
      }
    }

    console.log(`Passive income calculation complete. Processed ${usersProcessed} users, awarded ${totalPassiveAwarded} total $SMOKE`);

    return new Response(
      JSON.stringify({
        success: true,
        usersProcessed,
        totalPassiveAwarded,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in calculate-passive-income:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
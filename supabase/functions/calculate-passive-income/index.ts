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
  
  const deviceMultipliers = {
    vape: deviceLevels.vape >= 2 ? (deviceLevels.vape - 1) * 5 : 0,
    cigarette: deviceLevels.cigarette >= 2 ? (deviceLevels.cigarette - 1) * 8 : 0,
    cigar: deviceLevels.cigar >= 2 ? (deviceLevels.cigar - 1) * 12 : 0,
  };

  const basePassivePerHour = 
    deviceMultipliers.vape + 
    deviceMultipliers.cigarette + 
    deviceMultipliers.cigar;

  if (basePassivePerHour === 0) return 0;

  const totalPlayers = Math.max(globalStats.total_players || 1, 1);
  const rewardsPool = globalStats.rewards_pool_remaining || 45000000;
  const playerScarcityFactor = Math.min(totalPlayers / 1000, 10);
  const poolDepletionFactor = Math.max(rewardsPool / 45000000, 0.1);
  const deflationMultiplier = poolDepletionFactor / Math.sqrt(playerScarcityFactor);

  return Math.floor(basePassivePerHour * cappedHours * deflationMultiplier);
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
      .select('id, wallet_address, device_levels, total_points_earned, last_passive_claim')
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

      const passivePoints = calculatePassiveIncome(deviceLevels, globalStats, hoursSinceLastClaim);

      if (passivePoints > 0) {
        const newTotalPoints = (profile.total_points_earned || 0) + passivePoints;

        // Update profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            total_points_earned: newTotalPoints,
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
            amount: 0,
            points_converted: passivePoints,
            balance_after: 0, // Not converting to SMOKE yet
            description: `Passive income: ${passivePoints} points`,
            metadata: {
              hours_claimed: Math.min(hoursSinceLastClaim, 24),
              device_levels: deviceLevels,
            },
          });

        if (txError) {
          console.error(`Error logging transaction for ${profile.wallet_address}:`, txError);
        }

        totalPassiveAwarded += passivePoints;
        usersProcessed++;
        console.log(`Awarded ${passivePoints} points to ${profile.wallet_address}`);
      }
    }

    console.log(`Passive income calculation complete. Processed ${usersProcessed} users, awarded ${totalPassiveAwarded} total points`);

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

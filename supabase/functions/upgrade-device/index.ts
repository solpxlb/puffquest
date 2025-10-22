import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeviceLevels {
  vape: number;
  cigarette: number;
  cigar: number;
}

// Calculate upgrade cost in $SMOKE using exponential growth
const getUpgradeCost = (currentLevel: number): number => {
  if (currentLevel === 0) return 0; // Can't upgrade if not owned
  if (currentLevel === 1) return 0; // First upgrade is free
  return Math.pow(2, currentLevel - 2); // Exponential: Level 2->3: 1, 3->4: 2, 4->5: 4, etc.
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { deviceType } = await req.json()

    if (!['vape', 'cigarette', 'cigar'].includes(deviceType)) {
      throw new Error('Invalid device type')
    }

    console.log(`Upgrade request for ${deviceType} from user ${user.id}`)

    // Get user's current profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('device_levels, smoke_balance, id')
      .eq('id', user.id)
      .single()

    if (profileError) throw profileError

    const deviceLevels = profile.device_levels as DeviceLevels
    const currentLevel = deviceLevels[deviceType as keyof DeviceLevels]
    const currentBalance = Number(profile.smoke_balance)

    // Validation
    if (currentLevel === 0) {
      throw new Error('Device not owned. Purchase it first with SOL.')
    }

    if (currentLevel >= 10) {
      throw new Error('Device already at max level')
    }

    const upgradeCost = getUpgradeCost(currentLevel)

    if (currentBalance < upgradeCost) {
      throw new Error(`Insufficient $SMOKE. Need ${upgradeCost}, have ${currentBalance.toFixed(4)}`)
    }

    const newLevel = currentLevel + 1
    const newBalance = currentBalance - upgradeCost
    const newDeviceLevels = { ...deviceLevels, [deviceType]: newLevel }

    // Update profile
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        device_levels: newDeviceLevels,
        smoke_balance: newBalance,
      })
      .eq('id', user.id)

    if (updateError) throw updateError

    // Log transaction
    const { data: transaction, error: transactionError } = await supabaseClient
      .from('smoke_transactions')
      .insert({
        user_id: user.id,
        transaction_type: `upgrade_${deviceType}`,
        amount: -upgradeCost,
        balance_after: newBalance,
        description: `Upgraded ${deviceType} to level ${newLevel}`,
        metadata: {
          device_type: deviceType,
          previous_level: currentLevel,
          new_level: newLevel,
        },
      })
      .select()
      .single()

    if (transactionError) {
      console.error('Transaction logging failed:', transactionError)
    }

    console.log(`Successfully upgraded ${deviceType} to level ${newLevel} for user ${user.id}`)

    return new Response(
      JSON.stringify({
        success: true,
        newLevel,
        newBalance,
        upgradeCost,
        transactionId: transaction?.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Upgrade device error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

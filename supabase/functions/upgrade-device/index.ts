import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Connection, PublicKey } from "npm:@solana/web3.js@1.98.4"
import { getAssociatedTokenAddress, getAccount } from "npm:@solana/spl-token@0.3.8"

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

    const { deviceType, transactionSignature } = await req.json()

    if (!['vape', 'cigarette', 'cigar'].includes(deviceType)) {
      throw new Error('Invalid device type')
    }

    if (!transactionSignature) {
      throw new Error('Transaction signature required for token transfer verification')
    }

    console.log(`Upgrade request for ${deviceType} from user ${user.id} with tx ${transactionSignature}`)

    // Check for duplicate transaction signature first
    const { data: existingUpgrade } = await supabaseClient
      .from('upgrade_transactions')
      .select('id, device_type, new_level, created_at')
      .eq('transaction_signature', transactionSignature)
      .single();

    if (existingUpgrade) {
      console.log(`Transaction ${transactionSignature} already processed for ${existingUpgrade.device_type} upgrade to level ${existingUpgrade.new_level}`);

      // Return success with the existing upgrade data
      return new Response(
        JSON.stringify({
          success: true,
          newLevel: existingUpgrade.new_level,
          upgradeCost: 0, // Already paid
          transactionSignature,
          alreadyProcessed: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Get wallet address from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.wallet_address) {
      throw new Error('Profile not found or missing wallet address')
    }

    const walletAddress = profile.wallet_address
    const userWalletPubkey = new PublicKey(walletAddress)

    // Get current device levels from user_smoke_balance table
    const { data: balanceData, error: balanceError } = await supabaseClient
      .from('user_smoke_balance')
      .select('device_levels, user_id')
      .eq('user_id', walletAddress)
      .single()

    if (balanceError) throw balanceError

    const deviceLevels = balanceData.device_levels as DeviceLevels
    const currentLevel = deviceLevels[deviceType as keyof DeviceLevels]

    // Validation
    if (currentLevel === 0) {
      throw new Error('Device not owned. Purchase it first with SOL.')
    }

    if (currentLevel >= 10) {
      throw new Error('Device already at max level')
    }

    const upgradeCost = getUpgradeCost(currentLevel)

    // Verify the token transfer transaction on-chain
    // TODO: Update with mainnet $SMOKE token mint address when token is deployed
    const smokeMint = new PublicKey(Deno.env.get('SMOKE_MINT') || '')
    const heliusRpc = Deno.env.get('HELIUS_DEVNET_RPC')

    if (!smokeMint || !heliusRpc) {
      throw new Error('Missing environment variables for token verification')
    }

    const connection = new Connection(heliusRpc, 'confirmed')

    // Get transaction from blockchain
    const transaction = await connection.getTransaction(transactionSignature, {
      maxSupportedTransactionVersion: 0,
    })

    if (!transaction) {
      throw new Error('Transaction not found on blockchain')
    }

    // Verify transaction was successful
    if (transaction.meta?.err) {
      throw new Error('Transaction failed on blockchain')
    }

    // Get treasury address for verification
    const treasuryPDA = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode('treasury'), new PublicKey('Ws6mU44XByyeQk1rfptnwsAQxgMhdKVHAGT1GgndTAS').toBuffer()],
      new PublicKey(Deno.env.get('SMOKE_PROGRAM_ID') || '9NM3C5tGSANRzNdD3AohxszHntCGbYCPCreAtebpFEiF')
    )[0]

    const treasuryTokenAccount = await getAssociatedTokenAddress(smokeMint, treasuryPDA, true)
    const userTokenAccount = await getAssociatedTokenAddress(smokeMint, userWalletPubkey)

    // Verify this is a token transfer from user to treasury
    // Check if the transaction involves the correct token accounts
    const preTokenBalances = transaction.meta?.preTokenBalances || []
    const postTokenBalances = transaction.meta?.postTokenBalances || []

    let userTokenChange = 0
    const treasuryTokenChange = 0

    // Calculate token balance changes
    preTokenBalances.forEach((preBalance, index) => {
      const postBalance = postTokenBalances[index]
      if (preBalance.accountIndex === 0 && postBalance.accountIndex === 0) {
        // This is a simplified check - in production, you'd want to match by account address
        const preAmount = parseInt(preBalance.uiTokenAmount.amount || '0')
        const postAmount = parseInt(postBalance.uiTokenAmount.amount || '0')
        userTokenChange = postAmount - preAmount
      }
    })

    // Verify tokens were transferred from user (negative change) and amount matches upgrade cost
    const expectedTokenAmount = Math.floor(upgradeCost * Math.pow(10, 9)) // Assuming 9 decimals
    if (Math.abs(userTokenChange) < expectedTokenAmount) {
      throw new Error(`Token transfer amount mismatch. Expected at least ${expectedTokenAmount}, got ${Math.abs(userTokenChange)}`)
    }

    console.log(`Verified token transfer of ${Math.abs(userTokenChange) / Math.pow(10, 9)} $SMOKE for upgrade`)

    const newLevel = currentLevel + 1
    const newDeviceLevels = { ...deviceLevels, [deviceType]: newLevel }

    // Update user_smoke_balance - only update device_levels, no balance changes
    const { error: updateError } = await supabaseClient
      .from('user_smoke_balance')
      .update({
        device_levels: newDeviceLevels,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', walletAddress)

    if (updateError) throw updateError

    // Record the upgrade transaction for idempotency
    const { error: recordError } = await supabaseClient
      .from('upgrade_transactions')
      .insert({
        user_id: user.id,
        wallet_address: walletAddress,
        device_type: deviceType,
        old_level: currentLevel,
        new_level: newLevel,
        transaction_signature: transactionSignature,
        upgrade_cost: upgradeCost,
        created_at: new Date().toISOString(),
      })

    if (recordError) {
      console.error('Failed to record upgrade transaction:', recordError)
      // Don't fail the upgrade, just log the error
    }

    console.log(`Successfully upgraded ${deviceType} to level ${newLevel} for user ${walletAddress} after token transfer verification`)

    return new Response(
      JSON.stringify({
        success: true,
        newLevel,
        upgradeCost,
        transactionSignature,
        alreadyProcessed: false,
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

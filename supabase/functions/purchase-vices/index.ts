import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "npm:@solana/web3.js@1.98.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { viceTypes, transactionSignature } = await req.json();

    console.log('Processing purchase:', { userId: user.id, viceTypes, transactionSignature });

    // Validate input
    if (!Array.isArray(viceTypes) || viceTypes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid vice types' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transactionSignature) {
      return new Response(
        JSON.stringify({ error: 'Transaction signature required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate transaction
    const { data: existingPurchase } = await supabaseClient
      .from('vice_purchases')
      .select('id')
      .eq('transaction_signature', transactionSignature)
      .single();

    if (existingPurchase) {
      return new Response(
        JSON.stringify({ error: 'Transaction already processed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get team wallet and RPC URL from environment
    const teamWallet = Deno.env.get('TEAM_WALLET');
    const heliusRpc = Deno.env.get('HELIUS_DEVNET_RPC');

    if (!teamWallet || !heliusRpc) {
      console.error('Missing environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction on-chain
    const connection = new Connection(heliusRpc, 'confirmed');
    
    console.log('Fetching transaction from blockchain...');
    const transaction = await connection.getTransaction(transactionSignature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction) {
      console.error('Transaction not found on-chain');
      return new Response(
        JSON.stringify({ error: 'Transaction not found on blockchain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction was successful
    if (transaction.meta?.err) {
      console.error('Transaction failed on-chain:', transaction.meta.err);
      return new Response(
        JSON.stringify({ error: 'Transaction failed on blockchain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile to verify wallet address
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('wallet_address, vices')
      .eq('id', user.id)
      .single();

    if (!profile) {
      console.error('Profile not found');
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify sender matches user's wallet
    const accountKeys = transaction.transaction.message.getAccountKeys();
    const senderPubkey = accountKeys.get(0)?.toString();
    
    if (!senderPubkey || senderPubkey !== profile.wallet_address) {
      console.error('Sender mismatch:', { expected: profile.wallet_address, actual: senderPubkey });
      return new Response(
        JSON.stringify({ error: 'Transaction sender does not match user wallet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify recipient is team wallet
    const recipientPubkey = accountKeys.get(1)?.toString();
    if (recipientPubkey !== teamWallet) {
      console.error('Recipient mismatch:', { expected: teamWallet, actual: recipientPubkey });
      return new Response(
        JSON.stringify({ error: 'Transaction recipient does not match team wallet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify amount (0.2 SOL per vice)
    const expectedAmount = viceTypes.length * 0.2;
    const expectedLamports = Math.floor(expectedAmount * LAMPORTS_PER_SOL);
    
    // Get the actual transfer amount from post balances
    const preBalance = transaction.meta!.preBalances[1];
    const postBalance = transaction.meta!.postBalances[1];
    const actualLamports = postBalance - preBalance;

    if (Math.abs(actualLamports - expectedLamports) > 1000) { // Allow small difference for fees
      console.error('Amount mismatch:', { expected: expectedLamports, actual: actualLamports });
      return new Response(
        JSON.stringify({ error: 'Transaction amount does not match expected amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update profile with new vices (merge with existing, no duplicates)
    const currentVices = profile.vices || [];
    const newVices = Array.from(new Set([...currentVices, ...viceTypes]));

    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ vices: newVices })
      .eq('id', user.id);

    if (updateError) {
      console.error('Profile update error:', updateError);
      throw updateError;
    }

    // Record purchase
    const { error: purchaseError } = await supabaseClient
      .from('vice_purchases')
      .insert({
        user_id: user.id,
        vice_types: viceTypes,
        total_amount: expectedAmount,
        transaction_signature: transactionSignature,
        status: 'confirmed',
      });

    if (purchaseError) {
      console.error('Purchase record error:', purchaseError);
      throw purchaseError;
    }

    console.log('Purchase completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        vices: newVices,
        transactionSignature,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error processing purchase:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

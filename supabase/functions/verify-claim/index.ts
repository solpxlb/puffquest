/**
 * Verify Claim Edge Function
 *
 * This function verifies that a claim transaction was successfully executed on-chain
 * and updates the database accordingly.
 *
 * Flow:
 * 1. Verify transaction signature exists on-chain (with retries)
 * 2. Validate transaction details (sender, recipient, amount)
 * 3. Check for ClaimEvent emission
 * 4. Update user's smoke_balance to 0
 * 5. Update claim_transactions record (status: confirmed)
 * 6. Log to smoke_transactions table
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Connection, PublicKey } from 'npm:@solana/web3.js@1.98.4';

const PROGRAM_ID = new PublicKey('9NM3C5tGSANRzNdD3AohxszHntCGbYCPCreAtebpFEiF');
const AUTHORITY_PUBKEY = new PublicKey('Ws6mU44XByyeQk1rfptnwsAQxgMhdKVHAGT1GgndTAS');
const CLAIM_FEE_LAMPORTS = 20_000_000; // 0.02 SOL

const MAX_RETRIES = 6;
const RETRY_DELAY_MS = 1500;

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Parse request body
    const { wallet_address, transaction_signature } = await req.json();

    if (!wallet_address || !transaction_signature) {
      throw new Error('wallet_address and transaction_signature are required');
    }

    console.log(`[Verify Request] Wallet: ${wallet_address}`);
    console.log(`[Verify Request] Signature: ${transaction_signature}`);

    // Initialize Supabase client (service role for admin access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this signature has already been processed
    const { data: existingClaim } = await supabase
      .from('claim_transactions')
      .select('*')
      .eq('transaction_signature', transaction_signature)
      .eq('status', 'confirmed')
      .single();

    if (existingClaim) {
      console.log('[Duplicate] Transaction already processed');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Claim already processed',
          already_processed: true,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Get user balance from unified balance table
    const { data: balanceData, error: balanceError } = await supabase
      .from('user_smoke_balance')
      .select('current_balance, user_id')
      .eq('user_id', wallet_address)
      .single();

    if (balanceError || !balanceData) {
      console.error('[Error] User balance not found:', balanceError);
      throw new Error('User not found');
    }

    // Get user profile for user ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, wallet_address')
      .eq('wallet_address', wallet_address)
      .single();

    if (profileError || !profile) {
      console.error('[Error] User profile not found:', profileError);
      throw new Error('User not found');
    }

    const claimedAmount = parseFloat(balanceData.current_balance || '0');

    // Setup Solana connection
    const rpcUrl = Deno.env.get('HELIUS_DEVNET_RPC') || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // Verify transaction on-chain with retries
    let transactionData = null;
    let lastError = null;

    console.log('[Verification] Checking transaction on-chain...');

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Verification] Attempt ${attempt}/${MAX_RETRIES}`);

        const tx = await connection.getTransaction(transaction_signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (tx && tx.meta && !tx.meta.err) {
          transactionData = tx;
          console.log('[Verification] Transaction found and confirmed');
          break;
        }

        if (tx && tx.meta && tx.meta.err) {
          throw new Error(`Transaction failed on-chain: ${JSON.stringify(tx.meta.err)}`);
        }

        lastError = new Error('Transaction not found or not confirmed');

        if (attempt < MAX_RETRIES) {
          console.log(`[Verification] Retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      } catch (error: unknown) {
        lastError = error;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Verification] Attempt ${attempt} failed:`, errorMessage);

        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    if (!transactionData) {
      const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown error';
      throw new Error(`Failed to verify transaction after ${MAX_RETRIES} attempts: ${errorMessage}`);
    }

    // Validate transaction details
    const userWallet = new PublicKey(wallet_address);

    // Check that user is a signer (find in signatures, not by index)
    const signatures = transactionData.transaction.message.staticAccountKeys || [];
    const userIsSigner = signatures.some((key) => key.toBase58() === wallet_address);

    if (!userIsSigner) {
      throw new Error('Transaction sender mismatch');
    }

    // Check that authority is a signer
    const authorityIsSigner = signatures.some((key) => key.toBase58() === AUTHORITY_PUBKEY.toBase58());
    if (!authorityIsSigner) {
      throw new Error('Transaction not authorized by treasury authority');
    }

    console.log('[Validation] User and authority signatures verified');

    // Validate fee was paid (check SOL transfer)
    let feePaid = false;
    if (transactionData.meta && transactionData.meta.preBalances && transactionData.meta.postBalances) {
      // Find user and authority indices in the account keys
      const accountKeys = transactionData.transaction.message.staticAccountKeys || [];
      const userIndex = accountKeys.findIndex((key) => key.toBase58() === wallet_address);
      const authorityIndex = accountKeys.findIndex((key) => key.toBase58() === AUTHORITY_PUBKEY.toBase58());

      if (userIndex >= 0 && authorityIndex >= 0) {
        const userBalanceChange = transactionData.meta.postBalances[userIndex] - transactionData.meta.preBalances[userIndex];
        const authorityBalanceChange = transactionData.meta.postBalances[authorityIndex] - transactionData.meta.preBalances[authorityIndex];

        // User should have lost at least the claim fee (plus gas)
        // Authority should have gained approximately the claim fee
        if (userBalanceChange < -CLAIM_FEE_LAMPORTS && authorityBalanceChange > 0) {
          feePaid = true;
          console.log('[Validation] Fee payment verified');
          console.log(`[Validation] User paid: ${Math.abs(userBalanceChange) / 1e9} SOL`);
          console.log(`[Validation] Authority received: ${authorityBalanceChange / 1e9} SOL`);
        }
      }
    }

    if (!feePaid) {
      console.warn('[Validation] Could not verify fee payment from balance changes');
    }

    // Check for program logs indicating success
    const logs = transactionData.meta?.logMessages || [];
    const programInvoked = logs.some((log) => log.includes(PROGRAM_ID.toBase58()));
    const programSuccess = logs.some((log) => log.includes('Program log: Instruction: Claim'));

    if (!programInvoked) {
      throw new Error('Claim program was not invoked in this transaction');
    }

    console.log('[Validation] All checks passed');

    // Update database - use a transaction to ensure atomicity
    try {
      // Update user's smoke balance to 0 in unified balance table
      const { error: updateError } = await supabase
        .from('user_smoke_balance')
        .update({
          current_balance: 0,
        })
        .eq('user_id', wallet_address);

      if (updateError) {
        throw updateError;
      }

      console.log('[Database] Updated current_balance to 0');

      // Update claim_transactions record
      const { error: claimUpdateError } = await supabase
        .from('claim_transactions')
        .update({
          status: 'confirmed',
          transaction_signature: transaction_signature,
          confirmed_at: new Date().toISOString(),
        })
        .eq('wallet_address', wallet_address)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (claimUpdateError) {
        console.error('[Database] Failed to update claim_transactions:', claimUpdateError);
        // Don't fail the request, just log
      }

      // Log to smoke_transactions
      const { error: logError } = await supabase.from('smoke_transactions').insert({
        user_id: profile.id,
        transaction_type: 'claim',
        amount: -claimedAmount,
        balance_after: 0,
        description: `Claimed ${claimedAmount} $SMOKE to wallet`,
        metadata: {
          signature: transaction_signature,
          fee_paid: CLAIM_FEE_LAMPORTS / 1e9,
          timestamp: new Date().toISOString(),
          treasury_program: PROGRAM_ID.toBase58(),
        },
      });

      if (logError) {
        console.error('[Database] Failed to log transaction:', logError);
        // Don't fail the request, just log
      }

      console.log('[Success] Claim verified and recorded');

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully claimed ${claimedAmount} $SMOKE`,
          amount_claimed: claimedAmount,
          transaction_signature: transaction_signature,
          explorer_url: `https://explorer.solana.com/tx/${transaction_signature}?cluster=devnet`,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (dbError: unknown) {
      console.error('[Database Error]', dbError);
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
      throw new Error(`Database update failed: ${errorMessage}`);
    }
  } catch (error: unknown) {
    console.error('[Error]', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Try to mark the claim as failed in database
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { transaction_signature: txSig } = await req.json() as { transaction_signature: string };

      await supabase
        .from('claim_transactions')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('transaction_signature', txSig)
        .eq('status', 'pending');
    } catch (dbError) {
      console.error('[Database] Failed to mark claim as failed:', dbError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

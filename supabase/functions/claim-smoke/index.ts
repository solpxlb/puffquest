/**
 * Claim $SMOKE Edge Function
 *
 * This function prepares a claim transaction for users to sign.
 * The authority co-signs the transaction to authorize the claim amount.
 *
 * Flow:
 * 1. Validate user has smoke_balance > 0
 * 2. Check user has sufficient SOL for fees (0.025 SOL)
 * 3. Build claim instruction
 * 4. Authority partially signs transaction
 * 5. Return serialized transaction to frontend
 * 6. Record claim attempt in database (status: pending)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from 'npm:@solana/web3.js@1.98.4';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from 'npm:@solana/spl-token@0.3.11';
import { BN } from 'npm:bn.js@5.2.1';

const PROGRAM_ID = new PublicKey('9NM3C5tGSANRzNdD3AohxszHntCGbYCPCreAtebpFEiF');
const AUTHORITY_PUBKEY = new PublicKey('Ws6mU44XByyeQk1rfptnwsAQxgMhdKVHAGT1GgndTAS');
const CLAIM_FEE_LAMPORTS = 20_000_000; // 0.02 SOL
const MIN_SOL_REQUIRED = 25_000_000; // 0.025 SOL (fee + gas)

// Claim instruction discriminator (from IDL)
const CLAIM_DISCRIMINATOR = new Uint8Array([62, 198, 214, 193, 213, 159, 108, 210]);

// Helper function to concatenate Uint8Arrays (Deno equivalent of Buffer.concat)
function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

serve(async (req) => {
  console.log(`[Request] ${req.method} ${req.url}`);

  // CORS headers - Add better error handling
  try {
    if (req.method === 'OPTIONS') {
      console.log('[CORS] Handling OPTIONS request');
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
  } catch (error) {
    console.error('[CORS] Error handling OPTIONS:', error);
    return new Response('CORS error', { status: 500 });
  }

  try {
    // Parse request body with better error handling
    let body;
    try {
      body = await req.json();
      console.log('[Request] Body parsed successfully');
    } catch (parseError) {
      console.error('[Request] JSON parse error:', parseError);
      throw new Error('Invalid JSON in request body');
    }

    const { wallet_address } = body;

    if (!wallet_address) {
      throw new Error('wallet_address is required');
    }

    console.log(`[Claim Request] Wallet: ${wallet_address}`);

    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl) {
      console.error('[Config] SUPABASE_URL not found');
      throw new Error('Server configuration error: SUPABASE_URL not set');
    }

    if (!supabaseServiceKey) {
      console.error('[Config] SUPABASE_SERVICE_ROLE_KEY not found');
      throw new Error('Server configuration error: SUPABASE_SERVICE_ROLE_KEY not set');
    }

    console.log('[Config] Environment variables checked');

    // Initialize Supabase client (service role for admin access)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's smoke balance from unified balance table
    const { data: balanceData, error: balanceError } = await supabase
      .from('user_smoke_balance')
      .select('current_balance, user_id')
      .eq('user_id', wallet_address)
      .single();

    if (balanceError || !balanceData) {
      console.error('[Error] User balance not found:', balanceError);
      throw new Error('User not found');
    }

    const smokeBalance = parseFloat(balanceData.current_balance || '0');

    if (smokeBalance <= 0) {
      throw new Error('No tokens to claim. Your balance is 0.');
    }

    console.log(`[Balance] User has ${smokeBalance} $SMOKE to claim`);

    // Setup Solana connection
    const rpcUrl = Deno.env.get('HELIUS_DEVNET_RPC') || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // Load authority keypair (TEAM_WALLET contains the private key)
    const authorityPrivateKey = Deno.env.get('TEAM_WALLET');
    if (!authorityPrivateKey) {
      console.error('[Config] TEAM_WALLET not found in environment');
      throw new Error('Server configuration error: Authority wallet not configured');
    }

    console.log('[Config] TEAM_WALLET found, parsing keypair');

    let authorityKeypair;
    try {
      authorityKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(authorityPrivateKey))
      );
      console.log('[Authority] Keypair loaded successfully');
    } catch (keyError) {
      console.error('[Authority] Error parsing private key:', keyError);
      throw new Error('Server configuration error: Invalid authority wallet format');
    }

    console.log('[Authority] Keypair loaded');

    // Check user's SOL balance
    const userWallet = new PublicKey(wallet_address);
    const userSolBalance = await connection.getBalance(userWallet);

    console.log(`[SOL Balance] User has ${userSolBalance / 1e9} SOL`);

    if (userSolBalance < MIN_SOL_REQUIRED) {
      throw new Error(
        `Insufficient SOL balance. You need at least 0.025 SOL for the claim fee and transaction costs. ` +
        `Current balance: ${(userSolBalance / 1e9).toFixed(4)} SOL`
      );
    }

    // Get token mint (HiecAy5Mc4jQSYcVXtbTZRYujtX3KqY2VmhnaNUi8FwN)
    const smokeMint = new PublicKey('HiecAy5Mc4jQSYcVXtbTZRYujtX3KqY2VmhnaNUi8FwN');

    // Derive treasury PDA
    const [treasuryState] = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode('treasury'), AUTHORITY_PUBKEY.toBuffer()],
      PROGRAM_ID
    );

    console.log(`[Treasury] PDA: ${treasuryState.toBase58()}`);

    // Get token accounts
    const treasuryTokenAccount = await getAssociatedTokenAddress(
      smokeMint,
      treasuryState,
      true // allowOwnerOffCurve
    );

    const userTokenAccount = await getAssociatedTokenAddress(smokeMint, userWallet);

    console.log(`[Token Accounts] Treasury: ${treasuryTokenAccount.toBase58()}`);
    console.log(`[Token Accounts] User: ${userTokenAccount.toBase58()}`);

    // Check if user token account exists
    let needsTokenAccount = false;
    try {
      const accountInfo = await connection.getAccountInfo(userTokenAccount);
      if (!accountInfo) {
        needsTokenAccount = true;
      }
    } catch (e) {
      needsTokenAccount = true;
    }

    if (needsTokenAccount) {
      console.log('[Token Account] User needs token account, will create');
    }

    // Build transaction
    const transaction = new Transaction();

    // Add a unique memo to prevent duplicate transaction errors
    // This ensures each transaction is unique even if retried with the same blockhash
    const timestamp = Date.now();
    const memoText = `PuffQuest Claim: ${smokeBalance.toFixed(4)} $SMOKE - ${timestamp}`;
    const memoData = new TextEncoder().encode(memoText);
    const memoInstruction = new TransactionInstruction({
      keys: [{ pubkey: userWallet, isSigner: true, isWritable: false }],
      programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
      data: memoData,
    });
    transaction.add(memoInstruction);

    // Add create token account instruction if needed
    if (needsTokenAccount) {
      const createAccountIx = createAssociatedTokenAccountInstruction(
        userWallet, // payer (user pays for their own account)
        userTokenAccount,
        userWallet,
        smokeMint
      );
      transaction.add(createAccountIx);
    }

    // Build claim instruction
    const amountBN = new BN(Math.floor(smokeBalance * 1e9)); // Convert to smallest unit
    const data = concatUint8Arrays([CLAIM_DISCRIMINATOR, amountBN.toArrayLike(Uint8Array, 'le', 8)]);

    const keys = [
      { pubkey: treasuryState, isSigner: false, isWritable: true },
      { pubkey: treasuryTokenAccount, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: userWallet, isSigner: true, isWritable: true }, // User signs!
      { pubkey: authorityKeypair.publicKey, isSigner: true, isWritable: true }, // Authority signs!
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const claimIx = {
      keys,
      programId: PROGRAM_ID,
      data,
    };

    transaction.add(claimIx);

    // Set recent blockhash and fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userWallet; // USER PAYS!

    // Authority partially signs
    transaction.partialSign(authorityKeypair);

    console.log('[Transaction] Built and authority signed');

    // Serialize for frontend
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    // Record claim attempt in database
    const { error: insertError } = await supabase.from('claim_transactions').insert({
      user_id: balanceData.user_id,
      wallet_address: wallet_address,
      amount: smokeBalance,
      fee_paid: CLAIM_FEE_LAMPORTS / 1e9,
      status: 'pending',
      transaction_signature: null, // Will be updated after user signs
    });

    if (insertError) {
      console.error('[Database] Failed to record claim attempt:', insertError);
      // Don't fail the request, just log the error
    }

    console.log('[Success] Returning transaction to user');

    return new Response(
      JSON.stringify({
        success: true,
        transaction: serialized.toString('base64'),
        amount: smokeBalance,
        fee: CLAIM_FEE_LAMPORTS / 1e9,
        message: 'Please sign the transaction in your wallet to claim your $SMOKE tokens',
        treasury_address: treasuryState.toBase58(),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: unknown) {
    console.error('[Error]', error);

    let errorMessage = 'Unknown error occurred';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;

      // Determine appropriate status code based on error type
      if (errorMessage.includes('wallet_address is required') ||
          errorMessage.includes('Invalid JSON') ||
          errorMessage.includes('No tokens to claim') ||
          errorMessage.includes('Insufficient SOL balance')) {
        statusCode = 400; // Bad Request
      } else if (errorMessage.includes('User not found')) {
        statusCode = 404; // Not Found
      } else if (errorMessage.includes('Server configuration error')) {
        statusCode = 503; // Service Unavailable
      }
    }

    console.error(`[Error] ${statusCode}: ${errorMessage}`);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        status: statusCode,
        timestamp: new Date().toISOString(),
      }),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  }
});

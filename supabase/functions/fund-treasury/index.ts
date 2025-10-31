/**
 * Fund Treasury Edge Function
 *
 * This function deposits $SMOKE tokens into the treasury to enable user claims.
 * The authority transfers tokens from their account to the treasury.
 *
 * Flow:
 * 1. Check authority has sufficient $SMOKE tokens
 * 2. Build deposit instruction
 * 3. Authority signs transaction
 * 4. Transfer tokens to treasury
 * 5. Return transaction signature
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from 'npm:@solana/web3.js@1.98.4';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from 'npm:@solana/spl-token@0.3.11';

// TODO: Update with mainnet program ID when $SMOKE token is deployed
const PROGRAM_ID = new PublicKey('9NM3C5tGSANRzNdD3AohxszHntCGbYCPCreAtebpFEiF');
// TODO: Update with mainnet authority/treasury wallet when $SMOKE token is deployed
const AUTHORITY_PUBKEY = new PublicKey('Ws6mU44XByyeQk1rfptnwsAQxgMhdKVHAGT1GgndTAS');
// TODO: Update with mainnet $SMOKE token mint address when token is deployed
const SMOKE_MINT = new PublicKey('HiecAy5Mc4jQSYcVXtbTZRYujtX3KqY2VmhnaNUi8FwN');

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

// Deposit instruction discriminator (from IDL)
const DEPOSIT_DISCRIMINATOR = new Uint8Array([242, 35, 198, 137, 82, 225, 242, 182]);

serve(async (req) => {
  console.log(`[Request] ${req.method} ${req.url}`);

  // CORS headers
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
    // Parse request body
    let body;
    try {
      body = await req.json();
      console.log('[Request] Body parsed successfully');
    } catch (parseError) {
      console.error('[Request] JSON parse error:', parseError);
      throw new Error('Invalid JSON in request body');
    }

    const { amount } = body;
    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    console.log(`[Deposit Request] Amount: ${amount} $SMOKE`);

    // Setup Solana connection
    const rpcUrl = Deno.env.get('HELIUS_DEVNET_RPC') || 'https://api.mainnet-beta.solana.com';
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
      authorityKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(authorityPrivateKey)));
      console.log('[Authority] Keypair loaded successfully');
    } catch (keyError) {
      console.error('[Authority] Error parsing private key:', keyError);
      throw new Error('Server configuration error: Invalid authority wallet format');
    }

    // Derive treasury PDA
    const [treasuryState] = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode('treasury'), AUTHORITY_PUBKEY.toBuffer()],
      PROGRAM_ID
    );

    console.log(`[Treasury] PDA: ${treasuryState.toBase58()}`);

    // Get token accounts
    const treasuryTokenAccount = await getAssociatedTokenAddress(
      SMOKE_MINT,
      treasuryState,
      true // allowOwnerOffCurve
    );

    const authorityTokenAccount = await getAssociatedTokenAddress(
      SMOKE_MINT,
      authorityKeypair.publicKey
    );

    console.log(`[Token Accounts] Treasury: ${treasuryTokenAccount.toBase58()}`);
    console.log(`[Token Accounts] Authority: ${authorityTokenAccount.toBase58()}`);

    // Check authority token balance
    const authorityTokenAccountInfo = await connection.getAccountInfo(authorityTokenAccount);
    if (!authorityTokenAccountInfo) {
      throw new Error('Authority token account does not exist. Please create it first.');
    }

    // Check if treasury token account exists
    const treasuryTokenAccountInfo = await connection.getAccountInfo(treasuryTokenAccount);
    const needsTreasuryTokenAccount = !treasuryTokenAccountInfo;

    if (needsTreasuryTokenAccount) {
      console.log('[Token Account] Treasury token account does not exist, will create it');
    } else {
      console.log('[Token Account] Treasury token account already exists');
    }

    // Build transaction
    const transaction = new Transaction();

    // Add create token account instruction if needed
    if (needsTreasuryTokenAccount) {
      const createAccountIx = createAssociatedTokenAccountInstruction(
        authorityKeypair.publicKey, // payer (authority pays for treasury account)
        treasuryTokenAccount,
        treasuryState, // owner is the treasury PDA
        SMOKE_MINT
      );
      transaction.add(createAccountIx);
      console.log('[Transaction] Added create treasury token account instruction');
    }

    // Build deposit instruction
    // Convert amount to u64 little-endian bytes (Deno-compatible)
    const amountLamports = Math.floor(amount * 1e9);
    const amountBytes = new Uint8Array(8);
    const view = new DataView(amountBytes.buffer);
    view.setBigUint64(0, BigInt(amountLamports), true); // true = little-endian
    const data = concatUint8Arrays([DEPOSIT_DISCRIMINATOR, amountBytes]);

    const keys = [
      { pubkey: treasuryState, isSigner: false, isWritable: true },
      { pubkey: treasuryTokenAccount, isSigner: false, isWritable: true },
      { pubkey: authorityTokenAccount, isSigner: false, isWritable: true },
      { pubkey: authorityKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ];

    const depositIx = {
      keys,
      programId: PROGRAM_ID,
      data,
    };

    transaction.add(depositIx);

    // Set recent blockhash and fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = authorityKeypair.publicKey;

    // Authority signs transaction
    transaction.sign(authorityKeypair);

    console.log('[Transaction] Built and signed');

    // Send transaction
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    console.log('[Transaction] Sent:', signature);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      console.error('[Transaction] Failed:', confirmation.value.err);
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    console.log('[Success] Treasury funded successfully');

    return new Response(JSON.stringify({
      success: true,
      signature,
      amount,
      treasuryState: treasuryState.toBase58(),
      treasuryTokenAccount: treasuryTokenAccount.toBase58(),
      message: `Successfully funded treasury with ${amount} $SMOKE tokens.`,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('[Error]', error);

    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
});
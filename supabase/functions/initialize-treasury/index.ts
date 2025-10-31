/**
 * Initialize Treasury Edge Function
 *
 * This function initializes the treasury state account for the $SMOKE claim contract.
 * This is a one-time setup operation that creates the treasury PDA and funds it with
 * initial $SMOKE tokens for users to claim.
 *
 * Flow:
 * 1. Build treasury initialization instruction
 * 2. Authority (TEAM_WALLET) signs and pays for transaction
 * 3. Create treasury PDA account
 * 4. Fund treasury with initial $SMOKE tokens
 * 5. Return transaction signature
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from 'npm:@solana/web3.js@1.98.4';
import { TOKEN_PROGRAM_ID } from 'npm:@solana/spl-token@0.3.11';

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

// Initialize instruction discriminator (from IDL)
const INITIALIZE_DISCRIMINATOR = new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237]);

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
    const body = await req.json();
    console.log('[Request] Body parsed successfully');

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

    // Check if treasury state already exists
    const treasuryAccountInfo = await connection.getAccountInfo(treasuryState);
    if (treasuryAccountInfo) {
      throw new Error('Treasury state account is already initialized');
    }

    // Build transaction
    const transaction = new Transaction();

    // Build initialize instruction (matching IDL exactly)
    const data = concatUint8Arrays([INITIALIZE_DISCRIMINATOR]);

    const keys = [
      { pubkey: treasuryState, isSigner: false, isWritable: true },
      { pubkey: authorityKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const initializeIx = {
      keys,
      programId: PROGRAM_ID,
      data,
    };

    transaction.add(initializeIx);

    // Set recent blockhash and fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = authorityKeypair.publicKey;

    // Authority signs and sends transaction
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

    console.log('[Success] Treasury initialized successfully');

    return new Response(JSON.stringify({
      success: true,
      signature,
      treasuryState: treasuryState.toBase58(),
      message: 'Treasury initialized successfully! Users can now claim $SMOKE tokens.',
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
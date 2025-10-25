/**
 * Minimal test function to isolate the exact cause of claim-smoke failures
 * Tests each component individually to find the runtime error
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

console.log('[Test] Function starting...');

serve(async (req) => {
  console.log(`[Test] ${req.method} ${req.url}`);

  // CORS headers
  if (req.method === 'OPTIONS') {
    console.log('[Test] CORS OPTIONS request');
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    console.log('[Test] Starting component tests...');

    // Test 1: Basic environment variables
    console.log('[Test] Testing environment variables...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const teamWallet = Deno.env.get('TEAM_WALLET');

    console.log('[Test] SUPABASE_URL exists:', !!supabaseUrl);
    console.log('[Test] TEAM_WALLET exists:', !!teamWallet);

    // Test 2: Buffer operations
    console.log('[Test] Testing Buffer operations...');
    const testBuffer = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210]);
    console.log('[Test] Buffer created successfully, length:', testBuffer.length);

    // Test 3: Import Solana libraries (this is likely where it fails)
    console.log('[Test] Testing Solana imports...');
    const { PublicKey } = await import('npm:@solana/web3.js@1.98.4');
    console.log('[Test] Solana web3.js imported successfully');

    const testPubkey = new PublicKey('9NM3C5tGSANRzNdD3AohxszHntCGbYCPCreAtebpFEiF');
    console.log('[Test] PublicKey created successfully:', testPubkey.toBase58());

    // Test 4: Import SPL Token
    console.log('[Test] Testing SPL token imports...');
    const { getAssociatedTokenAddress } = await import('npm:@solana/spl-token@0.3.11');
    console.log('[Test] SPL token imported successfully');

    // Test 5: Import BN.js
    console.log('[Test] Testing BN.js imports...');
    const { BN } = await import('npm:bn.js@5.2.1');
    console.log('[Test] BN.js imported successfully');

    const testBN = new BN(1000);
    console.log('[Test] BN created successfully:', testBN.toString());

    // Test 6: Test TEAM_WALLET parsing if it exists
    if (teamWallet) {
      console.log('[Test] Testing TEAM_WALLET parsing...');
      const { Keypair } = await import('npm:@solana/web3.js@1.98.4');

      try {
        const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(teamWallet)));
        console.log('[Test] TEAM_WALLET parsed successfully, pubkey:', keypair.publicKey.toBase58());
      } catch (keyError) {
        console.error('[Test] TEAM_WALLET parsing failed:', keyError);
        throw new Error(`TEAM_WALLET parsing failed: ${keyError.message}`);
      }
    }

    console.log('[Test] All tests passed successfully!');

    return new Response(JSON.stringify({
      success: true,
      message: 'All tests passed',
      tests: {
        environment: !!supabaseUrl && !!teamWallet,
        buffer: true,
        solanaImport: true,
        splTokenImport: true,
        bnjsImport: true,
        teamWalletParsed: !!teamWallet
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('[Test] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
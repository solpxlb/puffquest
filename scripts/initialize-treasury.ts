/**
 * Treasury Initialization Script
 *
 * This script initializes the smart contract treasury on Solana Devnet.
 * Run this ONCE after deploying the contract.
 *
 * Usage:
 *   npx ts-node scripts/initialize-treasury.ts
 *
 * Requirements:
 *   - AUTHORITY_PRIVATE_KEY environment variable set
 *   - At least 0.01 SOL in authority wallet for rent
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

// Constants
const PROGRAM_ID = new PublicKey('9NM3C5tGSANRzNdD3AohxszHntCGbYCPCreAtebpFEiF');
const AUTHORITY_PUBKEY = new PublicKey('Ws6mU44XByyeQk1rfptnwsAQxgMhdKVHAGT1GgndTAS');
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';

// Initialize discriminator for "initialize" instruction
const INITIALIZE_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

async function initializeTreasury() {
  console.log('🚀 Starting treasury initialization...\n');

  // 1. Load authority keypair
  const authorityPrivateKey = process.env.AUTHORITY_PRIVATE_KEY;
  if (!authorityPrivateKey) {
    throw new Error('❌ AUTHORITY_PRIVATE_KEY environment variable not set');
  }

  let authorityKeypair: Keypair;
  try {
    authorityKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(authorityPrivateKey)));
    console.log('✅ Authority keypair loaded');
    console.log(`   Public key: ${authorityKeypair.publicKey.toBase58()}`);
  } catch (error) {
    throw new Error('❌ Failed to parse AUTHORITY_PRIVATE_KEY. Ensure it is a valid JSON array.');
  }

  // Verify authority matches expected
  if (authorityKeypair.publicKey.toBase58() !== AUTHORITY_PUBKEY.toBase58()) {
    throw new Error(
      `❌ Authority mismatch!\n` +
      `   Expected: ${AUTHORITY_PUBKEY.toBase58()}\n` +
      `   Got:      ${authorityKeypair.publicKey.toBase58()}`
    );
  }

  // 2. Connect to Solana
  const connection = new Connection(RPC_URL, 'confirmed');
  console.log(`✅ Connected to ${RPC_URL}\n`);

  // 3. Check authority balance
  const balance = await connection.getBalance(authorityKeypair.publicKey);
  console.log(`💰 Authority balance: ${balance / 1e9} SOL`);
  if (balance < 10_000_000) { // 0.01 SOL
    throw new Error('❌ Insufficient balance. Need at least 0.01 SOL for initialization.');
  }

  // 4. Derive treasury PDA
  const [treasuryState, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury'), AUTHORITY_PUBKEY.toBuffer()],
    PROGRAM_ID
  );

  console.log(`\n📍 Treasury State PDA: ${treasuryState.toBase58()}`);
  console.log(`   Bump: ${bump}\n`);

  // 5. Check if already initialized
  const accountInfo = await connection.getAccountInfo(treasuryState);
  if (accountInfo) {
    console.log('⚠️  Treasury already initialized!');
    console.log(`   Owner: ${accountInfo.owner.toBase58()}`);
    console.log(`   Data length: ${accountInfo.data.length} bytes`);
    console.log(`   Lamports: ${accountInfo.lamports / 1e9} SOL`);

    // Parse TreasuryState data if it exists
    if (accountInfo.data.length >= 73) {
      const authority = new PublicKey(accountInfo.data.slice(8, 40));
      const stateBump = accountInfo.data[40];
      const totalClaims = accountInfo.data.readBigUInt64LE(41);
      const totalFeesCollected = accountInfo.data.readBigUInt64LE(49);

      console.log(`\n📊 Treasury State:`);
      console.log(`   Authority: ${authority.toBase58()}`);
      console.log(`   Bump: ${stateBump}`);
      console.log(`   Total Claims: ${totalClaims}`);
      console.log(`   Total Fees Collected: ${Number(totalFeesCollected) / 1e9} SOL`);
    }

    return;
  }

  // 6. Build initialize instruction
  const keys = [
    { pubkey: treasuryState, isSigner: false, isWritable: true },
    { pubkey: authorityKeypair.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const initializeIx = {
    keys,
    programId: PROGRAM_ID,
    data: INITIALIZE_DISCRIMINATOR,
  };

  // 7. Build and send transaction
  const transaction = new Transaction().add(initializeIx);
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = authorityKeypair.publicKey;

  console.log('📝 Sending initialize transaction...');

  try {
    const signature = await connection.sendTransaction(transaction, [authorityKeypair], {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    console.log(`   Signature: ${signature}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);

    // 8. Confirm transaction
    console.log('⏳ Confirming transaction...');
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log('✅ Transaction confirmed!\n');

    // 9. Verify treasury state
    const verifyAccountInfo = await connection.getAccountInfo(treasuryState);
    if (!verifyAccountInfo) {
      throw new Error('❌ Treasury state account was not created');
    }

    console.log('✅ Treasury successfully initialized!');
    console.log(`\n📋 Summary:`);
    console.log(`   Program ID: ${PROGRAM_ID.toBase58()}`);
    console.log(`   Treasury PDA: ${treasuryState.toBase58()}`);
    console.log(`   Authority: ${AUTHORITY_PUBKEY.toBase58()}`);
    console.log(`   Transaction: ${signature}`);
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Create treasury token account for $SMOKE`);
    console.log(`   2. Mint $SMOKE tokens to authority`);
    console.log(`   3. Run scripts/setup-treasury.ts to deposit tokens\n`);

  } catch (error: unknown) {
    console.error('❌ Transaction failed:', error);
    if (error && typeof error === 'object' && 'logs' in error) {
      console.error('\n📜 Transaction logs:');
      (error.logs as string[]).forEach((log: string) => console.error(`   ${log}`));
    }
    throw error;
  }
}

// Run the script
initializeTreasury()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('\n❌ Initialization failed:', message);
    process.exit(1);
  });

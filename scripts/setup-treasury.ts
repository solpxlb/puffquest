/**
 * Treasury Setup & Deposit Script
 *
 * This script deposits $SMOKE tokens into the treasury for user claims.
 * Run this after initializing the treasury.
 *
 * Usage:
 *   npx ts-node scripts/setup-treasury.ts <amount>
 *
 * Example:
 *   npx ts-node scripts/setup-treasury.ts 1000000  # Deposit 1M $SMOKE
 *
 * Requirements:
 *   - AUTHORITY_PRIVATE_KEY environment variable set
 *   - SMOKE_MINT environment variable set (token mint address)
 *   - Treasury already initialized (run initialize-treasury.ts first)
 *   - Authority wallet has sufficient $SMOKE tokens
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as dotenv from 'dotenv';
import { BN } from 'bn.js';

dotenv.config();

// Constants
const PROGRAM_ID = new PublicKey('9NM3C5tGSANRzNdD3AohxszHntCGbYCPCreAtebpFEiF');
const AUTHORITY_PUBKEY = new PublicKey('Ws6mU44XByyeQk1rfptnwsAQxgMhdKVHAGT1GgndTAS');
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';

// Deposit discriminator for "deposit" instruction
const DEPOSIT_DISCRIMINATOR = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);

async function setupTreasury() {
  console.log('🚀 Starting treasury setup and deposit...\n');

  // 1. Parse command line arguments
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('❌ Usage: npx ts-node scripts/setup-treasury.ts <amount>');
    console.error('   Example: npx ts-node scripts/setup-treasury.ts 1000000');
    process.exit(1);
  }

  const depositAmount = parseFloat(args[0]);
  if (isNaN(depositAmount) || depositAmount <= 0) {
    throw new Error('❌ Invalid amount. Must be a positive number.');
  }

  console.log(`💰 Deposit amount: ${depositAmount.toLocaleString()} $SMOKE\n`);

  // 2. Load environment variables
  const authorityPrivateKey = process.env.AUTHORITY_PRIVATE_KEY;
  const smokeMintStr = process.env.SMOKE_MINT;

  if (!authorityPrivateKey) {
    throw new Error('❌ AUTHORITY_PRIVATE_KEY environment variable not set');
  }

  if (!smokeMintStr) {
    throw new Error('❌ SMOKE_MINT environment variable not set');
  }

  // 3. Load authority keypair
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

  // 4. Parse token mint
  const smokeMint = new PublicKey(smokeMintStr);
  console.log(`✅ $SMOKE Mint: ${smokeMint.toBase58()}\n`);

  // 5. Connect to Solana
  const connection = new Connection(RPC_URL, 'confirmed');
  console.log(`✅ Connected to ${RPC_URL}\n`);

  // 6. Derive treasury PDA
  const [treasuryState] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury'), AUTHORITY_PUBKEY.toBuffer()],
    PROGRAM_ID
  );

  console.log(`📍 Treasury State PDA: ${treasuryState.toBase58()}\n`);

  // 7. Verify treasury is initialized
  const treasuryAccount = await connection.getAccountInfo(treasuryState);
  if (!treasuryAccount) {
    throw new Error('❌ Treasury not initialized. Run initialize-treasury.ts first.');
  }
  console.log('✅ Treasury is initialized\n');

  // 8. Get token accounts
  const authorityTokenAccount = await getAssociatedTokenAddress(
    smokeMint,
    authorityKeypair.publicKey
  );

  const treasuryTokenAccount = await getAssociatedTokenAddress(
    smokeMint,
    treasuryState,
    true // allowOwnerOffCurve
  );

  console.log(`📍 Authority Token Account: ${authorityTokenAccount.toBase58()}`);
  console.log(`📍 Treasury Token Account: ${treasuryTokenAccount.toBase58()}\n`);

  // 9. Check if authority has tokens
  try {
    const authorityTokenInfo = await connection.getTokenAccountBalance(authorityTokenAccount);
    const currentBalance = parseFloat(authorityTokenInfo.value.amount) / 1e9;
    console.log(`💰 Authority current balance: ${currentBalance.toLocaleString()} $SMOKE`);

    if (currentBalance < depositAmount) {
      throw new Error(
        `❌ Insufficient balance. Need ${depositAmount.toLocaleString()} $SMOKE, have ${currentBalance.toLocaleString()}`
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('could not find account')) {
      throw new Error('❌ Authority token account not found. Mint tokens to authority first.');
    }
    throw error;
  }

  // 10. Check if treasury token account exists
  const transaction = new Transaction();
  let needsTreasuryAccount = false;

  try {
    await connection.getAccountInfo(treasuryTokenAccount);
    console.log('✅ Treasury token account exists\n');
  } catch (error) {
    needsTreasuryAccount = true;
    console.log('⚠️  Treasury token account does not exist, will create\n');

    const createAccountIx = createAssociatedTokenAccountInstruction(
      authorityKeypair.publicKey, // payer
      treasuryTokenAccount,
      treasuryState, // owner
      smokeMint
    );

    transaction.add(createAccountIx);
  }

  // 11. Build deposit instruction
  const amountBN = new BN(depositAmount * 1e9);
  const data = Buffer.concat([DEPOSIT_DISCRIMINATOR, amountBN.toArrayLike(Buffer, 'le', 8)]);

  const keys = [
    { pubkey: treasuryState, isSigner: false, isWritable: false },
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

  // 12. Send transaction
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = authorityKeypair.publicKey;

  console.log('📝 Sending deposit transaction...');

  try {
    const signature = await connection.sendTransaction(transaction, [authorityKeypair], {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    console.log(`   Signature: ${signature}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);

    // 13. Confirm transaction
    console.log('⏳ Confirming transaction...');
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log('✅ Transaction confirmed!\n');

    // 14. Verify balances
    const treasuryBalance = await connection.getTokenAccountBalance(treasuryTokenAccount);
    const newAuthorityBalance = await connection.getTokenAccountBalance(authorityTokenAccount);

    console.log('✅ Deposit successful!\n');
    console.log(`📊 Updated Balances:`);
    console.log(`   Treasury: ${(parseFloat(treasuryBalance.value.amount) / 1e9).toLocaleString()} $SMOKE`);
    console.log(
      `   Authority: ${(parseFloat(newAuthorityBalance.value.amount) / 1e9).toLocaleString()} $SMOKE`
    );
    console.log(`\n💡 Treasury is now ready for user claims!`);
    console.log(`   Transaction: ${signature}\n`);

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
setupTreasury()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('\n❌ Setup failed:', message);
    process.exit(1);
  });

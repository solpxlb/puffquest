/**
 * Smoke Claim Contract Utilities
 *
 * Helper functions for interacting with the $SMOKE claim smart contract
 */

import { PublicKey, Connection, Transaction, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, getAccount } from '@solana/spl-token';

// TODO: Update with mainnet program ID when $SMOKE token is deployed
export const SMOKE_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_SMOKE_PROGRAM_ID || '9NM3C5tGSANRzNdD3AohxszHntCGbYCPCreAtebpFEiF'
);

// TODO: Update with mainnet authority/treasury wallet when $SMOKE token is deployed
export const AUTHORITY_PUBKEY = new PublicKey('Ws6mU44XByyeQk1rfptnwsAQxgMhdKVHAGT1GgndTAS');

// TODO: Update with mainnet $SMOKE token mint address when token is deployed
export const SMOKE_MINT = new PublicKey(
  import.meta.env.VITE_SMOKE_MINT || ''
);

export const CLAIM_FEE_SOL = 0.02;
export const MIN_SOL_REQUIRED = 0.025; // Fee + gas + rent
export const SMOKE_TOKEN_DECIMALS = 9; // Assuming $SMOKE uses 9 decimals like SOL

/**
 * Derive the treasury PDA (Program Derived Address)
 */
export function getTreasuryPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('treasury'), AUTHORITY_PUBKEY.toBuffer()],
    SMOKE_PROGRAM_ID
  );
}

/**
 * Get the treasury token account address
 */
export async function getTreasuryTokenAccount(): Promise<PublicKey> {
  const [treasuryState] = getTreasuryPDA();
  return getAssociatedTokenAddress(SMOKE_MINT, treasuryState, true);
}

/**
 * Get the user's token account address
 */
export async function getUserTokenAccount(userWallet: PublicKey): Promise<PublicKey> {
  return getAssociatedTokenAddress(SMOKE_MINT, userWallet);
}

/**
 * Check if user has sufficient SOL for claim
 */
export async function checkUserSolBalance(
  connection: Connection,
  userWallet: PublicKey
): Promise<{ sufficient: boolean; balance: number; required: number }> {
  const balance = await connection.getBalance(userWallet);
  const balanceInSol = balance / 1e9;

  return {
    sufficient: balanceInSol >= MIN_SOL_REQUIRED,
    balance: balanceInSol,
    required: MIN_SOL_REQUIRED,
  };
}

/**
 * Get the treasury state account info
 */
export async function getTreasuryState(connection: Connection) {
  const [treasuryPDA] = getTreasuryPDA();
  const accountInfo = await connection.getAccountInfo(treasuryPDA);

  if (!accountInfo) {
    return null;
  }

  // Parse TreasuryState data
  // struct TreasuryState {
  //   authority: Pubkey (32 bytes)
  //   bump: u8 (1 byte)
  //   total_claims: u64 (8 bytes)
  //   total_fees_collected: u64 (8 bytes)
  // }
  const data = accountInfo.data;

  if (data.length < 57) {
    return null;
  }

  const authority = new PublicKey(data.slice(8, 40)); // Skip 8-byte discriminator
  const bump = data[40];
  const totalClaims = data.readBigUInt64LE(41);
  const totalFeesCollected = data.readBigUInt64LE(49);

  return {
    address: treasuryPDA.toBase58(),
    authority: authority.toBase58(),
    bump,
    totalClaims: Number(totalClaims),
    totalFeesCollected: Number(totalFeesCollected) / 1e9, // Convert to SOL
  };
}

/**
 * Format error messages for better user experience
 */
export function formatClaimError(error: unknown): string {
  const errorMessage = error instanceof Error
    ? error.message
    : (typeof error === 'string' ? error : 'Unknown error');

  // Common error patterns
  if (errorMessage.includes('User rejected')) {
    return 'Transaction cancelled. Please try again when ready.';
  }

  if (errorMessage.includes('Insufficient SOL')) {
    return 'You need at least 0.025 SOL to claim. Please add SOL to your wallet.';
  }

  if (errorMessage.includes('No tokens to claim')) {
    return 'You have no $SMOKE tokens to claim. Earn more by puffing!';
  }

  if (errorMessage.includes('InsufficientTreasuryBalance')) {
    return 'Treasury has insufficient tokens. Please contact support.';
  }

  if (errorMessage.includes('InvalidAmount')) {
    return 'Invalid claim amount. Please try again.';
  }

  if (errorMessage.includes('failed to send transaction')) {
    return 'Network error. Please check your connection and try again.';
  }

  if (errorMessage.includes('blockhash not found')) {
    return 'Transaction expired. Please try again.';
  }

  // Default to original message
  return errorMessage;
}

/**
 * Generate Solana Explorer URL for a transaction
 */
export function getExplorerUrl(signature: string, cluster: 'mainnet-beta' | 'devnet' = 'mainnet-beta'): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}

/**
 * Wait for transaction confirmation with timeout
 */
export async function confirmTransactionWithTimeout(
  connection: Connection,
  signature: string,
  timeoutMs: number = 60000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const status = await connection.getSignatureStatus(signature);

      if (status?.value?.confirmationStatus === 'confirmed' ||
          status?.value?.confirmationStatus === 'finalized') {
        return true;
      }

      if (status?.value?.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
      }
    } catch (error) {
      console.error('Error checking transaction status:', error);
    }

    // Wait 1 second before checking again
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Transaction confirmation timeout');
}

/**
 * Create a transfer instruction to send $SMOKE tokens from user to treasury
 */
export async function createTransferToTreasuryInstruction(
  userWallet: PublicKey,
  amount: number
): Promise<TransactionInstruction> {
  if (!SMOKE_MINT) {
    throw new Error('SMOKE_MINT not configured');
  }

  // Convert amount to token units (accounting for decimals)
  const amountInTokens = Math.floor(amount * Math.pow(10, SMOKE_TOKEN_DECIMALS));

  // Get user token account
  const userTokenAccount = await getAssociatedTokenAddress(SMOKE_MINT, userWallet);

  // Get treasury token account
  const treasuryTokenAccount = await getTreasuryTokenAccount();

  // Create transfer instruction
  return createTransferInstruction(
    userTokenAccount,    // from
    treasuryTokenAccount, // to
    userWallet,         // owner
    amountInTokens      // amount
  );
}

/**
 * Check if a transaction signature already exists and was processed
 */
export async function checkTransactionStatus(
  connection: Connection,
  signature: string
): Promise<{ exists: boolean; confirmed: boolean; error?: string }> {
  try {
    const status = await connection.getSignatureStatus(signature);

    if (!status.value) {
      return { exists: false, confirmed: false };
    }

    return {
      exists: true,
      confirmed: status.value.confirmationStatus === 'confirmed' || status.value.confirmationStatus === 'finalized',
      error: status.value.err ? JSON.stringify(status.value.err) : undefined
    };
  } catch (error) {
    // If transaction not found, it doesn't exist
    return { exists: false, confirmed: false };
  }
}

/**
 * Create and sign a transaction to transfer $SMOKE tokens to treasury
 */
export async function transferSmokeToTreasury(
  connection: Connection,
  userWallet: PublicKey,
  signTransaction: (transaction: Transaction) => Promise<Transaction>,
  amount: number,
  existingSignature?: string
): Promise<{ signature: string; transaction: Transaction }> {
  // If we have an existing signature, check if it was already processed
  if (existingSignature) {
    const status = await checkTransactionStatus(connection, existingSignature);
    if (status.exists && status.confirmed && !status.error) {
      console.log("Transaction already confirmed:", existingSignature);
      // Return a dummy transaction since the real one was already processed
      const dummyTransaction = new Transaction();
      return { signature: existingSignature, transaction: dummyTransaction };
    }
  }

  // Create transfer instruction
  const transferInstruction = await createTransferToTreasuryInstruction(userWallet, amount);

  // Create transaction
  const transaction = new Transaction().add(transferInstruction);

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;

  // Set fee payer (user wallet)
  transaction.feePayer = userWallet;

  // Sign transaction
  const signedTransaction = await signTransaction(transaction);

  // Send transaction
  const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed'
  });

  // Wait for confirmation
  await confirmTransactionWithTimeout(connection, signature);

  return { signature, transaction: signedTransaction };
}

/**
 * Check if user has sufficient $SMOKE token balance
 */
export async function checkUserSmokeBalance(
  connection: Connection,
  userWallet: PublicKey,
  requiredAmount: number
): Promise<{ sufficient: boolean; balance: number; required: number }> {
  try {
    if (!SMOKE_MINT) {
      return { sufficient: false, balance: 0, required: requiredAmount };
    }

    const userTokenAccount = await getAssociatedTokenAddress(SMOKE_MINT, userWallet);

    try {
      const accountInfo = await getAccount(connection, userTokenAccount);
      const balance = Number(accountInfo.amount) / Math.pow(10, SMOKE_TOKEN_DECIMALS);

      return {
        sufficient: balance >= requiredAmount,
        balance,
        required: requiredAmount
      };
    } catch (error) {
      // Token account doesn't exist
      return {
        sufficient: false,
        balance: 0,
        required: requiredAmount
      };
    }
  } catch (error) {
    console.error('Error checking smoke balance:', error);
    return {
      sufficient: false,
      balance: 0,
      required: requiredAmount
    };
  }
}

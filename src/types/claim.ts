/**
 * Type definitions for $SMOKE claim functionality
 */

export interface ClaimTransaction {
  id: string;
  user_id: string;
  wallet_address: string;
  amount: number;
  transaction_signature: string | null;
  fee_paid: number;
  status: 'pending' | 'confirmed' | 'failed';
  error_message?: string;
  created_at: string;
  confirmed_at?: string;
}

export interface ClaimResponse {
  success: boolean;
  transaction?: string; // Base64 encoded transaction
  amount?: number;
  fee?: number;
  message?: string;
  treasury_address?: string;
  error?: string;
}

export interface VerifyClaimResponse {
  success: boolean;
  message?: string;
  amount_claimed?: number;
  transaction_signature?: string;
  explorer_url?: string;
  already_processed?: boolean;
  error?: string;
}

export interface ClaimState {
  isLoading: boolean;
  step: 'idle' | 'preparing' | 'signing' | 'confirming' | 'verifying' | 'success' | 'error';
  error: string | null;
  signature: string | null;
  explorerUrl: string | null;
}

export const CLAIM_STEP_LABELS: Record<ClaimState['step'], string> = {
  idle: 'Ready to claim',
  preparing: 'Preparing claim transaction...',
  signing: 'Please sign the transaction in your wallet',
  confirming: 'Confirming transaction on blockchain...',
  verifying: 'Verifying claim...',
  success: 'Claim successful!',
  error: 'Claim failed',
};

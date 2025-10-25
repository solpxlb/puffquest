-- Create upgrade_transactions table for idempotency tracking
CREATE TABLE IF NOT EXISTS upgrade_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    device_type TEXT NOT NULL CHECK (device_type IN ('vape', 'cigarette', 'cigar')),
    old_level INTEGER NOT NULL CHECK (old_level >= 0),
    new_level INTEGER NOT NULL CHECK (new_level > 0),
    transaction_signature TEXT NOT NULL UNIQUE,
    upgrade_cost DECIMAL(10,4) NOT NULL CHECK (upgrade_cost >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_upgrade_transactions_user_id ON upgrade_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_transactions_wallet_address ON upgrade_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_upgrade_transactions_signature ON upgrade_transactions(transaction_signature);
CREATE INDEX IF NOT EXISTS idx_upgrade_transactions_created_at ON upgrade_transactions(created_at);

-- Create policy for row-level security
ALTER TABLE upgrade_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own upgrade transactions
CREATE POLICY "Users can view own upgrade transactions" ON upgrade_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert transactions (via Supabase functions)
CREATE POLICY "Service role can insert upgrade transactions" ON upgrade_transactions
    FOR INSERT WITH CHECK (true);

-- Users cannot update or delete upgrade transactions
CREATE POLICY "No direct updates to upgrade transactions" ON upgrade_transactions
    FOR UPDATE USING (false);

CREATE POLICY "No direct deletes to upgrade transactions" ON upgrade_transactions
    FOR DELETE USING (false);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_upgrade_transactions_updated_at
    BEFORE UPDATE ON upgrade_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
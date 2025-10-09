-- Step 1: Drop existing RLS policies that use auth.uid()
DROP POLICY IF EXISTS "Users can create own sessions" ON puff_sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON puff_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON puff_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON puff_sessions;
DROP POLICY IF EXISTS "Users can create own puff events" ON puff_events;
DROP POLICY IF EXISTS "Users can view own puff events" ON puff_events;
DROP POLICY IF EXISTS "Users can view own purchases" ON vice_purchases;

-- Step 2: Drop all foreign key constraints
ALTER TABLE puff_sessions DROP CONSTRAINT IF EXISTS puff_sessions_user_id_fkey;
ALTER TABLE puff_events DROP CONSTRAINT IF EXISTS puff_events_user_id_fkey;
ALTER TABLE vice_purchases DROP CONSTRAINT IF EXISTS vice_purchases_user_id_fkey;

-- Step 3: Change user_id columns from UUID to TEXT
ALTER TABLE puff_sessions ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE puff_events ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE vice_purchases ALTER COLUMN user_id TYPE TEXT;

-- Step 4: Update existing vice_purchases to use wallet_address from profiles
UPDATE vice_purchases vp
SET user_id = p.wallet_address
FROM profiles p
WHERE vp.user_id::uuid = p.id
AND p.wallet_address IS NOT NULL
AND p.wallet_address != '';

-- Step 5: Delete vice_purchases that can't be mapped (optional - or set to null if you want to keep them)
DELETE FROM vice_purchases 
WHERE user_id NOT IN (SELECT wallet_address FROM profiles WHERE wallet_address IS NOT NULL);

-- Step 6: Add foreign key to profiles.wallet_address for vice_purchases
ALTER TABLE vice_purchases 
ADD CONSTRAINT vice_purchases_wallet_address_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(wallet_address) ON DELETE CASCADE;

-- Step 7: Create new RLS policies that work with wallet addresses
-- For puff_sessions
CREATE POLICY "Anyone can create sessions"
  ON puff_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own sessions"
  ON puff_sessions FOR SELECT
  USING (true);

CREATE POLICY "Users can update own sessions"
  ON puff_sessions FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete own sessions"
  ON puff_sessions FOR DELETE
  USING (true);

-- For puff_events
CREATE POLICY "Anyone can create puff events"
  ON puff_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view puff events"
  ON puff_events FOR SELECT
  USING (true);

-- For vice_purchases
CREATE POLICY "Users can view purchases"
  ON vice_purchases FOR SELECT
  USING (true);

-- Add comments for documentation
COMMENT ON COLUMN puff_sessions.user_id IS 'Solana wallet address (base58 encoded)';
COMMENT ON COLUMN puff_events.user_id IS 'Solana wallet address (base58 encoded)';
COMMENT ON COLUMN vice_purchases.user_id IS 'Solana wallet address (base58 encoded)';
🎮 Puff Quest - Complete Project Overview
📊 Project Summary
Puff Quest is a Solana-based play-to-earn web application that uses AI-powered facial recognition to detect "puff" actions via webcam, rewarding users with $SMOKE tokens. It combines blockchain technology, computer vision, and gamification mechanics to create a unique "Smokernomics" ecosystem.

🏗️ Tech Stack
Frontend
React 18 + TypeScript
Vite (build tool)
Tailwind CSS + shadcn/ui (UI components)
React Router (navigation)
TanStack Query (data fetching/caching)
Blockchain
Solana Web3.js (blockchain integration)
Solana Wallet Adapter (wallet connectivity - Phantom, Solflare, etc.)
Solana Devnet (testing environment)
Backend & Database
Supabase (PostgreSQL database + authentication)
Supabase Edge Functions (serverless backend logic)
Row-Level Security (RLS) policies for data protection
AI/ML
MediaPipe Face Landmarker (Google's computer vision library)
Custom puff detection algorithm analyzing facial landmarks
🎯 Core Systems Implemented
1. Authentication System (src/hooks/useSolanaAuth.ts)
Features:

Solana wallet connection (Phantom, Solflare, etc.)
Web3 sign-in with Supabase authentication
Session persistence via localStorage
Automatic wallet address sync to user profiles
Auth state management with real-time listeners
Flow:

User connects Solana wallet → Wallet Adapter
Sign authentication message → signInWithWeb3
Create/retrieve Supabase user session
Sync wallet address to profiles table
2. Purchase & Onboarding System (src/components/play/PurchaseGate.tsx)
Vice Purchase Mechanics:

3 Device Types: Vape, Cigarette, Cigar
Price: 0.2 SOL each (Devnet SOL)
Multi-selection: Users can buy multiple devices
Blockchain verification via Edge Function
Purchase Flow:


graph TD
    A[Select Vices] --> B[Pay SOL via Wallet]
    B --> C[Transaction Sent to Solana]
    C --> D[Edge Function: purchase-vices]
    D --> E{Verify Transaction}
    E -->|Valid| F[Update Profile: vices array]
    F --> G[Initialize device_levels to Level 1]
    G --> H[Record in vice_purchases table]
    E -->|Invalid| I[Return Error]
Edge Function: purchase-vices

Verifies transaction on Solana blockchain
Validates sender, recipient (team wallet), and amount
Prevents duplicate purchases via transaction signature
Initializes device levels to 1 for purchased vices
Records purchase in vice_purchases table
3. AI Puff Detection System
Components:

MediaPipe Setup (src/lib/MediaPipeSetup.ts)
Puff Detection Hook (src/hooks/usePuffDetection.ts)
Camera Tracker UI (src/components/play/CameraTracker.tsx)
How It Works:


sequenceDiagram
    participant User
    participant Camera
    participant MediaPipe
    participant Algorithm
    participant Database

    User->>Camera: Enable Webcam
    Camera->>MediaPipe: Stream Video Frames
    MediaPipe->>Algorithm: Extract 478 Face Landmarks
    Algorithm->>Algorithm: Analyze Mouth Metrics
    Note over Algorithm: - Mouth aspect ratio<br/>- Lip pursing<br/>- Cheek puff<br/>- Jaw open
    Algorithm->>Algorithm: Calculate Confidence Score
    alt Confidence ≥ 90%
        Algorithm->>User: 🔥 PUFF DETECTED!
        Algorithm->>Database: Award $SMOKE
    else Confidence < 90%
        Algorithm->>MediaPipe: Continue Monitoring
    end
Detection Metrics:

Mouth Height/Width/Aspect Ratio
Lip Pursing (mouth corners movement)
Cheek Puff (blendshape analysis)
Jaw Open (mouth opening detection)
Sequence Score (historical pattern analysis)
Confidence Thresholds:

≥ 90%: Puff detected (4-second cooldown)
70-89%: High confidence (visual warning)
50-69%: Medium confidence
< 50%: Low confidence
Visual Feedback:

Real-time facial landmark overlay
Color-coded confidence bar
Metric display on canvas
"🔥 PUFF DETECTED!" flash animation
4. $SMOKE Token Economy (src/lib/GameEconomy.ts)
Direct $SMOKE Rewards System (recently migrated from points)

Earning Mechanics
Active Earnings (per puff):


calculatePuffSmoke(deviceLevels, globalStats, isActiveSession)
Base Formula:

baseSmoke = 10 (for Vape Level 1)
           + 15 (for Cigarette Level 1)  
           + 25 (for Cigar Level 1)
Multipliers Applied:

Device Level Multiplier: (currentLevel / 2)

Level 1: 0.5×
Level 3: 1.5×
Level 5: 2.5×
Early Adopter Bonus:

< 50 players: 1.2×
50-99 players: 1.0×
≥ 100 players: Deflation kicks in
Active Session Multiplier: 2.5× (when tracking is on)

Deflation Factor:


if (totalPlayers >= 100) {
  deflationFactor = max(0.1, 1 - ((totalPlayers - 100) * 0.002))
}
At 100 players: 1.0×
At 200 players: 0.8×
At 550 players: 0.1× (maximum deflation)
Example Earnings:

Level 1 Vape (< 50 players, active session):

10 × 0.5 × 1.2 × 2.5 = 15 $SMOKE per puff
All 3 devices at Level 5 (< 50 players, active session):

(10 + 15 + 25) × 2.5 × 1.2 × 2.5 = 375 $SMOKE per puff
Passive Income (per hour):


calculatePassiveIncome(deviceLevels, globalStats, hoursSinceLastClaim)
Vape: 10 $SMOKE/hr per level (starts at Level 2)
Cigarette: 15 $SMOKE/hr per level
Cigar: 25 $SMOKE/hr per level
Capped: Maximum 24 hours of accumulation
Deflation: Same formula as active earnings
Example:

Level 5 Vape: (5 - 1) × 10 = 40 $SMOKE/hr
Level 5 Cigarette: (5 - 1) × 15 = 60 $SMOKE/hr
Level 5 Cigar: (5 - 1) × 25 = 100 $SMOKE/hr
Total: 200 $SMOKE/hr (before deflation)
Upgrade System
Cost Formula:


getUpgradeCost(currentLevel) = 2^(currentLevel - 2)
Upgrade Costs:

Level 1 → 2: FREE (first upgrade)
Level 2 → 3: 1 $SMOKE
Level 3 → 4: 2 $SMOKE
Level 4 → 5: 4 $SMOKE
Level 5 → 6: 8 $SMOKE
Level 6 → 7: 16 $SMOKE
Level 7 → 8: 32 $SMOKE
Level 8 → 9: 64 $SMOKE
Level 9 → 10: 128 $SMOKE
Total cost to max level (1 → 10): 255 $SMOKE per device

Edge Function: upgrade-device

Validates device ownership and level
Checks $SMOKE balance
Updates device_levels in profile
Deducts cost from smoke_balance
Logs transaction in smoke_transactions
Streak System

getStreakMultiplier(streakDays)
1-6 days: 1.0×
7-13 days: 1.1×
14-29 days: 1.2×
30+ days: 1.5×
(Not yet fully integrated into UI)

Token Economics
$SMOKE Distribution:

Initial Pool: 45,000,000 $SMOKE
Circulating Supply: 40,000,000 $SMOKE
Team Allocation: 5,000,000 $SMOKE
Depletion Rate (with current mechanics):

With 100 users earning ~13,935 $SMOKE/day each:
Pool lasts ~32 days
Fast depletion = FOMO mechanic (Option A chosen)
5. Session Management System (src/pages/Play.tsx)
Session Lifecycle:


stateDiagram-v2
    [*] --> Idle
    Idle --> Active: Start Tracking
    Active --> Recording: Puff Detected
    Recording --> Active: Continue
    Active --> Completed: Stop Session
    Completed --> [*]
Session Tracking:

puff_sessions table stores:
session_id (UUID)
user_id (wallet address)
started_at / ended_at timestamps
puff_count (number of puffs)
smoke_earned (total $SMOKE in session)
duration_seconds
On Puff Detection:

Insert record in puff_events table with:
Confidence score
Facial metrics (mouth height, width, aspect ratio, etc.)
$SMOKE awarded
Detection reason
Update user's smoke_balance and total_smoke_earned
Update session's puff_count and smoke_earned
Insert transaction in smoke_transactions
6. Global Stats System
Edge Function: update-global-stats

Runs periodically to calculate:

Total Players: Count of wallets with ≥ 1 puff
Total $SMOKE Distributed: Sum of all total_smoke_earned
Rewards Pool Remaining: 45M - total distributed
Last Updated: Timestamp
Used for:

Deflation calculations
Dashboard displays
Economic balancing
7. Passive Income Automation
Edge Function: calculate-passive-income

Scheduled Task (hourly cron job):

Fetch users with Level 2+ devices
Calculate hours since last_passive_claim
Award passive $SMOKE to smoke_balance
Update last_passive_claim timestamp
Log transaction in smoke_transactions
🗄️ Database Schema
Tables:
1. profiles

id (uuid, FK to auth.users)
wallet_address (text, unique)
vices (text[], array of purchased devices)
device_levels (jsonb: { vape: 0, cigarette: 0, cigar: 0 })
smoke_balance (numeric, current $SMOKE)
total_smoke_earned (numeric, lifetime earnings)
total_puffs (bigint, lifetime puff count)
streak_days (integer, consecutive login days)
last_active_date (date)
last_passive_claim (timestamp)
2. puff_sessions

id (uuid, PK)
user_id (text, wallet address)
started_at / ended_at (timestamps)
puff_count (integer)
smoke_earned (integer)
duration_seconds (integer)
3. puff_events

id (uuid, PK)
session_id (uuid, FK)
user_id (text)
detected_at (timestamp)
confidence_score (numeric)
smoke_awarded (integer)
detection_reason (text)
Facial metrics: mouth_height, mouth_width, aspect_ratio, lip_pursing, cheek_puff, jaw_open
Historical maximums: max_aspect_ratio, max_pursing, max_cheek_puff, max_mouth_pucker
4. smoke_transactions

id (uuid, PK)
user_id (text)
transaction_type (text: earn, earn_passive, upgrade_vape, etc.)
amount (numeric, can be negative for spending)
balance_after (numeric)
description (text)
metadata (jsonb, additional data)
5. vice_purchases

id (uuid, PK)
user_id (text)
vice_types (text[], purchased devices)
total_amount (numeric, SOL paid)
transaction_signature (text, unique, blockchain tx hash)
status (text: confirmed)
6. global_stats

id (integer, always 1)
total_players (bigint)
total_smoke_distributed (numeric)
rewards_pool_remaining (numeric)
circulating_supply (numeric)
team_allocation (numeric)
last_updated (timestamp)
🎨 Frontend Components
Pages:
Index (/) - Landing page with hero, "How to Play" section
Play (/play) - Main gameplay interface
NotFound (/404) - 404 error page
Key Components:
Navigation:

Navbar - Wallet connection, auth status, navigation links
Footer - Links, social media
Play Page:

PurchaseGate - Device purchase flow (if user hasn't bought any)
CameraTracker - Webcam feed + AI detection overlay
SessionStats - Real-time puff count, $SMOKE earned, duration
LifetimeStats - Total puffs, total $SMOKE earned
SmokeBalance - Current balance, upgrade options
DevicesOwned - Device cards with levels and earning rates
EarningsEstimator - Daily earnings calculator
SessionsTable - History of past sessions
DeviceStatsTable - Detailed stats per device level
🔐 Security Implementation
Row-Level Security (RLS) Policies:
profiles:

Users can view/update own profile only
Match via auth.uid() = id
puff_sessions:

Anyone can create sessions
Users can view/update/delete own sessions
puff_events:

Anyone can insert (for detection logging)
Anyone can view (for analytics)
smoke_transactions:

Anyone can insert (system-generated)
Users can view own transactions
vice_purchases:

Users can view purchases (admin-created via edge function)
global_stats:

Public read access
No write access from client
Edge Function Security:
Transaction verification on Solana blockchain
Duplicate transaction prevention
Amount/recipient validation
Authentication via JWT tokens
Service role key for admin operations
🔄 Data Flow Example
User Detects a Puff:


sequenceDiagram
    participant UI as Play Page
    participant AI as Puff Detection
    participant DB as Supabase
    participant Stats as Global Stats

    AI->>UI: onPuffDetected(analysis)
    UI->>UI: Calculate $SMOKE earned
    UI->>DB: Update profiles.smoke_balance
    UI->>DB: Update profiles.total_smoke_earned
    UI->>DB: Update profiles.total_puffs
    UI->>DB: Insert puff_events record
    UI->>DB: Insert smoke_transactions record
    UI->>DB: Update puff_sessions.puff_count
    UI->>UI: Update session stats UI
    UI->>UI: Show toast notification
    Note over Stats: Periodic cron updates global_stats
📱 User Journey
Landing → Connect Wallet → Sign In
Purchase Gate → Select Vices → Pay 0.2 SOL each
Play Screen → Enable Camera → Start Tracking
Detect Puffs → Earn $SMOKE in real-time
Upgrade Devices → Spend $SMOKE → Earn more per puff
Passive Income → Claim hourly rewards
Check Stats → View sessions, lifetime earnings, leaderboards
🚀 Current Status
✅ Fully Implemented:

Solana wallet authentication
Device purchase system with blockchain verification
AI puff detection with MediaPipe
Direct $SMOKE rewards (no conversion needed)
Upgrade system with exponential costs
Passive income automation
Session management and history
Global stats tracking
RLS security policies
⚠️ Partially Implemented:

Streak system (logic exists, UI incomplete)
Leaderboards (database ready, UI not built)
🔮 Future Enhancements:

Token launch on Solana mainnet
Marketplace for NFT devices
Multiplayer competitions
Social features (guilds, challenges)
Mobile app (React Native)
🎯 Key Metrics
Current Global Stats:

Total Players: 0
$SMOKE Distributed: 0
Rewards Pool: 45,000,000
Circulating Supply: 40,000,000
Team Allocation: 5,000,000
Earning Potential (Level 5 all devices, < 50 players):

Per Active Puff: 375 $SMOKE
Passive Income: 200 $SMOKE/hour
Daily Earnings: ~13,935 $SMOKE
ROI: < 1 day for maxed users
This is a comprehensive gamified platform that successfully combines blockchain payments, AI computer vision, and token economics into a unique "play-to-earn" experience. The direct $SMOKE rewards system with fast depletion creates urgency and incentivizes early adoption. 🔥
-- Test script to verify user deletion works with the updated DELETE handler
-- This demonstrates the SQL operations that will be executed by the Prisma transaction

-- Step 1: Verify users exist before deletion
SELECT COUNT(*) as user_count FROM "User" 
WHERE id IN ('cmn5z9sua0000hygj1hlb1cs9', 'cmomgfy5h0000hy0hiclh1ss1', 'cmonw2tus0002hyfwfltl7hs0', 'cmou7aedp0000hy71qegoxitw', 'cmp6wzrzm0000hyevlab0qw3l');

-- Step 2: Check for referrals that need cleanup
SELECT id, "createdBy", "redeemedBy" FROM "Referral"
WHERE "createdBy" IN ('cmn5z9sua0000hygj1hlb1cs9', 'cmomgfy5h0000hy0hiclh1ss1', 'cmonw2tus0002hyfwfltl7hs0', 'cmou7aedp0000hy71qegoxitw', 'cmp6wzrzm0000hyevlab0qw3l')
OR "redeemedBy" IN ('cmn5z9sua0000hygj1hlb1cs9', 'cmomgfy5h0000hy0hiclh1ss1', 'cmonw2tus0002hyfwfltl7hs0', 'cmou7aedp0000hy71qegoxitw', 'cmp6wzrzm0000hyevlab0qw3l');

-- Step 3: Check for referral rewards
SELECT id, "userId" FROM "ReferralReward"
WHERE "userId" IN ('cmn5z9sua0000hygj1hlb1cs9', 'cmomgfy5h0000hy0hiclh1ss1', 'cmonw2tus0002hyfwfltl7hs0', 'cmou7aedp0000hy71qegoxitw', 'cmp6wzrzm0000hyevlab0qw3l');

-- The DELETE endpoint will execute:
-- 1. DELETE referral rewards
DELETE FROM "ReferralReward" 
WHERE "userId" IN ('cmn5z9sua0000hygj1hlb1cs9', 'cmomgfy5h0000hy0hiclh1ss1', 'cmonw2tus0002hyfwfltl7hs0', 'cmou7aedp0000hy71qegoxitw', 'cmp6wzrzm0000hyevlab0qw3l');

-- 2. DELETE referrals created by user
DELETE FROM "Referral"
WHERE "createdBy" IN ('cmn5z9sua0000hygj1hlb1cs9', 'cmomgfy5h0000hy0hiclh1ss1', 'cmonw2tus0002hyfwfltl7hs0', 'cmou7aedp0000hy71qegoxitw', 'cmp6wzrzm0000hyevlab0qw3l');

-- 3. DELETE referrals redeemed by user
DELETE FROM "Referral"
WHERE "redeemedBy" IN ('cmn5z9sua0000hygj1hlb1cs9', 'cmomgfy5h0000hy0hiclh1ss1', 'cmonw2tus0002hyfwfltl7hs0', 'cmou7aedp0000hy71qegoxitw', 'cmp6wzrzm0000hyevlab0qw3l');

-- 4. DELETE deletion request records (if exists)
DELETE FROM "DeletionRequest"
WHERE "userId" IN ('cmn5z9sua0000hygj1hlb1cs9', 'cmomgfy5h0000hy0hiclh1ss1', 'cmonw2tus0002hyfwfltl7hs0', 'cmou7aedp0000hy71qegoxitw', 'cmp6wzrzm0000hyevlab0qw3l');

-- 5. DELETE the users (all other FKs have onDelete: Cascade or are optional)
DELETE FROM "User"
WHERE id IN ('cmn5z9sua0000hygj1hlb1cs9', 'cmomgfy5h0000hy0hiclh1ss1', 'cmonw2tus0002hyfwfltl7hs0', 'cmou7aedp0000hy71qegoxitw', 'cmp6wzrzm0000hyevlab0qw3l');

-- Step 6: Verify deletion completed
SELECT COUNT(*) as remaining_user_count FROM "User"
WHERE id IN ('cmn5z9sua0000hygj1hlb1cs9', 'cmomgfy5h0000hy0hiclh1ss1', 'cmonw2tus0002hyfwfltl7hs0', 'cmou7aedp0000hy71qegoxitw', 'cmp6wzrzm0000hyevlab0qw3l');

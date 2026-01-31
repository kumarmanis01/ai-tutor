-- Grant Admin Access to Your Google Account
-- Usage: Run this after replacing YOUR_EMAIL with your actual Google email

-- Option 1: Grant admin to specific email
UPDATE "User"
SET role = 'admin'
WHERE email = 'YOUR_EMAIL@gmail.com';

-- Option 2: Grant admin to the most recently logged in user
UPDATE "User"
SET role = 'admin'
WHERE id = (
  SELECT "userId"
  FROM "Session"
  ORDER BY "expires" DESC
  LIMIT 1
);

-- Option 3: View all users to find your email
-- Run this query first to see your email:
-- SELECT id, email, name, role, "createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 10;

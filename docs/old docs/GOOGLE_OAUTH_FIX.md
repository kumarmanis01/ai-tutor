# Google OAuth Login Fix

**Date**: 2026-01-31
**Status**: ✅ **FIXED - Ready for Testing**

---

## 🔧 ISSUE DIAGNOSED

**Problem**: Google OAuth login was not working on localhost development server

**Root Cause**: Environment variable mismatch
- `.env.production` had `NEXTAUTH_URL="https://gnosiva.com"` (production URL)
- Dev server was running on `http://localhost:3000` (development URL)
- Google OAuth callback URLs must match exactly

---

## ✅ FIXES APPLIED

### 1. Created `.env.local` for Development

Created a new [.env.local](../.env.local) file with correct localhost configuration:

```bash
# Key change:
NEXTAUTH_URL=http://localhost:3000  # ✅ Matches dev server

# All other credentials copied from .env.production
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
NEXTAUTH_SECRET=<your-nextauth-secret>
```

**How `.env.local` works**:
- Next.js loads `.env.local` first (if it exists)
- It overrides values from `.env.production`
- `.env.local` is gitignored (safe for local secrets)
- Perfect for local development overrides

### 2. Restarted Dev Server

```bash
# Stopped old process
taskkill //PID 8240 //F

# Started fresh with new environment
npm run dev:fast
```

**Verification**:
```
✓ Next.js 14.2.35
- Local:        http://localhost:3000
- Environments: .env.local          ← Confirms .env.local is loaded
✓ Ready in 4.1s
```

---

## ⚠️ REQUIRED: Google Cloud Console Configuration

For Google OAuth to work on localhost, you **MUST** add the localhost callback URL to your Google Cloud Console:

### Step-by-Step Instructions:

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/
   - Select your project

2. **Navigate to OAuth 2.0 Credentials**:
   - Click on "APIs & Services" → "Credentials"
   - Find your OAuth 2.0 Client ID: `<your-google-client-id>`
   - Click on it to edit

3. **Add Authorized Redirect URIs**:
   - Look for the section "Authorized redirect URIs"
   - Add this URL if not already present:
     ```
     http://localhost:3000/api/auth/callback/google
     ```
   - **IMPORTANT**: Must be `http://` (not `https://`) for localhost
   - **IMPORTANT**: Must include `/api/auth/callback/google` path
   - **IMPORTANT**: Port must match (`:3000`)

4. **Existing Production URI** (should already be there):
   ```
   https://gnosiva.com/api/auth/callback/google
   ```

5. **Save Changes**:
   - Click "Save" at the bottom of the page
   - Wait 1-2 minutes for changes to propagate

### Expected Configuration:

Your OAuth client should have **TWO** redirect URIs:

| Environment | Redirect URI |
|-------------|-------------|
| Production  | `https://gnosiva.com/api/auth/callback/google` |
| Development | `http://localhost:3000/api/auth/callback/google` |

---

## 🧪 TESTING INSTRUCTIONS

### Test 1: Access the Login Page

1. Open browser: http://localhost:3000
2. Click "Sign In" or navigate to: http://localhost:3000/api/auth/signin
3. You should see the NextAuth sign-in page

### Test 2: Google OAuth Login

1. Click "Sign in with Google" button
2. **Expected Behavior**:
   - Redirected to Google's OAuth consent screen
   - Shows "AI Tutor" app requesting permissions
   - After approval, redirected back to `http://localhost:3000`
   - Successfully logged in

### Test 3: Verify Session

1. After login, open browser DevTools (F12)
2. Go to "Application" tab → "Cookies" → `http://localhost:3000`
3. Look for `next-auth.session-token` cookie
4. Should be present and have a value

---

## 🐛 TROUBLESHOOTING

### Issue: "Error 400: redirect_uri_mismatch"

**Symptom**: Google shows error page saying redirect URI doesn't match

**Cause**: Localhost callback URL not added to Google Cloud Console

**Fix**: Follow the "REQUIRED: Google Cloud Console Configuration" section above

---

### Issue: "Error: NEXTAUTH_URL environment variable is not set"

**Symptom**: Error in browser console or server logs

**Cause**: `.env.local` not loaded properly

**Fix**:
```bash
# Verify .env.local exists
ls -la .env.local

# Restart dev server
npm run dev:fast
```

---

### Issue: Login works but session not persisting

**Symptom**: Login succeeds but immediately logged out on refresh

**Possible Causes**:
1. **Database connection issue** - Check `DATABASE_URL` in `.env.local`
2. **Session table missing** - Run Prisma migrations:
   ```bash
   npx prisma migrate dev
   ```
3. **Cookie domain mismatch** - Clear browser cookies for localhost

**Fix**:
```bash
# Check database connection
npx prisma studio

# Look for Session, User, Account tables
# If missing, run migrations:
npx prisma migrate dev
```

---

### Issue: "Error: CSRF token mismatch"

**Symptom**: Error after clicking "Sign in with Google"

**Cause**: Browser cache or cookie issues

**Fix**:
1. Open DevTools (F12) → Application → Clear all cookies for localhost
2. Hard refresh: Ctrl+Shift+R
3. Try login again

---

## 📋 VERIFICATION CHECKLIST

Before reporting issues, verify:

- [ ] Dev server is running on http://localhost:3000
- [ ] `.env.local` file exists in project root
- [ ] `NEXTAUTH_URL=http://localhost:3000` in `.env.local`
- [ ] Google Cloud Console has localhost redirect URI configured
- [ ] No browser console errors on `/api/auth/signin` page
- [ ] Database is accessible (run `npx prisma studio`)
- [ ] Browser cookies enabled for localhost

---

## 🔍 DEBUGGING LOGS

To see detailed NextAuth logs, add to `.env.local`:

```bash
# Add this line for verbose logging
NEXTAUTH_DEBUG=true
```

Then restart dev server and check terminal output for detailed OAuth flow logs.

---

## 📞 STILL HAVING ISSUES?

If Google OAuth still doesn't work after following this guide:

1. **Check Server Logs**:
   ```bash
   tail -50 C:\Users\STAREX~1\AppData\Local\Temp\claude\d--manish-code-ai-tutor\tasks\b48610d.output
   ```

2. **Check Browser Console**:
   - F12 → Console tab
   - Look for red error messages
   - Copy full error text

3. **Test OAuth Endpoint Directly**:
   ```bash
   curl http://localhost:3000/api/auth/providers
   ```
   Should return:
   ```json
   {"google":{"id":"google","name":"Google","type":"oauth","signinUrl":"http://localhost:3000/api/auth/signin/google","callbackUrl":"http://localhost:3000/api/auth/callback/google"}}
   ```

4. **Verify Google Credentials**:
   - Go to Google Cloud Console
   - Check Client ID and Client Secret match `.env.local`
   - Check OAuth consent screen is configured
   - Check OAuth scopes include email and profile

---

## ✅ SUCCESS CRITERIA

Google OAuth login is working if:

1. ✅ Clicking "Sign in with Google" redirects to Google
2. ✅ After approving, redirected back to localhost
3. ✅ User is logged in (see user avatar/name in UI)
4. ✅ Session persists on page refresh
5. ✅ Can access admin pages (if user has admin role)

---

**Last Updated**: 2026-01-31 07:20 UTC
**Dev Server**: http://localhost:3000
**Status**: ✅ Running with `.env.local` configuration


- [ ] Page loads on ₹8,000 Android phone (Chrome) without layout shift
- [ ] Google Sign-In works on mobile Chrome (pre-signed-in device → one tap)
- [ ] Google Sign-In works on incognito (fresh login flow)
- [ ] Return user → Redirected to Parent Dashboard (not onboarding)
- [ ] Error state: Google popup blocked → shows manual sign-in fallback

## P0.2 | P1 | Referral Landing Page Variant
**ID:** P0.2
**Labels:** P1, phase:discovery
**Phase:** Phase 0: Discovery & Acquisition

### User Story
As a parent arriving via a friend's referral link,
I want to see a personalized landing page acknowledging my friend and the mutual reward,
So that I feel social proof and understand the benefit of signing up.

### Acceptance Criteria
- [ ] URL ?ref=parent_id loads variant landing page
- [ ] Hero text: "Your friend Neha Sharma thinks your child will love Spinzy!"
- [ ] Reward callout: "You both get 1 month of Premium free when you subscribe."
- [ ] Referrer name pulled from DB. No avatar (privacy)
- [ ] Google Sign-In CTA remains identical
- [ ] Referral code stored in session. Applied at checkout if user upgrades
- [ ] Referral tracking: Referral table — referrer_id, referred_email, status (SIGNED_UP, SUBSCRIBED, REWARDED)

### QA
- [ ] Referral link tracks correctly through sign-up → subscription
- [ ] Reward auto-applied as subscription extension (not coupon code)

## P0.3 | P1 | School Partnership Landing Page Variant
**ID:** P0.3
**Labels:** P1, phase:discovery
**Phase:** Phase 0: Discovery & Acquisition

### User Story
As a parent arriving via school circular or QR code,
I want to see a co-branded landing page confirming my school's recommendation,
So that I trust the platform and feel confident signing up.

### Acceptance Criteria
- [ ] URL ?school=school_id loads school-specific variant
- [ ] Page displays: School name, school logo (pre-approved)
- [ ] Text: "Your school recommends Spinzy Academy for supplementary learning."
- [ ] Students from partner schools: 14-day free trial (extended from 7 days)
- [ ] School-specific curriculum mapping pre-selected (e.g., ICSE school → ICSE default)
- [ ] Admin dashboard: School partnership tracking (SchoolPartner model)

### QA
- [ ] Correct school name and logo displayed
- [ ] Extended trial applied on sign-up
- [ ] Invalid school_id shows standard landing page (no error)

## P1.1-P | P0 | Add Child Profile — Parent-Initiated
**ID:** P1.1-P
**Labels:** P0, phase:parent-setup
**Phase:** Phase 1: Parent-Initiated Child Setup

### User Story
As a parent who just signed up,
I want to add my child's first name, grade, and board through a simple form,
So that Spinzy can personalize the learning experience immediately.

### Acceptance Criteria
- [ ] Screen shown immediately after Google sign-up (if new user)
- [ ] Title: "Who will be learning with Spinzy?"
- [ ] Fields: First Name (text, required, max 30 chars)
- [ ] Grade (dropdown: 1-12, required)
- [ ] Board (dropdown: CBSE, ICSE, State Boards, required)
- [ ] No photo upload. No last name. No location (data minimization for DPDP)
- [ ] "+ Add Another Child" link below form (text link, opens second form inline)
- [ ] On submit: Child profile created with status: ACTIVE (parent-initiated = pre-approved)
- [ ] consent_status: GRANTED_BY_PARENT
- [ ] No external consent request needed (parent is already authenticated)
- [ ] Success screen: "Aarav's account is ready! 🎉" → Option to share app link via WhatsApp (Story P1.3-P)
- [ ] Backend: POST /api/v1/parent/children — Creates StudentProfile with parent_user_id
- [ ] Backend: StudentProfile fields: first_name, grade, board, status: ACTIVE, consent_status: GRANTED_BY_PARENT

### Dev Tasks
- [ ] Create AddChildForm component
- [ ] Support multiple children (array of forms)
- [ ] API integration

### QA
- [ ] Single child added successfully
- [ ] Multiple children added (form expands)
- [ ] All fields required validation
- [ ] Child immediately visible in Parent Dashboard

## P1.2-P | P0 | DPDP Consent Screen — Parent-Initiated
**ID:** P1.2-P
**Labels:** P0, phase:parent-setup
**Phase:** Phase 1: Parent-Initiated Child Setup

### User Story
As a parent adding my child,
I want to see a plain-language consent screen explaining data usage before activation,
So that I provide informed consent as required by Indian DPDP law.

### Acceptance Criteria
- [ ] Shown after child profile creation (Story P1.1-P)
- [ ] Checklist format with clear ✅ permissions and ❌ restrictions:
  - ✅ Aarav can access unlimited study notes and videos
  - ✅ Aarav's learning activity (time spent, quiz scores) visible only to you
  - ✅ You can set screen time limits and block subjects
  - ❌ Aarav will NOT be shown ads or targeted recommendations
  - ❌ Aarav's data will NOT be shared with third parties
  - ❌ Aarav will NOT have social features (no chat, no friend requests)
- [ ] Two buttons: Primary: "I Consent — Activate Aarav's Account" (Tangerine, full width)
- [ ] Secondary: "I Need More Information" → Opens in-app FAQ modal (privacy policy summary)
- [ ] On consent: StudentProfile.consent_status = GRANTED_BY_PARENT
- [ ] consent_timestamp = now()
- [ ] consent_method = DIRECT_PARENT_SETUP
- [ ] Event logged in immutable audit trail
- [ ] FAQ modal includes link to full Privacy Policy PDF

### Dev Tasks
- [ ] Create DPDPConsentScreen component
- [ ] Create ConsentFAQModal component
- [ ] API: POST /api/v1/parent/consent/grant — Body: { child_id }
- [ ] Backend: Audit trail logging

### QA
- [ ] All checklist items clearly readable on mobile
- [ ] FAQ modal opens and closes smoothly
- [ ] Consent logged correctly in audit trail

## P1.3-P | P1 | Share App Link to Child's Device
**ID:** P1.3-P
**Labels:** P1, phase:parent-setup
**Phase:** Phase 1: Parent-Initiated Child Setup

### User Story
As a parent who just set up my child's account,
I want to send the app download link to my child's device via WhatsApp,
So that they can start learning immediately without me typing URLs.

### Acceptance Criteria
- [ ] Screen after consent: "Aarav's account is ready! 🎉"
- [ ] Instructions: "Hand the device to Aarav, or send the app to their phone."
- [ ] Primary CTA: "Send App Link via WhatsApp"
- [ ] Opens WhatsApp with pre-filled message: "Aarav, your Spinzy Academy learning app is ready! Download: [Deep Link]. Your profile is already set up — just open and start learning."
- [ ] Secondary CTA: "I'll set it up later" → Go to Parent Dashboard
- [ ] Deep link auto-fills child's profile on first app open (no re-login)

### Dev Tasks
- [ ] Create SetupComplete component
- [ ] Generate deep link with child_profile_id token
- [ ] WhatsApp share intent (universal link: https://wa.me/?text=...)

### QA
- [ ] WhatsApp opens with pre-filled message
- [ ] Deep link correctly auto-logs-in child on fresh install
- [ ] Skip option returns to Dashboard

## P1.4-P | P2 | Add Sibling — Additional Child with Discount
**ID:** P1.4-P
**Labels:** P2, phase:parent-setup
**Phase:** Phase 1: Parent-Initiated Child Setup

### User Story
As a parent with multiple children,
I want to add a second child from my dashboard and receive a sibling discount,
So that all my children can use Spinzy under one account at a reduced cost.

### Acceptance Criteria
- [ ] Dashboard card: "+ Add Another Learner" (visible if ≥1 active child)
- [ ] Tapping opens same Add Child flow (P1.1-P), pre-fills parent info
- [ ] After consent, pricing card appears for premium parents: "Sibling Discount: 25% off for Anaya."
- [ ] Premium benefits shared across siblings (one subscription covers all)
- [ ] Free-tier parents: No discount prompt (already free)
- [ ] Dashboard supports toggling between children (Story P4.8)
- [ ] Backend: Subscription check: Family Plan includes up to 3 children
- [ ] If on Individual Plan: Upgrade prompt. "Upgrade to Family Plan (₹599/mo) to add more children."
- [ ] Sibling discount auto-applied on upgrade

### QA
- [ ] Second child added successfully
- [ ] Discount correctly applied on upgrade
- [ ] Dashboard toggle shows both children

## P1.1-R | P0 | Parent Receives Unsolicited Consent Request (WhatsApp)
**ID:** P1.1-R
**Labels:** P0, phase:child-consent
**Phase:** Phase 1-R: Child-Initiated Consent

### User Story
As a parent who did NOT sign up for Spinzy, but whose child has independently created an account,
I want to receive a trustworthy WhatsApp message explaining what Spinzy is and what I'm approving,
So that I don't dismiss it as spam and can approve or deny in seconds.

### Acceptance Criteria
- [ ] WhatsApp Message Template sender: Spinzy Academy (verified WhatsApp Business account)
- [ ] Message content includes: child name, grade, board, value props, controls, and deep link
- [ ] Reply "YES" parses via webhook and auto-approves
- [ ] Triggered by child registration (Student Journey S0.1, Step 5a)
- [ ] WhatsApp Cloud API message send
- [ ] Check if parent phone matches existing User. If yes: Message includes "You have a Spinzy account. Sign in to manage."
- [ ] ConsentRequest record: channel: WHATSAPP, status: SENT

### Dev Tasks
- [ ] WhatsApp Cloud API integration (Meta Developer Console)
- [ ] Message template submission & approval (Meta requirement)
- [ ] Webhook setup: POST /api/v1/webhooks/whatsapp (receive replies)

### QA
- [ ] Message delivers within 10 seconds of child registration
- [ ] Message renders correctly on WhatsApp (Android + iOS)
- [ ] "YES" reply correctly triggers approval
- [ ] Deep link opens consent mini-page
- [ ] Existing parent message shows correct account hint
- [ ] Non-delivery: Retry 2x, then log for manual review

## P1.2-R | P0 | Parent Receives Unsolicited Consent Request (Email)
**ID:** P1.2-R
**Labels:** P0, phase:child-consent
**Phase:** Phase 1-R: Child-Initiated Consent

### User Story
As a parent who received a consent request via email,
I want a clear, trustworthy email with a one-click approval button,
So that I can approve my child's access from my email inbox.

### Acceptance Criteria
- [ ] Email Template Subject: "Aarav wants to learn with Spinzy Academy — Your Approval Needed"
- [ ] From: hello@spinzyacademy.com
- [ ] Body includes: Child's name, grade, board, bullet list of parent controls
- [ ] Approve Button: Large, Tangerine, "Approve & Set Limits" → Links to consent mini-page
- [ ] Deny Link: Small, grey, "Deny Access"
- [ ] Expiry notice: "Link expires in 48 hours."
- [ ] Compliance footer: DPDP notice, contact info, privacy policy link
- [ ] Email renders on: Gmail app (Android/iOS), Outlook, Apple Mail
- [ ] Triggered by child registration when channel: EMAIL
- [ ] Email service: AWS SES or SendGrid
- [ ] ConsentRequest record: channel: EMAIL, status: SENT

### Dev Tasks
- [ ] Create email template using React Email (packages/email-templates/src/consent-request.tsx)
- [ ] Email service integration

### QA
- [ ] Email delivers within 60 seconds
- [ ] Renders correctly on Gmail mobile app
- [ ] Approve button links to correct consent page
- [ ] Deny link works correctly
- [ ] Expired token link shows appropriate error

## P1.3-R | P0 | Parent Approves via Consent Mini-Page
**Labels:** P0, phase:child-consent
**Phase:** Phase 1-R: Child-Initiated Consent

### User Story
As a parent who tapped the approval link from WhatsApp or email,
I want to see a simple, mobile-optimized page where I can approve via Google sign-in or OTP,
So that I don't have to download an app or remember a password.

### Acceptance Criteria
- [ ] Mini-Page URL: https://spinzyacademy.com/parent/approve?token={consent_token}
- [ ] On load: Validate token via API. Show loading spinner
- [ ] Valid token → Show consent page with child's name, grade, board, DPDP checklist
- [ ] Primary: "Approve via Google" button
- [ ] Secondary: "Approve with OTP" button (for parents who don't use Google)
- [ ] Tertiary: "Deny Access" (small grey link)
- [ ] Approve via Google: Google OAuth popup/redirect. On success: Consent granted. Account created/linked if parent email exists
- [ ] Success screen: "Approved! Aarav can now access Spinzy." Link: "Manage Settings" → Parent Dashboard (if account exists) or "Create Parent Account" (Story P1.5-R)
- [ ] Approve with OTP: Send 6-digit OTP to same WhatsApp/Email (based on original channel)
- [ ] OTP input (6 separate boxes, auto-advance, paste support)
- [ ] Valid OTP → Consent granted. Invalid OTP → Error message. Max 3 attempts
- [ ] Deny Access: Confirmation modal → On confirm: consent_status: DENIED. Screen: "Access Denied. Your child will be notified."
- [ ] Expired Token Screen: "This approval link has expired. Ask your child to send a new request."
- [ ] Invalid Token Screen: "Invalid link. Please check the message or contact support."
- [ ] Backend: GET /api/v1/consent/validate?token={token} — Returns child info + expiry status
- [ ] Backend: POST /api/v1/consent/approve — Body: { token, method: 'google' | 'otp', otp_code? }
- [ ] Backend: POST /api/v1/consent/send-otp — Body: { token }. Sends OTP to parent contact
- [ ] Backend: POST /api/v1/consent/deny — Body: { token }
- [ ] On approval: StudentProfile.status = ACTIVE, consent_status = GRANTED_VIA_LINK, consent_method = GOOGLE_OAUTH | WHATSAPP_OTP | EMAIL_OTP
- [ ] WebSocket push to student: { event: 'consent_approved' }

### Dev Tasks
- [ ] Create ParentApprovalPage component (Next.js, no auth required)
- [ ] Create OTPInput component (6-digit, pasteable)
- [ ] Implement Google OAuth on mini-page
- [ ] API: Consent validation, approval, denial, OTP send

### QA
- [ ] Page loads correctly inside WhatsApp in-app browser
- [ ] Google OAuth works in WhatsApp browser popup
- [ ] OTP delivers within 10 seconds
- [ ] OTP paste works (especially for SMS/WhatsApp notification auto-read)
- [ ] Invalid OTP shows error. 3 wrong attempts → OTP invalidated
- [ ] Deny flow works. Student app updates within 15 seconds
- [ ] Expired/invalid token shows clear messaging

## P1.4-R | P1 | Parent Approves via WhatsApp "YES" Reply
**Labels:** P1, phase:child-consent
**Phase:** Phase 1-R: Child-Initiated Consent

### User Story
As a parent who received a WhatsApp consent request,
I want to reply "YES" to approve without clicking any links,
So that I can approve in under 5 seconds during a busy day.

### Acceptance Criteria
- [ ] Parent replies "YES" (case-insensitive: "yes", "Yes", "YES", "yes please" all valid)
- [ ] WhatsApp webhook receives and parses reply
- [ ] System verifies incoming phone number matches a pending ConsentRequest.parent_phone
- [ ] ConsentRequest status is AWAITING and not expired
- [ ] On match: Consent auto-approved. StudentProfile.status = ACTIVE, consent_method = WHATSAPP_REPLY
- [ ] WebSocket push to student
- [ ] Reply to parent: "✅ Approved! Aarav can now use Spinzy Academy. Set screen time limits & track progress here: [Dashboard Link]"
- [ ] If parent has no Spinzy account: Dashboard link redirects to account creation (P1.5-R)
- [ ] If no matching consent request found: Reply: "We couldn't find a pending approval request for this number. Ask your child to send a new request from the Spinzy app."
- [ ] If consent already approved/denied: Reply: "This request has already been processed. Check the Spinzy parent dashboard or contact support."
- [ ] Backend: WhatsApp webhook: Parse incoming message body
- [ ] Regex match: /\b(yes|haan|ji|ok)\b/i for broader Indian language support
- [ ] Lookup ConsentRequest by parent_phone + status: AWAITING + token_expires_at > now()
- [ ] Security: Log all webhook events for fraud detection

### Dev Tasks
- [ ] Webhook handler: apps/api/src/webhooks/whatsapp.webhook.ts
- [ ] Service: ConsentService.approveViaReply(phone, message)
- [ ] Reply template via WhatsApp Cloud API

### QA
- [ ] "YES" → Consent approved within 5 seconds
- [ ] "yes" → Approved
- [ ] "YES please" → Approved
- [ ] "Haan" → Approved (Hindi support)
- [ ] Random message ("hello", "kya hai yeh") → NOT approved. Correct error reply sent
- [ ] Reply from unknown number → Correct error reply
- [ ] Expired consent → Correct error reply

## P1.5-R | P1 | New Parent Account Creation Post-Consent
**Labels:** P1, phase:child-consent
**Phase:** Phase 1-R: Child-Initiated Consent

### User Story
As a parent who just approved my child via WhatsApp reply or OTP, and who does NOT have a Spinzy account,
I want to be prompted to create a parent account or skip and do it later,
So that I can access the Parent Dashboard when I'm ready.

### Acceptance Criteria
- [ ] After consent approval: System checks if parent_phone or parent_email matches an existing User
- [ ] If NO match (new parent): WhatsApp reply includes: "Set up your free parent account to control Aarav's screen time & track progress: [Link]"
- [ ] Consent mini-page success screen includes: "Create your parent account to manage Aarav's learning." Button: "Set Up Parent Account" (Google sign-in)
- [ ] Parent account creation: Google sign-in (pre-fill email if available). Account auto-linked to approved child. No re-consent needed. Lands on Parent Dashboard
- [ ] If parent skips account creation: Student still gets full access. Parent still receives weekly reports via original channel (WhatsApp/Email)
- [ ] Parent can create account later using same phone/email. On creation, existing children auto-linked
- [ ] Admin dashboard flag: parent_account_created: boolean on StudentProfile
- [ ] 7 days after approval, if no parent account: Reminder message: "Set up your parent account to see Aarav's progress! [Link]"
- [ ] Backend: POST /api/v1/parent/claim — Body: { phone?, email?, google_token? }. Links parent account to existing child profiles
- [ ] Cron job: Send reminder to unlinked parents after 7 days

### QA
- [ ] New parent creates account post-consent → Child correctly linked
- [ ] Parent skips account creation → Child still has full access
- [ ] Weekly reports deliver to unlinked parent via WhatsApp/Email
- [ ] Parent creates account later → Existing children auto-linked

## P1.6-R | P1 | Parent Declines Consent
**Labels:** P1, phase:child-consent
**Phase:** Phase 1-R: Child-Initiated Consent

### User Story
As a parent who does not want my child to use Spinzy,
I want to decline the consent request clearly,
So that my child's data is not processed and I'm not contacted again.

### Acceptance Criteria
- [ ] From consent mini-page: Tap "Deny Access" → Confirmation modal → Confirm
- [ ] From WhatsApp: Reply "NO" (or "no", "nahi") → Webhook parses → Consent denied
- [ ] From Email: Click "Deny Access" link → Confirmation page → Confirm
- [ ] On denial: StudentProfile.consent_status = DENIED, StudentProfile.status = INACTIVE
- [ ] Student profile anonymized (name removed, only grade/board retained as aggregate stat)
- [ ] Student receives push/WebSocket: "Access Not Approved. Talk to your parent."
- [ ] Parent confirmation: "Access Denied. Aarav's profile has been deactivated. You can change this in Parent Settings if you change your mind."
- [ ] No further consent requests sent for this child
- [ ] Parent can reverse denial within 90 days via Parent Settings → Reactivate
- [ ] 72-hour device cooldown for student to re-request with a DIFFERENT parent contact
- [ ] All denial events logged in audit trail
- [ ] Backend: POST /api/v1/consent/deny — Body: { token }
- [ ] WhatsApp webhook: Match "NO", "nahi", "nahi chahiye"
- [ ] StudentProfile.anonymize() method: Clears name, sets is_anonymized: true

### QA
- [ ] Denial via each channel works (mini-page, WhatsApp, Email)
- [ ] Student app updates within 15 seconds
- [ ] Student cannot re-request to same parent for 72 hours
- [ ] Student CAN re-request to different parent immediately
- [ ] Parent can reverse denial in Settings
- [ ] Anonymized data not visible in analytics

## P1.7-R | P1 | Parent Handles Consent for Existing Account (2nd Child)
**Labels:** P1, phase:child-consent
**Phase:** Phase 1-R: Child-Initiated Consent

### User Story
As a parent who already has a Spinzy account with one child,
I want to receive and manage a consent request when my second child independently signs up,
So that both children are linked under my existing account without duplication.

### Acceptance Criteria
- [ ] When consent request is sent to phone/email matching existing parent: WhatsApp/Email content includes "You already have a Spinzy account. Aarav's access request is linked to your account."
- [ ] Approval link leads to existing Parent Dashboard (not new account creation)
- [ ] On approval: Second child added to existing account automatically
- [ ] Parent Dashboard shows both children
- [ ] If parent is on Individual Plan: Prompt to upgrade to Family Plan. "You're on Individual Plan (1 child). Upgrade to Family Plan (₹599/mo) to add Aarav."
- [ ] If parent is on Family Plan: Second child added immediately, no additional cost
- [ ] No duplicate account created
- [ ] Backend: Before sending consent request: SELECT FROM User WHERE phone = ? OR email = ?
- [ ] If match: Link consent to existing user_id. No new User created

### QA
- [ ] Second child approval links to existing account
- [ ] Dashboard shows both children after approval
- [ ] Upgrade prompt shown if on Individual Plan
- [ ] No duplicate User record

## P2.1 | P1 | First Session Push Notification
**Labels:** P1, phase:observation
**Phase:** Phase 2: Passive Observation (First Week)

### User Story
As a parent of a newly activated learner,
I want to receive a push notification when my child completes their first lesson,
So that I feel informed and reassured the platform is being used.

### Acceptance Criteria
- [ ] Trigger: Child completes first lesson (content viewed ≥90% OR 1+ practice question answered)
- [ ] Notification: "Aarav just completed their first lesson: 'Introduction to Fractions.' They got 4/5 practice questions right! 🎉"
- [ ] Tapping notification → Opens Parent Dashboard (premium) or lightweight session summary screen (free)
- [ ] Sent only once per child (not per lesson)
- [ ] Opt-out toggle in Settings (default: ON)
- [ ] Delivered via Firebase Cloud Messaging (FCM) for Android, APNs for iOS

### Dev Tasks
- [ ] Configure FCM/APNs
- [ ] Create notification service
- [ ] API: POST /api/v1/parent/notifications/register-device

### QA
- [ ] Notification delivers within 30 seconds of child action
- [ ] Tapping opens correct screen
- [ ] Opt-out toggle works

## P2.2 | P0 | Weekly Progress Email — Automated Sunday Report
**Labels:** P0, phase:observation
**Phase:** Phase 2: Passive Observation (First Week)

### User Story
As a parent (free or premium),
I want to receive an automated email every Sunday at 6 PM IST summarizing my child's weekly activity,
So that I can track progress without logging in daily.

### Acceptance Criteria
- [ ] Sent every Sunday at 18:00 IST (cron job, timezone-aware)
- [ ] Email fields: Child's name, Total time spent this week (hours/minutes), Topics covered (list, max 5), Average accuracy % (across all practice questions), XP earned this week, Current streak (🔥 + days)
- [ ] For Free-tier parents: Premium teaser: "Want to see which topics Aarav is struggling with? Upgrade to Premium for real-time dashboard + weak topic alerts." CTA: "Upgrade Now" → Pricing page
- [ ] For Premium parents: Weak Topics section (topics with accuracy < 60%), "Assign extra practice" button (links to Dashboard). No upgrade CTA
- [ ] If child had zero activity: "Aarav didn't log in this week. Here's a fun topic they might enjoy: [Suggested Topic]"
- [ ] Email uses Template T4 (designed in PRD)
- [ ] Unsubscribe link in footer
- [ ] Backend: Cron job: WeeklyReportWorker runs Sunday 18:00 IST
- [ ] Aggregates: Time spent, topics, accuracy, XP, streak from StudentActivity table
- [ ] Generates and sends email to all active parents

### Dev Tasks
- [ ] Create WeeklyReportWorker (BullMQ repeatable job)
- [ ] Create email template using React Email
- [ ] Query: Aggregate student activity by week

### QA
- [ ] Email delivers at 18:00 IST on Sunday
- [ ] All fields populated correctly
- [ ] Free vs Premium variant renders correctly
- [ ] Zero activity email sends correctly
- [ ] Email renders on Gmail mobile app

## P2.3 | P1 | Monthly Progress Summary Email (Premium)
**Labels:** P1, phase:observation
**Phase:** Phase 2: Passive Observation (First Week)

### User Story
As a premium parent,
I want a detailed monthly email with trend data showing improvement over time,
So that I can see if my child is progressing or plateauing.

### Acceptance Criteria
- [ ] Sent on the 1st of every month
- [ ] Includes: Month-over-month accuracy change (↑ or ↓ %), Topics mastered count, Total hours learned, Average streak, Weak topic trends: "Long Division has been weak for 3 consecutive weeks."
- [ ] Celebratory element: "Aarav improved by 12% this month! 🎉 Share this win:" → WhatsApp share button
- [ ] Premium only. Free parents don't receive this

### QA
- [ ] Delivers on 1st of month
- [ ] Accuracy trend calculated correctly
- [ ] Share button works

## P3.1 | P1 | Child-Initiated Premium Request — Push Notification
**Labels:** P1, phase:upgrade
**Phase:** Phase 3: The Upgrade Moment

### User Story
As a parent of a free-tier child who hit the Freemium Wall,
I want to receive a push notification when my child requests premium access,
So that I can approve instantly and keep their learning momentum going.

### Acceptance Criteria
- [ ] Trigger: Child taps "Ask Parent to Unlock" on Freemium Wall (Student Journey S2.4)
- [ ] Notification: "Aarav wants unlimited practice. Tap to upgrade."
- [ ] Specific context: "Aarav used all 5 free practice questions and wants to take the Fractions Chapter Quiz."
- [ ] Tapping notification → Opens upgrade flow (Story P3.2)
- [ ] In-app badge on Parent Dashboard: "1 pending request from Aarav."
- [ ] If parent doesn't respond in 48 hours: One follow-up notification
- [ ] Cooldown: Child cannot send another request for 24 hours
- [ ] Backend: POST /api/v1/parent/notifications/upgrade-request — Triggered by S2.4
- [ ] Push notification via FCM/APNs
- [ ] UpgradeRequest record: child_id, parent_id, feature, status: PENDING, created_at

### QA
- [ ] Notification delivers within 30 seconds
- [ ] 48-hour follow-up sends correctly
- [ ] Cooldown prevents spam

## P3.2 | P1 | Upgrade Flow — Plan Selection Screen
**Labels:** P1, phase:upgrade
**Phase:** Phase 3: The Upgrade Moment

### User Story
As a parent arriving from a child's upgrade request,
I want to see a simple, transparent pricing screen with feature comparison,
So that I can make an informed purchase decision quickly.

### Acceptance Criteria
- [ ] Screen: "Upgrade Aarav's Learning"
- [ ] Two plans: Individual: ₹399/month. Unlimited practice, AI tutor, tests, parent dashboard. Family: ₹599/month. Everything + up to 3 children. (Best Value badge.)
- [ ] Annual toggle: Individual ₹3,999/year (Save ₹789). Family ₹5,999/year (Save ₹1,189)
- [ ] Feature comparison table (from Landing Page LP-6.1)
- [ ] 7-day free trial: "First 7 days free. Cancel anytime."
- [ ] Trust signals: 🔒 Razorpay secure. UPI/Cards/NetBanking. No auto-renewal without reminder
- [ ] FAQ accordion: "Can I cancel? Refund policy? Sibling discount?"
- [ ] Tap plan → Payment screen (P3.3)

### Dev Tasks
- [ ] Create UpgradeScreen component
- [ ] Create PlanCard sub-component
- [ ] Monthly/Yearly toggle
- [ ] FAQ accordion

### QA
- [ ] Both plans display correctly
- [ ] Toggle switches prices
- [ ] Feature comparison matches actual product

## P3.3 | P1 | Payment Screen — UPI First
**Labels:** P1, phase:upgrade
**Phase:** Phase 3: The Upgrade Moment

### User Story
As a parent ready to subscribe,
I want to pay via UPI (Google Pay/PhonePe) as the default option,
So that I can complete payment in under 30 seconds without entering card details.

### Acceptance Criteria
- [ ] UPI is the PRIMARY and FIRST payment option
- [ ] UPI flow: Option A: Enter UPI ID (e.g., parent@okhdfcbank) → Verify → Pay. Option B: Select app (Google Pay/PhonePe intent) → Opens app → Pay
- [ ] Card option as secondary: Card number, expiry, CVV
- [ ] Saved payment method for renewals (tokenized via Razorpay)
- [ ] Processing: "Confirming payment..." (max 10 seconds)
- [ ] On success: Confetti animation: "Aarav now has unlimited practice! 🎉", Child session updates in real-time (WebSocket), Invoice emailed within 5 minutes
- [ ] On failure: Clear error message. Retry button. "Your bank declined. Try another method?"
- [ ] No page refresh during payment
- [ ] Backend: Razorpay integration: Orders API, Payments API, Subscriptions API
- [ ] Webhook: POST /api/v1/webhooks/razorpay — Payment success/failure
- [ ] On success: Update User.subscription_status = PREMIUM, subscription_plan, expires_at
- [ ] Generate invoice PDF, email to parent

### Dev Tasks
- [ ] Integrate Razorpay SDK
- [ ] Create PaymentScreen component
- [ ] Implement UPI intent (Google Pay/PhonePe)
- [ ] Razorpay webhook handler
- [ ] Invoice generation (PDF)

### QA
- [ ] UPI payment works end-to-end
- [ ] Card payment works
- [ ] Payment failure handled gracefully
- [ ] Webhook updates subscription correctly
- [ ] Invoice delivered

## P3.4 | P1 | Post-Payment — Child Session Update
**Labels:** P1, phase:upgrade
**Phase:** Phase 3: The Upgrade Moment

### User Story
As a parent who just completed payment,
I want my child's active session to update in real-time without re-login,
So that they can immediately access the feature they requested.

### Acceptance Criteria
- [ ] On payment success → WebSocket push to child: { event: 'premium_activated' }
- [ ] Child's Freemium Wall auto-dismisses with toast: "Premium unlocked! 🎉 Redirecting..."
- [ ] If child offline: Premium status updates on next app open (token refresh)
- [ ] Parent sees confirmation: "Aarav's session updated. They can now access everything."

### QA
- [ ] Child session updates within 5 seconds of parent payment
- [ ] Offline child gets premium on next app open

## P3.5 | P2 | Payment Failure Recovery
**Labels:** P2, phase:upgrade
**Phase:** Phase 3: The Upgrade Moment

### User Story
As a parent whose payment failed,
I want clear guidance and a retry path,
So that I don't abandon the upgrade.

### Acceptance Criteria
- [ ] Failure screen: Specific reason (e.g., "Insufficient balance," "Timeout")
- [ ] Retry button prominent
- [ ] Change payment method link
- [ ] If parent closes without retrying: Email reminder after 24 hours: "Aarav's premium access is waiting! Complete your payment: [link]"
- [ ] Max 2 reminders. No reminders after 7 days

### QA
- [ ] Failure reason displays correctly
- [ ] Reminder email sends
- [ ] Direct payment link works

## P4.0 | P1 | Parent Profile PIN Protection
**Labels:** P1, phase:dashboard
**Phase:** Phase 4: Active Premium Parenting

### User Story
As a parent sharing a device with my child,
I want to enter a 4-digit PIN to access my Parent Profile,
So that my child cannot access billing, settings, or sibling data.

### Acceptance Criteria
- [ ] Profile Picker: Tapping "Parent" → PIN entry screen
- [ ] 4-digit PIN input (4 separate boxes, masked)
- [ ] PIN set during parent account creation or first dashboard access
- [ ] PIN stored hashed (bcrypt)
- [ ] 3 wrong attempts → 5-minute lockout
- [ ] "Forgot PIN?" → Resets via email OTP
- [ ] Option to use biometric (fingerprint/face) if device supports (P2)

### QA
- [ ] PIN protects parent profile
- [ ] Lockout works
- [ ] Reset via email works

## P4.1 | P1 | Parent Dashboard — Core Metrics
**Labels:** P1, phase:dashboard
**Phase:** Phase 4: Active Premium Parenting

### User Story
As a premium parent,
I want to switch to Parent Profile (secured by PIN) and see a real-time dashboard,
So that I can monitor progress and identify weak areas.

### Acceptance Criteria
- [ ] Access: Profile Picker → Parent Profile → 4-digit PIN (Story P4.0)
- [ ] Dashboard for selected child: Overall Accuracy % with trend arrow (↑ ↓ vs last week), Time Spent This Week (hours/minutes), Topics Mastered (count), XP Earned, Current Streak 🔥
- [ ] Pull-to-refresh
- [ ] Mobile-responsive (portrait + tablet landscape)
- [ ] Data refreshes on app open

### Dev Tasks
- [ ] Create ParentDashboard component
- [ ] Create MetricsGrid sub-component
- [ ] API: GET /api/v1/parent/dashboard?child_id={id}

## P4.2 | P1 | Weak Topics Identification & Action
**Labels:** P1, phase:dashboard
**Phase:** Phase 4: Active Premium Parenting

### User Story
As a premium parent,
I want to see highlighted "Weak Topics" (accuracy < 60%) and assign practice with one tap,
So that I can support my child's improvement actively.

### Acceptance Criteria
- [ ] Weak Topics section: Any topic with ≥3 attempts and accuracy < 60%
- [ ] Each card: Topic name, accuracy %, trend
- [ ] Primary Action: "Assign Practice" → 10-question set generated
- [ ] Secondary Action: "Request Better Notes" → Adds to on-demand AI queue with priority
- [ ] Child receives notification: "Mom assigned 10 Long Division questions. Complete for 50 Bonus XP!"
- [ ] Assignment visible on child's Learning Map as glowing star node
- [ ] On completion: Parent notified. "Aarav scored 8/10 on Long Division (↑ from 42%)."
- [ ] Assignment history: Past assignments with scores and dates

### Dev Tasks
- [ ] Create WeakTopics component
- [ ] API: POST /api/v1/parent/assignments/create
- [ ] API: GET /api/v1/parent/assignments/history

### QA
- [ ] Weak topics correctly identified
- [ ] Assignment generates 10 questions
- [ ] Child receives notification
- [ ] Completion notification to parent

## P4.3 | P2 | Screen Time Management
**Labels:** P2, phase:dashboard
**Phase:** Phase 4: Active Premium Parenting

### User Story
As a parent,
I want to set daily time limits for each child,
So that I can prevent excessive screen time.

### Acceptance Criteria
- [ ] Settings → "Daily Learning Limit"
- [ ] Options: 30 / 60 / 90 / 120 mins / Unlimited
- [ ] Default: 90 min (under 12), 120 min (12+)
- [ ] Child hits limit → Study Buddy screen: "Great work today! Come back tomorrow." + Parent Override button (needs PIN)
- [ ] Weekday vs Weekend: Different limits configurable (P2)
- [ ] Active session time tracked (not idle/background)

### QA
- [ ] Limit enforced correctly
- [ ] Override works with PIN
- [ ] Idle time not counted

## P4.4 | P2 | Subject Blocker
**Labels:** P2, phase:dashboard
**Phase:** Phase 4: Active Premium Parenting

### User Story
As a parent,
I want to temporarily hide subjects from my child's Learning Map,
So that I can control what they focus on.

### Acceptance Criteria
- [ ] Settings → "Subject Access Control"
- [ ] Toggle per subject (Math, Science, English, SST, etc.)
- [ ] OFF → Subject nodes hidden from child's Learning Map
- [ ] Child search for blocked subject → "Math is resting. Ask your parent."
- [ ] Schedule option: "Block Math from April 1 to June 15." (P2)

### QA
- [ ] Subject blocking works instantly
- [ ] Child cannot access blocked content
- [ ] Scheduling works

## P4.5 | P1 | Weekly Report — Premium Variant
**Labels:** P1, phase:dashboard
**Phase:** Phase 4: Active Premium Parenting

### User Story
As a premium parent,
I want the Sunday report to include richer data (subject breakdowns, weak topics, recommendations),
So that I feel the premium value.

(Covered in P2.2 — Premium variant of weekly email.)

## P4.6 | P2 | Multi-Child Dashboard Toggle
**Labels:** P2, phase:dashboard
**Phase:** Phase 4: Active Premium Parenting

### User Story
As a parent with multiple children,
I want to toggle between children's dashboards seamlessly,
So that I can monitor all children from one place.

### Acceptance Criteria
- [ ] Top bar: Horizontal tabs — one per child (name + avatar)
- [ ] Current tab highlighted
- [ ] Tapping switches all data instantly
- [ ] No sibling comparison (each child independent, no ranking)

### QA
- [ ] Toggle works
- [ ] Each child's data isolated
- [ ] No sibling comparison UI

## P5.1 | P2 | Exam Mode Activation
**Labels:** P2, phase:exam-season
**Phase:** Phase 5: Exam Season — Parent as Coach

### User Story
As a parent approaching exam season,
I want to activate "Exam Warrior Mode" from my dashboard,
So that my child's app switches to a focused, distraction-free revision environment.

### Acceptance Criteria
- [ ] Dashboard card (auto-appears Feb 1 or admin-set): "Final Exams approaching! Activate Exam Warrior Mode?"
- [ ] Toggle ON → Child app: Dark theme, minimal gamification, exam countdown, mock test format
- [ ] Toggle OFF → Returns to standard mode
- [ ] Manual toggle anytime

### QA
- [ ] Toggle changes child's app
- [ ] Auto-prompt at correct date

## P5.2 | P2 | Mock Test Scheduler
**Labels:** P2, phase:exam-season
**Phase:** Phase 5: Exam Season — Parent as Coach

### User Story
As a parent during exam season,
I want to schedule mock tests on specific dates/times,
So that my child practices under exam conditions and I receive performance reports.

### Acceptance Criteria
- [ ] Dashboard → Mock Tests → Schedule
- [ ] Select: Subject, Chapters, Date, Time window, Duration
- [ ] Child notified at scheduled time
- [ ] Test locks other features during exam
- [ ] Post-test: Auto-graded. Parent receives report (section accuracy, time per question, improvement)

### QA
- [ ] Scheduling works
- [ ] Child experience works
- [ ] Report accurate

## P5.3 | P2 | Revision Plan Generator
**Labels:** P2, phase:exam-season
**Phase:** Phase 5: Exam Season — Parent as Coach

### User Story
As a parent,
I want to input exam dates and receive an auto-generated daily revision plan for my child,
So that they cover all topics systematically.

### Acceptance Criteria
- [ ] Input: Subject + Exam Date
- [ ] System generates daily plan based on: Topics in curriculum, child's accuracy, days remaining
- [ ] Plan appears on child's Learning Map as daily quests
- [ ] Adapts if child misses a day

### QA
- [ ] Plan generated correctly
- [ ] Plan adapts to misses

## P5.4 | P2 | Post-Exam Summary
**Labels:** P2, phase:exam-season
**Phase:** Phase 5: Exam Season — Parent as Coach

### User Story
As a parent after exams,
I want a final summary and prompt to switch to summer mode,
So that my child can relax while preventing learning loss.

### Acceptance Criteria
- [ ] Push: "Exams are over! Aarav completed 12 mock tests. Avg improvement: 22%."
- [ ] Dashboard card: "Switch to Summer Mode?"
- [ ] Exam summary email: All mock scores, improvement trend
- [ ] Toggle OFF Exam Mode → Summer Brain Gain challenge

### QA
- [ ] Notification sends
- [ ] Summary email accurate

## P6.1 | P2 | Referral Program
**Labels:** P2, phase:retention
**Phase:** Phase 6: Long-Term Partnership

### User Story
As a premium parent,
I want to refer friends via WhatsApp and earn free months,
So that I save money and share a useful tool.

### Acceptance Criteria
- [ ] Dashboard card: "Invite a friend. You both get 1 month free."
- [ ] WhatsApp share with pre-filled message + referral link
- [ ] Tracking dashboard: Invited, Joined, Subscribed, Rewards earned
- [ ] Reward auto-applied as subscription extension

### QA
- [ ] Referral link tracks correctly
- [ ] Reward auto-applied on friend subscription

## P6.2 | P2 | Annual Renewal Flow
**Labels:** P2, phase:retention
**Phase:** Phase 6: Long-Term Partnership

### User Story
As a parent with expiring subscription,
I want timely, non-aggressive renewal reminders,
So that my child's access continues uninterrupted.

### Acceptance Criteria
- [ ] 30 days before: Email (price-lock guarantee)
- [ ] 14 days before: In-app banner
- [ ] 7 days before: Push notification
- [ ] 1 day before: Email + Push
- [ ] Expiry day: Child sees Freemium Wall with "Ask Mom to renew!"
- [ ] Renewal: One-tap (saved payment method)

### QA
- [ ] Reminders at correct intervals
- [ ] Renewal one-tap works

## P6.3 | P2 | Sibling Discount on Renewal
**Labels:** P2, phase:retention
**Phase:** Phase 6: Long-Term Partnership

### User Story
As a parent renewing with multiple children,
I want sibling discount auto-applied,
So that I don't need to enter coupon codes.

### Acceptance Criteria
- [ ] System detects multiple active children
- [ ] Renewal price: 25% discount for 2nd+ child
- [ ] Auto-calculated. No manual entry

### QA
- [ ] Discount applied correctly

## P6.4 | P1 | Cancellation Flow with Win-Back
**Labels:** P1, phase:retention
**Phase:** Phase 6: Long-Term Partnership

### User Story
As a parent who wants to cancel,
I want a respectful, friction-minimal process with an option to pause or get a discount,
So that I leave with a positive impression.

### Acceptance Criteria
- [ ] Settings → Manage Subscription → Cancel
- [ ] Exit survey: "Why are you leaving?" (Too expensive / Child not using / Found alternative / Break / Other)
- [ ] If "Too expensive" → Offer 50% off for 3 months
- [ ] If "Child not using" → Offer pause (up to 3 months, no charge, data preserved)
- [ ] No dark patterns. No "Are you sure?" x3
- [ ] Post-cancellation: "Download Aarav's learning history" (PDF)
- [ ] 30 days post: One re-engagement email: "Come back anytime. Aarav's progress is saved."

### QA
- [ ] Exit survey works
- [ ] Discount/pause offers work
- [ ] PDF download works
- [ ] Re-engagement email sends

## P6.5 | P2 | Data Export — Learning History PDF
**Labels:** P2, phase:retention
**Phase:** Phase 6: Long-Term Partnership

### User Story
As a parent,
I want to download a PDF of my child's complete learning history,
So that I have a record for school or personal archives.

### Acceptance Criteria
- [ ] Settings → "Download Learning History"
- [ ] PDF: Child name, grade, board. All topics studied with accuracy %. Weak topics. XP. Streak history. Total hours
- [ ] Generated server-side. Emailed within 5 minutes
- [ ] Available for 90 days post-cancellation

### QA
- [ ] PDF generated correctly
- [ ] Emailed
```
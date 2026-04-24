## S0.1 | P0 | Student-Initiated Registration with Age Gate
**ID:** S0.1
**Labels:** P0, phase:onboarding
**Phase:** Onboarding

### User Story
As a student downloading Spinzy on my own device,
I want to create my profile by entering my name, grade, board, and my parent's contact,
So that I can get started immediately without waiting for my parent to set everything up.

### Acceptance Criteria
- [ ] Step 1 — Role Selection: App launch screen shows two clear buttons: "I'm a Student" (Primary, Tangerine) and "I'm a Parent" (Secondary, outlined). Tapping "I'm a Student" proceeds to Step 2.
- [ ] Step 2 — Age Gate: Screen title: "When were you born?" Date picker with three scrollable dropdowns: Day | Month | Year. Helper text: "We need this to comply with India's data protection laws." "Continue" button disabled until a valid date is selected.
- [ ] If selected DOB indicates age ≥ 18: Skip to Step 5 (Account Created — Adult).
- [ ] If selected DOB indicates age < 18: Proceed to Step 3.
- [ ] Step 3 — Profile Creation: Screen title: "Tell us about yourself". Fields: First Name (Text input, required, max 30 characters, no special chars except space). Grade (Dropdown: 1 to 12, required). Board (Dropdown: CBSE, ICSE, State Board — Maharashtra, State Board — Uttar Pradesh, State Board — Other, required). No photo upload. No last name. No location. No school name.
- [ ] "Next" button disabled until all three fields are filled. Progress indicator at top: Step 2 of 5 (for under-18).
- [ ] Step 4 — Parent Contact: Screen title: "Who should we ask for permission?" Subtext: "Indian law requires parental consent for learners under 18. We'll send a quick approval message."
- [ ] Toggle switch (tab-style, not checkbox): [WhatsApp] (default selected, phone icon) [Email] (envelope icon).
- [ ] WhatsApp selected: Phone input field. +91 prefix pre-filled, 10-digit input with auto-formatting (spaces after every 3 digits). Helper: "We'll send a WhatsApp message. No app download needed."
- [ ] Email selected: Email input field with standard email validation. Helper: "We'll send an email with an approval link."
- [ ] "Send Request & Start Exploring" button. Tiny link below: "Why do we need this? Learn about Indian data protection law." → Opens in-app modal with DPDP summary.
- [ ] Step 5a — Account Created (Under 18) → Explore Mode: On successful registration: StudentProfile created with status: AWAITING_PARENT_CONSENT. Consent request sent via chosen channel (WhatsApp/Email). explore_token (limited JWT) returned to app.
- [ ] Screen: "You're in, Aarav! 🎉" Body: "We've sent an approval request to +91 98XXXXXX12. While you wait, explore 3 free sample lessons!" Button: [Start Exploring] → Transitions to Explore Mode (Story S0.4). Secondary link: "Send a different contact" → Returns to Step 4.
- [ ] Step 5b — Account Created (Over 18): On successful registration: StudentProfile created with status: ACTIVE, consent_status: NOT_REQUIRED, isAdult: true. Full access_token returned.
- [ ] Screen: "Welcome to Spinzy! 🎉" Body: "You're all set. Let's find out where you stand with a quick diagnostic quiz." Button: [Take Diagnostic] → Transitions to Phase 1, Story S1.3 (Diagnostic Quiz). Secondary link: "Skip for now" → Goes directly to Learning Map (Phase 2).
- [ ] Backend (POST /api/v1/students/register): Request body validated with Zod schema. Age calculation: today - DOB. Precise to the day.
- [ ] If age ≥ 18: isAdult = true, consentStatus = NOT_REQUIRED, status = ACTIVE. Returns JWT with full scope.
- [ ] If age < 18: isAdult = false, consentStatus = AWAITING, status = AWAITING_PARENT_CONSENT. Creates ConsentRequest record. Sends WhatsApp/Email via service. Returns JWT with scope: EXPLORE_MODE.
- [ ] Rate limit: Max 3 registrations per device fingerprint per 24 hours.

### Dev Tasks
- [ ] Create StudentRegistrationWizard component with 5 steps (use framer-motion AnimatePresence)
- [ ] Create AgeGate component with accessible date picker
- [ ] Create ProfileCreationForm component
- [ ] Create ParentContactForm component with WhatsApp/Email toggle
- [ ] Create RegistrationSuccessScreen component (two variants: under-18, over-18)
- [ ] Implement Zod schemas: studentRegistrationSchema
- [ ] Implement age calculation utility (handles leap years, timezone offset)
- [ ] Implement device fingerprinting for rate limiting (use @fingerprintjs/fingerprintjs or simple hash of device info)
- [ ] Wire up POST /api/v1/students/register

### QA
- [ ] Full flow completes in under 2 minutes on a ₹8,000 Android phone
- [ ] Under-18: All 5 steps shown. Ends in Explore Mode. Consent request actually delivered
- [ ] Over-18: Steps 1-3 only. Ends on Diagnostic Quiz prompt
- [ ] WhatsApp/Email toggle correctly switches input field and validation
- [ ] Phone input formats correctly. Max 10 digits after +91
- [ ] Email validation shows error for invalid format
- [ ] Rate limiting: 4th registration from same device shows clear error
- [ ] Age edge cases: Born exactly 18 years ago today → Over-18
- [ ] All validation errors have clear, Hindi-friendly error messages
- [ ] Back button on each step returns to previous step without data loss

## S0.2 | P1 | Over-18 Student — Direct Learning Map Access
**ID:** S0.2
**Labels:** P1, phase:onboarding
**Phase:** Onboarding

### User Story
As a student aged 18 or above,
I want to skip the parental consent flow entirely and land directly on the Learning Map,
So that I face no unnecessary friction since I'm legally an adult under DPDP.

### Acceptance Criteria
- [ ] Age gate (Story S0.1, Step 2) determines adult status
- [ ] Adult students skip Steps 4 (Parent Contact) entirely
- [ ] Account created with: isAdult: true, consentStatus: NOT_REQUIRED, status: ACTIVE
- [ ] No ConsentRequest record created
- [ ] No parent record created (optional emergency contact can be added later in Settings — P2)
- [ ] Adult student lands on Diagnostic Quiz prompt (S1.3) or can skip to Learning Map (S2.1)
- [ ] All features fully unlocked. No freemium wall different from under-18 students
- [ ] In Admin Dashboard: Adult students are tagged with "Adult Student" badge in user list
- [ ] Backend: Same endpoint as S0.1. Branching logic at age verification step
- [ ] Prisma: StudentProfile.isAdult boolean field

### Dev Tasks
- [ ] Extend StudentRegistrationWizard with conditional step skipping for adults
- [ ] Add isAdult flag to student profile schema
- [ ] Update JWT scope generation for adult users
- [ ] Add admin dashboard badge for adult students

### QA
- [ ] Born exactly 18 years ago today → Treated as adult
- [ ] Born exactly 18 years ago tomorrow → Treated as child (consent required)
- [ ] Adult student can access AI Tutor, Practice, Topic Generation immediately
- [ ] No parent-related UI anywhere in the app for adult students

## S0.3 | P0 | Student Explore Mode — Learning While Waiting
**ID:** S0.3
**Labels:** P0, phase:onboarding
**Phase:** Onboarding

### User Story
As a student waiting for parent approval,
I want to explore sample lessons, take a diagnostic quiz, see my approval status, and re-send the consent request if needed,
So that I stay engaged and don't delete the app while waiting for my parent.

### Acceptance Criteria
- [ ] Explore Mode Home Screen: Top banner (sticky, dismissible): Text: "⏳ Waiting for Mom's approval. Explore 3 free sample lessons while you wait!" Dismiss button: Small "✕" to collapse banner. Banner re-appears on next app open.
- [ ] Approval Status Bar (collapsed by default, tap to expand): ✅ Profile Created (checkmark, green), ⏳ Approval Sent (pulsing dot, amber), ⬜ Parent Approved (greyed out). Text: "Sent to +91 98XXXXXX12 at 4:32 PM. Expires in 47 hours." "Send Reminder" button below status bar.
- [ ] Explore Mode Content — Sample Lessons: Curriculum Map rendered in locked/paused state. 3 Sample Topics are highlighted with "Free Preview" badge. Selected based on grade + board (e.g., Grade 5 CBSE → "Introduction to Fractions", "Types of Soil", "Parts of Speech"). Topics glow softly (pulsing border animation).
- [ ] All other topics visible but locked: 🔒 Lock icon overlay. Tapping a locked topic shows a tooltip/modal: "This topic unlocks when your parent approves. Explore our 3 free sample lessons in the meantime!" Button: "Send Reminder to Mom" Link: "View Sample Lessons" (scrolls to highlighted samples)
- [ ] Tapping a sample topic: Opens full lesson content (pre-generated core notes + video if exists). Fully functional. No paywall or blocker. After viewing: "Want to practice this topic? Unlock unlimited practice when your parent approves." "Mark as Complete" button tracks locally (not synced to server).
- [ ] Diagnostic Quiz in Explore Mode: Diagnostic Quiz (Story S1.3) is fully accessible in Explore Mode. 5 questions, adaptive difficulty. Score and placement result stored locally (AsyncStorage / IndexedDB). After quiz: "Great job! Your placement is saved. You'll see your full Learning Map once Mom approves."
- [ ] On consent approval: Locally stored diagnostic result is pushed to server and applied.
- [ ] Approval Status Monitoring: App polls GET /api/v1/consent/status?consent_token={token} every 15 seconds while Explore Mode is active. WebSocket connection as primary: Student subscribes to consent:{consent_token} on app open. Fallback: Polling if WebSocket fails or times out (3 seconds).
- [ ] On Status Change — APPROVED: Confetti animation (2 seconds). Screen: "Mom Approved! 🎉" with child's avatar celebrating. Subtext: "Get ready for unlimited learning!" 1.5-second transition → Full Learning Map (Story S2.1). Locally stored diagnostic result synced to server. Push notification (if enabled): "Your parent approved Spinzy! Start learning now."
- [ ] On Status Change — DENIED: Screen: "Access Not Approved". Body: "Your parent has declined access to Spinzy Academy. We recommend talking to them to understand why." Secondary body: "You can try again with a different parent contact." Button: "Send New Request" → Returns to Step 4 (Parent Contact). Profile anonymized: Name removed, only grade/board retained as aggregate stats. 72-hour cooldown before new request can be sent from same device.
- [ ] On Status Change — EXPIRED (48 hours): Banner updates: "Your approval request has expired. Send a new one?" Button: "Send New Request" → Returns to Step 4. No cooldown for expiry (different from denial).
- [ ] Reminder & Re-send: After 24 hours in Explore Mode with no response: Banner updates: "Mom might have missed it. Send a gentle reminder?" Button: "Send Reminder". Reminder re-sends original channel. Cooldown: 1 per 24 hours.
- [ ] "Change Contact" link: Opens WhatsApp/Email toggle with new input. If contact changed: Old ConsentRequest expires immediately. New request sent to new contact.
- [ ] Explore Mode Settings (⚙️ icon, top right): Shows: Current contact: Masked (+91 98XXXXXX12 / mom****@gmail.com). Request sent at: Timestamp. Expires in: Countdown timer (live). "Send Reminder" button. "Change Contact Method" → Opens Step 4. "Cancel Request" → Confirmation modal. On confirm: Profile deleted. App returns to Step 1 (Role Selection).
- [ ] Explore Mode Limitations: Sample Lessons (3 topics) ✅ Unlocked; Diagnostic Quiz ✅ Unlocked; AI Tutor (Teacher Vidya) ❌ Locked — "Ask Mom to approve to chat with Teacher Vidya!"; Practice Questions ❌ Locked — "Practice unlocks with parent approval. Explore sample lessons now!"; Topic Generation ❌ Locked — "Requesting new topics unlocks with parent approval."; Progress Tracking ❌ Off — "Your progress will be saved after parent approval."; Streaks & XP ❌ Off — "Streaks and rewards begin after approval!"
- [ ] Backend: GET /api/v1/students/explore-content?grade=5&board=CBSE — Returns exactly 3 sample topics with full content. GET /api/v1/consent/status?consent_token={token} — Returns { status, expiresAt, sentTo (masked), channel, reminderCount }. WebSocket: Student subscribes to consent:{consent_token} on app open. POST /api/v1/consent/resend — Body: { consent_token, new_channel?, new_contact? }. Validates cooldown (24h for same contact, immediate for new contact).

### Dev Tasks
- [ ] Create ExploreModeHome component (wrapper for entire Explore Mode experience)
- [ ] Create ExploreBanner component (sticky, dismissible)
- [ ] Create ApprovalStatusBar component (expandable timeline)
- [ ] Create ExploreMap component (locked variant of Learning Map with 3 glowing nodes)
- [ ] Create LockedFeatureModal component (reusable for locked features)
- [ ] Create ExploreSettings component (⚙️ menu)
- [ ] Implement useConsentStatus hook (WebSocket + polling fallback)
- [ ] Implement useLocalStorage service for diagnostic result caching
- [ ] Create ApprovalTransition component (confetti + celebration)
- [ ] Create DeniedScreen component
- [ ] Create ExpiredScreen component

### QA
- [ ] 3 sample lessons correctly selected based on grade + board
- [ ] All 3 sample lessons fully functional (content renders, images load, videos play if present)
- [ ] Locked topics show clear "Ask Parent" messaging, not generic error screens
- [ ] Diagnostic quiz fully functional. Score saved locally. Restored on app restart
- [ ] Polling updates status within 15 seconds of parent action
- [ ] WebSocket delivers approval in under 3 seconds
- [ ] Confetti animation plays on approval
- [ ] Transition from Explore Mode to Full Mode is seamless (no white flash, no app restart)
- [ ] Reminder sends. Cooldown works (24 hours)
- [ ] Changing contact correctly updates backend and sends new request
- [ ] Cancelling request deletes profile and returns to Role Selection
- [ ] Backend explore-content endpoint returns exactly 3 topics. No more, no less
- [ ] Rate limiting on resend (max 3 reminders per consent request)

## S0.4 | P1 | Student Re-Sends or Changes Consent Request
**ID:** S0.4
**Labels:** P1, phase:onboarding
**Phase:** Onboarding

### User Story
As a student whose parent hasn't approved or denied,
I want to re-send the consent request, change the contact method, or cancel and start over,
So that I'm never stuck waiting indefinitely.

### Acceptance Criteria
- [ ] From Explore Mode Settings (⚙️): "Send Reminder" — Resends original channel. Cooldown: 1 per 24 hours. "Change Contact Method" — Opens Step 4 from registration. Old request expired. New request sent. "Cancel Request" — Confirmation modal: "Are you sure? Your profile and diagnostic result will be deleted." On confirm: DELETE /api/v1/students/{id}. Redirect to Role Selection.
- [ ] From Denied Screen: "Send New Request" — Opens Step 4. Must use different contact (cannot re-send to same parent who denied). 72-hour device cooldown.
- [ ] From Expired Screen: "Send New Request" — Opens Step 4. No cooldown. Can use same or new contact.
- [ ] Backend: POST /api/v1/consent/resend — Cooldown validation. DELETE /api/v1/students/{id} — Soft delete or anonymize. Audit trail. Device cooldown tracked via device fingerprint in Redis (72-hour TTL for denials).

### Dev Tasks
- [ ] Extend ExploreSettings with reminder, change contact, cancel actions
- [ ] Implement DELETE /api/v1/students/{id} endpoint
- [ ] Implement device cooldown tracking in Redis for denied requests
- [ ] Add cooldown validation middleware for resend endpoint

### QA
- [ ] Reminder cooldown enforced across app restarts
- [ ] Cancel deletes profile correctly. Student can re-register immediately
- [ ] Denied cooldown prevents immediate re-send to same parent
- [ ] Denied cooldown allows re-send to DIFFERENT parent immediately
- [ ] Expired allows immediate re-send (no cooldown)

## S1.1 | P0 | Student Confirms Board & Grade (Post-Consent or Adult)
**ID:** S1.1
**Labels:** P0, phase:onboarding
**Phase:** Onboarding

### User Story
As a student entering the app for the first time with full access (post-consent or adult),
I want to confirm my board and grade via a visual carousel,
So that I don't have to type anything and the app serves me the right curriculum.

### Acceptance Criteria
- [ ] Pre-filled from registration data
- [ ] Board: Horizontal scrolling carousel with board logos/names (CBSE, ICSE, State Boards)
- [ ] Grade: Large tappable numbers (1-12) in a grid
- [ ] "This is Correct! →" button to confirm
- [ ] "Change" link to modify (returns to carousel)
- [ ] No text input fields
- [ ] If student was in Explore Mode and completed diagnostic: Skip confirmation. Go directly to Learning Map

### Dev Tasks
- [ ] Create BoardGradeConfirmation component
- [ ] Use useMemo to pre-select from profile data
- [ ] API: PATCH /api/v1/students/{id} to update if changed

### QA
- [ ] Pre-filled data matches registration
- [ ] Carousel scrolls smoothly on budget Android devices
- [ ] Confirmation proceeds to next step or Learning Map
- [ ] Change link allows modification

## S1.2 | P1 | Student Selects Study Buddy Avatar
**Labels:** P1, phase:onboarding
**Phase:** Onboarding

### User Story
As a student,
I want to choose an illustrated animal avatar as my "Study Buddy" (Fox, Owl, Elephant, Dolphin, Tiger),
So that I feel a sense of ownership and the app feels personalized.

### Acceptance Criteria
- [ ] Screen after Board/Grade confirmation
- [ ] 5 avatars displayed in a horizontal carousel
- [ ] Each avatar has: Large illustration, Name (e.g., "Vidya the Fox"), Trait (e.g., "Quick Thinker")
- [ ] Selected avatar has a glowing border and checkmark
- [ ] "Choose [Avatar Name]" button to confirm
- [ ] Avatar appears in top nav bar and Study Buddy hints throughout the app
- [ ] Can be changed later in Settings (P2)

### Dev Tasks
- [ ] Create AvatarSelection component
- [ ] Store avatar_id in StudentProfile
- [ ] Create StudyBuddy component (reusable, shows avatar + hint text)

### QA
- [ ] All 5 avatars render correctly
- [ ] Selection persists after confirmation
- [ ] Avatar appears in top bar after selection
- [ ] Study Buddy hints display correct avatar

## S1.3 | P0 | Adaptive Diagnostic Quiz (Right-Sizing)
**Labels:** P0, phase:onboarding
**Phase:** Onboarding

### User Story
As a student completing onboarding,
I want to take a short, gamified 5-question diagnostic quiz,
So that the app places me at the right difficulty level instead of boring me or overwhelming me.

### Acceptance Criteria
- [ ] Screen title: "Let's see what you know! 5 quick questions."
- [ ] Questions pulled from content bank: 2 questions from one grade below (warm-up), 2 questions from current grade, 1 question from one grade above (stretch)
- [ ] Mix of Math and Science (for grades 1-8) or subject chosen by student (9-12)
- [ ] Each question: 4 options, no timer, "Submit" button
- [ ] Instant feedback: Correct (green check + "Well done!"), Incorrect (amber + correct answer shown)
- [ ] Progress bar: "Question 3 of 5"
- [ ] After 5th question: Score ≥ 4: "You're a Prodigy! 🚀 Starting you at an advanced level." → starting_level: ADVANCED. Skips Chapter 1 basics.
- [ ] Score 2-3: "Solid foundation! 💪 Starting at grade level." → starting_level: STANDARD
- [ ] Score < 2: "Let's build from the basics. 🧱 Starting with fundamentals." → starting_level: FOUNDATION
- [ ] Placement stored: POST /api/v1/students/{id}/diagnostic-result
- [ ] "Continue to Learning Map" button
- [ ] If student was in Explore Mode: Diagnostic result is synced from local storage after consent

### Dev Tasks
- [ ] Create DiagnosticQuiz component
- [ ] Create QuizQuestion sub-component
- [ ] Create QuizResult component (score + placement + avatar reaction)
- [ ] API: GET /api/v1/content/diagnostic?grade=5&board=CBSE (returns 5 Qs)
- [ ] API: POST /api/v1/students/{id}/diagnostic-result

### QA
- [ ] Questions adapt based on grade and board
- [ ] Instant feedback displays correctly for correct/incorrect answers
- [ ] Score calculation matches answers
- [ ] Placement level stored correctly
- [ ] Quiz completes without crashes on low-end devices

## S2.1 | P0 | Learning Map Home Screen
**Labels:** P0, phase:core-learning
**Phase:** Core Learning Loop

### User Story
As a student,
I want to see my curriculum as a game-style "Learning Map" with chapters as nodes connected by paths,
So that I can visually understand my progress and feel motivated to unlock the next chapter.

### Acceptance Criteria
- [ ] Learning Map renders on home screen after onboarding
- [ ] Horizontal scrollable path with Chapter nodes: ✅ Completed: Green with checkmark. Shows score % (e.g., "85%"). 🔵 Current: Glowing/pulsing blue. "Start" or "Continue" label. 🔒 Locked: Grey with lock icon. Tapping shows: "Complete the previous chapter first!" 👑 Premium Locked: Grey with crown icon. Tapping shows upsell modal (Story S2.4).
- [ ] Top bar: Study Buddy avatar (tappable → shows greeting) + XP counter + Streak fire emoji
- [ ] Bottom: Chapter info panel (swipe up or fixed) showing current chapter name, topics count, completion %
- [ ] Pull-to-refresh to check for new content
- [ ] Search bar at top (for Method 2 on-demand discovery — Phase 3)
- [ ] Offline mode: Cached map renders. Last synced timestamp shown

### Dev Tasks
- [ ] Create LearningMap component with horizontal scroll
- [ ] Create ChapterNode sub-component (states: completed, current, locked, premium-locked)
- [ ] Create TopBar component (avatar, XP, streak)
- [ ] Create ChapterInfo component
- [ ] Implement useLearningMap hook (fetches chapters, topics, progress)
- [ ] API: GET /api/v1/students/{id}/learning-map?board=CBSE&grade=5

### QA
- [ ] Map renders correctly for all grade levels
- [ ] Horizontal scroll works smoothly
- [ ] Node states match backend progress data
- [ ] Pull-to-refresh updates map
- [ ] Offline mode displays cached map with timestamp

## S2.2 | P0 | View Pre-Generated Lesson Content
**Labels:** P0, phase:core-learning
**Phase:** Core Learning Loop

### User Story
As a student on the Learning Map,
I want to tap any unlocked topic and see a structured, easy-to-read lesson,
So that I can learn the concept before attempting practice questions.

### Acceptance Criteria
- [ ] Lesson view opens with smooth slide-in animation
- [ ] Content rendered in under 2 seconds (pre-generated, cached)
- [ ] Lesson structure: Title (e.g., "Introduction to Fractions"), Key Points Box (summary in 3-4 bullet points), Rich Text Body (formatted notes with headings, examples, images), Video Snippet (90 seconds, if available — YouTube embed or self-hosted, collapsible), Study Buddy Hint (avatar pops up with contextual tip at relevant sections — e.g., "Watch out! The denominator can never be zero.")
- [ ] "Mark as Complete" button at bottom → Sends POST /api/v1/students/{id}/progress/topic/{topic_id}/complete
- [ ] Content is scrollable. "Back to Map" button in top left
- [ ] Flag icon in top right: "Report an issue with this content" (triggers Story A1.5)
- [ ] Dark mode support (switches based on system preference or Exam Warrior Mode)
- [ ] Hindi content: If topic has Hindi version, language toggle at top

### Dev Tasks
- [ ] Create LessonView component
- [ ] Create KeyPointsBox sub-component
- [ ] Create StudyBuddyHint sub-component (reusable, positioned absolutely)
- [ ] Create ContentFlagButton component
- [ ] API: GET /api/v1/content/{topic_id}

### QA
- [ ] Lesson loads in under 2 seconds on 4G connection
- [ ] All content elements render correctly (text, images, video)
- [ ] Mark as Complete updates progress
- [ ] Dark mode toggles correctly
- [ ] Hindi toggle works when content available

## S2.3 | P0 | Practice Questions with Freemium Counter
**Labels:** P0, phase:core-learning
**Phase:** Core Learning Loop

### User Story
As a student,
I want to answer practice questions after studying a topic and see my daily remaining count,
So that I can test my understanding and the app clearly communicates my free tier limits.

### Acceptance Criteria
- [ ] Accessible from: Lesson View ("Practice This Topic" button), Learning Map (Practice icon on completed chapters)
- [ ] Top right badge: "X/5 Free Questions Left Today" (red/amber/green based on remaining). 3+ left: Green. 1-2 left: Amber. 0 left: Red → Tapping triggers Freemium Wall (Story S2.4)
- [ ] Question flow: Question displayed with 4 options. "Submit" button (no timer by default)
- [ ] On correct answer: Green flash animation. Study Buddy: "Brilliant! 🎉" +10 XP coin animation (coins fall from top right). Brief explanation shown (expandable)
- [ ] On incorrect answer: Red flash. Study Buddy: "No worries! Here's a hint." Hint shown (AI-generated, contextual). Correct answer revealed. No XP deducted
- [ ] "Next Question" button
- [ ] After last question in set: Summary card: Score (e.g., "4/5"), Accuracy %. "Review Mistakes" button (shows incorrect questions with correct answers). "Continue Learning" button (returns to Lesson or Map)
- [ ] If free questions exhausted: Freemium Wall modal (Story S2.4)
- [ ] Premium students: No daily limit. Unlimited practice. Daily limit badge hidden
- [ ] Offline: Cached questions can be attempted. Results synced when online

### Dev Tasks
- [ ] Create PracticeFlow component (manages question state, score)
- [ ] Create QuestionCard sub-component
- [ ] Create XPRewardAnimation component (Lottie or simple CSS animation)
- [ ] Create PracticeSummary component
- [ ] Create FreemiumLimitBadge component
- [ ] Implement usePractice hook (fetches questions, submits answers, tracks daily count)
- [ ] API: GET /api/v1/content/{topic_id}/practice?count=5
- [ ] API: POST /api/v1/students/{id}/practice/submit
- [ ] API: GET /api/v1/students/{id}/practice/remaining-today

### QA
- [ ] Daily limit badge updates correctly after each question
- [ ] XP awarded only on correct answers
- [ ] Coins animation plays on XP award
- [ ] Hint displays on incorrect answer
- [ ] Summary shows correct score and accuracy
- [ ] Freemium Wall triggers at 0 remaining
- [ ] Offline practice syncs when back online

## S2.4 | P0 | Freemium Wall — Student-Initiated Upsell
**Labels:** P0, phase:core-learning
**Phase:** Core Learning Loop

### User Story
As a free-tier student who has exhausted daily practice questions,
I want to see a friendly, encouraging modal that lets me request premium access from my parent,
So that I have a clear path to continue learning without feeling punished.

### Acceptance Criteria
- [ ] Freemium Wall Modal (Trigger: 0 free questions remaining + tap "Practice"): Overlay background: Semi-transparent dark (not opaque — student can still see the map behind). Illustration: Study Buddy looking encouraging (not sad).
- [ ] Headline: "You've crushed all 5 free questions today! 🏆" Subtext: "Want unlimited practice, AI tutoring, and chapter tests? Ask your parent to unlock Premium."
- [ ] Primary Button: [Ask Parent to Unlock] (Tangerine, large, full-width). Tapping sends push notification to parent (Story P3.1). Button changes state: "Request Sent! ✅" (disabled, 24-hour cooldown before re-send).
- [ ] Secondary Link: "Review Lesson Notes for Free" (returns to Lesson View — no dead end)
- [ ] Tertiary Link: "Wait until tomorrow? Your 5 free questions reset at midnight." (grey, smallest text)
- [ ] No "Cancel" or "X" to dismiss (must engage with one option)
- [ ] Freemium Wall Variant — AI Tutor Locked (3 prompts/day): Same structure but: Headline: "You've used 3 AI Tutor questions today! 🤖" Subtext: "Want to ask Teacher Vidya unlimited questions? Ask your parent to unlock Premium."
- [ ] Freemium Wall Variant — Chapter Quiz Locked: Headline: "Ready for the Chapter Quiz? 🔒" Subtext: "Chapter quizzes are a Premium feature. Get a detailed score and weak topic analysis."
- [ ] Parent Notification (Story P3.1 triggers): Parent receives push: "Aarav wants unlimited practice. Tap to upgrade." In-app badge on Parent Dashboard: "1 pending request."

### Dev Tasks
- [ ] Create FreemiumWallModal component (reusable, configurable by feature type)
- [ ] Create useFreemiumWall hook (manages daily limit state, request cooldown)
- [ ] API: GET /api/v1/students/{id}/freemium/limits (returns remaining counts for all features)
- [ ] API: POST /api/v1/students/{id}/freemium/request-upgrade (sends parent notification)

### QA
- [ ] Modal triggers correctly when free questions exhausted
- [ ] Each variant shows correct headline and subtext
- [ ] Ask Parent button sends notification and updates to disabled state
- [ ] Cooldown persists across app restarts
- [ ] Review Lesson Notes returns to lesson view
- [ ] No dismiss option forces engagement

## S2.5 | P1 | XP & Streak Reward System
**Labels:** P1, phase:core-learning
**Phase:** Core Learning Loop

### User Story
As a student,
I want to earn XP for completing lessons and questions, and maintain a daily streak,
So that I feel rewarded and motivated to learn every day.

### Acceptance Criteria
- [ ] XP Earning: Complete a lesson (Mark as Complete) +20 XP. Answer a practice question correctly +10 XP. Complete a topic (all lessons + practice) +50 XP (bonus). Complete a chapter +100 XP (bonus). Complete assigned practice (parent-assigned) +50 XP (bonus). 7-day streak achieved +200 XP (bonus).
- [ ] XP animation plays after each earning event (coins fall, counter increments)
- [ ] XP counter in Top Bar updates in real-time
- [ ] Level system: Every 500 XP = Level Up. Level displayed next to avatar (e.g., "Level 12")
- [ ] Streak System: Streak: Consecutive days with at least 1 learning action (lesson viewed or question answered). Streak counter in Top Bar: 🔥 with number.
- [ ] Streak rewards: 3 days: +50 XP. 5 days: Unlock new Avatar Accessory (hat, glasses, cape). 7 days: Unlock 1 Free Premium Day (24 hours of unlimited practice). 14 days: Unlock a rare Avatar color variant. 30 days: "Spinzy Legend" badge on profile.
- [ ] Streak resets to 0 after 48 hours of inactivity (not 24 — grace period for weekends)
- [ ] "Streak Freeze" power-up: Earned by completing 3 lessons in one day. Auto-applied on first missed day. Max 2 freezes stored.

### Dev Tasks
- [ ] Create XPAnimation component
- [ ] Create StreakTracker component in TopBar
- [ ] Create LevelUpModal component
- [ ] Implement useXP hook
- [ ] Implement useStreak hook
- [ ] API: POST /api/v1/students/{id}/xp/award (called internally by lesson/practice services)
- [ ] API: GET /api/v1/students/{id}/streak
- [ ] Backend: Cron job to reset streaks (runs daily at 00:05 IST, checks last_active_at)

### QA
- [ ] XP awarded correctly for each action type
- [ ] Level ups trigger at 500 XP intervals
- [ ] Streak increments with daily learning action
- [ ] 48-hour grace period prevents weekend reset
- [ ] Streak Freeze auto-applies on first missed day
- [ ] Rewards unlock at correct streak thresholds

## S3.1 | P0 | Search with Empty Result → Content Request Card
**Labels:** P0, phase:on-demand
**Phase:** On-Demand Discovery

### User Story
As a student searching for a topic,
I want to see a friendly "Request This Topic" card when no content exists,
So that I'm not stuck with a dead-end "No Results" page.

### Acceptance Criteria
- [ ] Search bar on Learning Map top
- [ ] Search queries content database (pre-generated + approved AI content)
- [ ] If ≥1 results: Show list with topic name, subject, short description. Tappable to open
- [ ] If 0 results: No dead-end page. Card appears: "We don't have notes on 'Black Soil vs Alluvial Soil' yet! 🧑‍🌾" Subtext: "Our AI Teacher can create them for you in about 30 seconds." Button: [Generate Notes for Me] Small text: "Generated content is AI-drafted and reviewed by teachers."
- [ ] Tapping button triggers Story S3.2 (Generation)
- [ ] If student already has a pending generation for this topic: Button changes to "Content is being prepared... ⏳" (disabled, shows status)

### Dev Tasks
- [ ] Create SearchBar component (autocomplete, debounced)
- [ ] Create SearchResults component
- [ ] Create ContentRequestCard component
- [ ] API: GET /api/v1/content/search?q={query}&grade={grade}&board={board}
- [ ] API: GET /api/v1/content/generation/status?topic={topic} (returns existing pending job if any)

### QA
- [ ] Search returns results for existing content
- [ ] Empty results show content request card
- [ ] Generate button triggers generation flow
- [ ] Pending status shows correct disabled button

## S3.2 | P0 | AI Content Generation with Loading Experience
**Labels:** P0, phase:on-demand
**Phase:** On-Demand Discovery

### User Story
As a student who requested content generation,
I want to see an engaging loading screen and get the first content within 15 seconds,
So that I don't abandon the app while waiting.

### Acceptance Criteria
- [ ] On "Generate Notes for Me" tap: Job enqueued: POST /api/v1/content/generation/request. Returns job_id
- [ ] Loading screen: Study Buddy animation: Fox/Vidya reading books, flipping pages. Fun progress messages (cycling every 3 seconds): "Searching the knowledge library... 📚", "Organizing key concepts... 🗂️", "Adding helpful examples... 💡", "Almost there... ✨". Progress bar (indeterminate for first 5 seconds, then shows estimated time)
- [ ] Content delivery: First block (Title + Introduction + 2 Key Points) returned within 15 seconds. Rendered immediately. Student can start reading. Remaining content streams in as student scrolls (infinite scroll or progressive loading)
- [ ] If generation takes >60 seconds: Fallback: "Taking a little longer than expected! We'll notify you when it's ready." Push notification sent to student when complete. Student can return to Learning Map and continue other activities.
- [ ] On complete: Content visible. Badge: "AI Draft — Under Review" (yellow, Story S3.3)
- [ ] Content is fully interactive: Can read, mark complete, generate practice questions from it

### Dev Tasks
- [ ] Create ContentGenerationLoading component
- [ ] Create StreamingContent component (renders partial content, appends on new data)
- [ ] Implement SSE (Server-Sent Events) for content streaming: GET /api/v1/content/generation/{job_id}/stream
- [ ] API: POST /api/v1/content/generation/request
- [ ] API: GET /api/v1/content/generation/{job_id} (polling fallback if SSE fails)
- [ ] Backend: AI generation worker (BullMQ consumer)
- [ ] Backend: Duplicate request merging (Story S3.4)

### QA
- [ ] First content block appears within 15 seconds
- [ ] Loading animation engages student while waiting
- [ ] Streaming content appends as student scrolls
- [ ] Fallback notification sends after 60 seconds
- [ ] Generated content has AI Draft badge
- [ ] Content can be marked complete and used for practice

## S3.3 | P1 | AI-Generated Content "Beta" Badge & Review Status
**Labels:** P1, phase:on-demand
**Phase:** On-Demand Discovery

### User Story
As a student viewing AI-generated content,
I want to see a clear "AI Draft" badge so I know it hasn't been reviewed by a teacher yet,
So that I understand the content quality may vary but I can still study it.

### Acceptance Criteria
- [ ] Yellow badge on content: "AI Draft — Under Review" with info icon
- [ ] Tapping badge: Tooltip: "This content was generated by AI and hasn't been reviewed by a teacher yet. It's still accurate, but may improve after review."
- [ ] Badge visible on: Lesson view, Search results, Learning Map node (if content is AI-generated)
- [ ] When admin approves content (Story A1.2 → A3.5): Badge changes to: "Teacher Approved ✅" (green). Content promoted to searchable public DB
- [ ] When admin rejects content: Badge changes to: "Under Revision — Improved version coming soon" (amber). Content still accessible but flagged
- [ ] Student can report issues with AI content: Flag button (Story A1.5)

### Dev Tasks
- [ ] Create ContentQualityBadge component (states: DRAFT, APPROVED, REVISION)
- [ ] Backend: content.status field: DRAFT | APPROVED | REJECTED | REVISION

### QA
- [ ] AI Draft badge shows on unapproved AI content
- [ ] Tooltip displays correct message on tap
- [ ] Badge updates to Approved when admin approves
- [ ] Badge updates to Revision when admin rejects
- [ ] Flag button accessible on AI content

## S3.4 | P1 | Duplicate Generation Request Merging
**Labels:** P1, phase:on-demand
**Phase:** On-Demand Discovery

### User Story
As a system,
I want to detect when multiple students request the same topic within a 15-minute window and merge those requests,
So that we don't waste AI generation resources on redundant work.

### Acceptance Criteria
- [ ] When a generation request is received: Check for any PENDING or PROCESSING job with the same topic slug (normalized) created within the last 15 minutes
- [ ] If match: Subscribe the new student to the existing job. Don't create a new job
- [ ] If no match: Create new job
- [ ] All subscribed students receive the same generated content when ready
- [ ] Admin Dashboard: Shows "Subscribed Students" count on each generation job
- [ ] Normalization: "Black Soil vs Alluvial Soil" = "black-soil-alluvial-soil" = "BLACK SOIL alluvial SOIL"

### Dev Tasks
- [ ] Job deduplication in ContentGenerationService
- [ ] Use Redis for fast topic lookup: SETEX content_gen:{normalized_topic} 900 {job_id} (15-min TTL)

### QA
- [ ] Duplicate request within 15 minutes uses existing job
- [ ] All subscribed students receive content when generated
- [ ] Admin dashboard shows subscription count
- [ ] Normalization catches variations of same topic name

## S4.1 | P1 | Student Receives Assigned Practice
**Labels:** P1, phase:assignments
**Phase:** Parent-Initiated Assignments

### User Story
As a student,
I want to see when my parent assigns me extra practice on a weak topic,
So that I know what to focus on and can earn bonus XP by completing it.

### Acceptance Criteria
- [ ] Notification: "Mom assigned you 10 extra questions on Long Division! Complete them to earn 50 Bonus XP! 🎁"
- [ ] Learning Map: Assigned topics have a special Parent Assigned glowing node with star icon
- [ ] Tapping assigned node: Opens 10-question practice set. Same UI as regular practice (Story S2.3). Above questions: "Assigned by Mom — Complete for 50 Bonus XP!"
- [ ] On completion: +50 XP bonus animation. Parent notified: "Aarav completed the Long Division practice! Score: 8/10. Accuracy improved from 42% to 80%."
- [ ] Assignment appears in a new section: "Assigned by Parent" (below Learning Map, collapsible)

### Dev Tasks
- [ ] Create AssignedPracticeCard component
- [ ] Create ParentAssignmentList component
- [ ] API: GET /api/v1/students/{id}/assignments
- [ ] API: POST /api/v1/students/{id}/assignments/{id}/complete

### QA
- [ ] Push notification received for new assignment
- [ ] Learning Map shows glowing star node for assigned topic
- [ ] Bonus XP awarded on completion
- [ ] Parent notified of completion and score
- [ ] Assignment section shows pending and completed assignments

## S5.1 | P2 | Weekly Streak Rewards (Streak reward schedule enforcement)
**Labels:** P2, phase:retention
**Phase:** Long-Term Retention

### User Story
As a student maintaining a learning streak,
I want to receive rewards automatically when I hit streak milestones,
So that I stay motivated to learn daily.

### Acceptance Criteria
- [ ] Streak rewards auto-applied when thresholds reached
- [ ] "Free Premium Day" (7-day streak): Student gets 24 hours of unlimited practice. Timer shown: "Premium Day: 18 hours remaining."

### Dev Tasks
- [ ] Implement streak reward scheduler
- [ ] Add Free Premium Day activation logic
- [ ] Add countdown timer for premium day

### QA
- [ ] Rewards trigger at correct streak thresholds
- [ ] Free Premium Day enables unlimited practice for 24 hours
- [ ] Timer counts down correctly
- [ ] Rewards persist across app restarts

## S5.2 | P2 | Weekend Practice Arena (Free-for-All)
**Labels:** P2, phase:retention
**Phase:** Long-Term Retention

### User Story
As a free-tier student,
I want unlimited practice on previously mastered topics every Saturday,
So that I can reinforce old concepts without hitting the daily question limit.

### Acceptance Criteria
- [ ] Every Saturday 00:00 IST to 23:59 IST: "Practice Arena" unlocks
- [ ] Arena contains: All topics where student accuracy ≥ 70% (i.e., mastered)
- [ ] Arena banner: "Weekend Free Play! ♾️ Practice unlimited questions on topics you've already mastered."
- [ ] No daily question limit in the Arena
- [ ] XP earned in Arena: 50% of normal (prevents XP farming)
- [ ] Arena disappears Sunday 00:00 IST
- [ ] New topics (accuracy < 70%) NOT in arena. Student must wait for weekday reset or upgrade

### Dev Tasks
- [ ] Create WeekendArena component (togglable based on day + IST timezone)
- [ ] API: GET /api/v1/students/{id}/arena/topics (returns mastered topics only)
- [ ] Backend: Check server time in IST. Enable arena flag

### QA
- [ ] Arena unlocks Saturday 00:00 IST
- [ ] Only mastered topics (≥70% accuracy) appear in arena
- [ ] Unlimited practice available during arena hours
- [ ] XP awarded at 50% rate
- [ ] Arena locks Sunday 00:00 IST

## S5.3 | P2 | Exam Warrior Mode
**Labels:** P2, phase:retention
**Phase:** Long-Term Retention

### User Story
As a student during exam season,
I want to activate "Exam Warrior Mode" with dark theme, countdown timers, and mock test format,
So that I can focus intensely and simulate real exam conditions.

### Acceptance Criteria
- [ ] Activation: Admin triggers exam season (e.g., Feb 1 for CBSE) OR student manually toggles in Settings
- [ ] UI changes: Dark theme across entire app. Gamification minimized (no XP coins, no level-up modals). Home screen: "X Days Until Math Exam" countdown (if parent set exam dates). Practice mode: Full-length mock tests with timers.
- [ ] Study Buddy changes tone: Encouraging but serious. "Stay focused. You've got this."
- [ ] "Take a Break" button: Forces a 5-minute break after 45 minutes of continuous study
- [ ] Deactivation: Manual toggle or auto after admin-set exam end date

### Dev Tasks
- [ ] Create ExamModeToggle component
- [ ] Create CountdownTimer component (configurable)
- [ ] Implement dark theme using Tailwind dark mode (class-based)
- [ ] API: GET /api/v1/system/exam-schedule (returns admin-set exam dates)

### QA
- [ ] Dark theme applies across all screens in Exam Mode
- [ ] XP animations and level-ups suppressed
- [ ] Countdown timer shows correct days until exam
- [ ] Break reminder triggers after 45 minutes
- [ ] Mode deactivates after admin end date

## S5.4 | P2 | Summer Brain Gain Challenge
**Labels:** P2, phase:retention
**Phase:** Long-Term Retention

### User Story
As a student on summer vacation,
I want a gamified 30-day challenge with fun puzzles and daily levels,
So that I keep learning and don't forget everything over the break.

### Acceptance Criteria
- [ ] Event: April 15 – June 15 (configurable by admin)
- [ ] "Summer Island" map (separate from Learning Map)
- [ ] 30 levels (1 per day). Each level: 1 puzzle: Mix of Math riddles, Science facts, English word games, Logic puzzles. No curriculum pressure. Pure reinforcement + fun. Takes 5-10 minutes.
- [ ] Progress tracking: Islands unlocked. Streak within the challenge
- [ ] Complete 20+ levels: Earn "Summer Brain Saver" certificate (PDF, shareable to WhatsApp)
- [ ] Complete all 30: Unlock exclusive Summer Avatar + 500 XP bonus
- [ ] New levels unlock daily at 6 AM IST
- [ ] Missed levels: Can catch up (max 3 days back) but no streak bonus

### Dev Tasks
- [ ] Create SummerIsland map component
- [ ] Create DailyPuzzle component
- [ ] Create Certificate component (generates PDF using @react-pdf/renderer)
- [ ] Create ShareCertificate component (WhatsApp share intent)
- [ ] API: GET /api/v1/events/summer-challenge/status
- [ ] API: GET /api/v1/events/summer-challenge/puzzle?day={day}
- [ ] API: POST /api/v1/events/summer-challenge/submit

### QA
- [ ] Summer Island appears during configured date range
- [ ] Daily level unlocks at 6 AM IST
- [ ] Puzzles are fun and educational (5-10 min completion)
- [ ] Certificate generates and shares to WhatsApp
- [ ] Completion rewards (avatar, XP) awarded correctly
- [ ] Catch-up allows up to 3 missed days
```
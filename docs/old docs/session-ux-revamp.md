# Session UX Revamp — Engineering Documentation

**Document version:** 1.0  
**Audience:** Engineers maintaining or extending the Spinzy session experience  
**Scope:** Session UI layer; excludes changes to the deterministic session engine

---

## 1. Purpose of the Session UX Redesign

### 1.1 Why the Previous UX Needed Improvement

The original session experience delivered the correct tutoring sequence and content but suffered from several UX gaps:

- **Phase clarity:** Students could not easily see where they were in the session or what steps remained. Progress was either absent or conveyed through a single progress bar with limited meaning.
- **Tutor presence:** The experience felt like static content delivery rather than guided tutoring. There was little sense of a tutor guiding the student through the flow.
- **Structured guidance:** Phases did not consistently explain their purpose, and calls to action were embedded inconsistently within each phase, leading to uneven navigation patterns.
- **Emotional reward at completion:** The end-of-session experience did not clearly celebrate completion, summarize performance, or guide the student to the next recommended topic.

These gaps reduced the perceived quality of the product and made it harder for Spinzy to position itself as a true replacement for home tuition.

### 1.2 Goal: Sessions as Guided Tutoring

The redesign aimed to make sessions feel like a **guided tutoring experience** rather than a sequence of content screens. Students should:

- Always know which step they are on and what comes next.
- Receive contextual tutor guidance appropriate to each phase.
- Experience a single, predictable place for “next step” actions.
- Be rewarded at completion with a clear summary and a path to the next topic.

### 1.3 Alignment with Spinzy’s Mission

Spinzy’s mission is to replace traditional home tuition with an AI-powered digital tutor. For that to be credible, the session must feel like a tutor-led lesson: structured, supportive, and completion-oriented. The UX revamp focuses exclusively on the presentation and interaction layer so that the existing, deterministic learning engine can remain the single source of truth for pedagogy and flow, while the UI clearly communicates structure, guidance, and progress.

---

## 2. Design Principles

The redesign is guided by the following principles.

### 2.1 Tutor-Guided Learning

Every phase should feel accompanied by the tutor. The TutorTipPanel and phase-specific copy (headlines, instructions, encouragement) reinforce that the student is not alone: the system is guiding them. This principle is especially important for grades 6–12, where self-regulation is still developing and presence of a “guide” supports engagement.

### 2.2 Clear Phase Progression

Students must see where they are in the session and what steps remain. The SessionProgressBar presents the five learning steps (Overview, Learn, Practice, Quick Test, Homework) with explicit completed, current, and upcoming states. “Step X of 5” and step labels reduce cognitive load and support planning.

### 2.3 Confidence-Building Practice

Practice is framed as low-stakes reinforcement. Messaging (e.g. “Let’s solve a few questions together”, “Don’t worry if you make mistakes”) and immediate feedback (e.g. “Great job!” / “Almost there — try again.”) are designed to build confidence rather than anxiety. This aligns with best practices for adolescent learners.

### 2.4 Evaluation Before Mastery

The Quick Test phase is explicitly framed as an evaluation step (“Let’s check what you’ve learned”) with minimal hints and a clear “Submit Test” action. The UI distinguishes practice (supportive, feedback-rich) from test (assessment). This supports metacognition and clear expectations.

### 2.5 Rewarding Completion

The EndOfSessionCard provides a dedicated completion experience: a clear “Session Complete” headline, an optional performance summary, and a next-topic recommendation with reason and primary CTA. Celebrating completion and offering a clear next step supports retention and continued usage.

### 2.6 Why These Principles Matter for Grades 6–12

Students in this range benefit from structure, clear expectations, and reduced ambiguity. A single, consistent navigation pattern (SessionFooter), visible progress (SessionProgressBar), contextual tips (TutorTipPanel), and a rewarding completion screen reduce decision fatigue and support sustained engagement without requiring changes to the underlying learning logic.

---

## 3. Session Flow Architecture

### 3.1 The Tutoring Flow

Sessions follow a fixed, deterministic sequence:

1. **OVERVIEW** — Orientation: topic name, session steps preview, estimated time, learning goals, tutor intro. The student confirms readiness before starting.
2. **EXPLANATION** — Learning: topic explanation and key concepts (notes content). The student reads and then proceeds.
3. **PRACTICE** — Reinforcement: a fixed number of practice questions with immediate feedback per question. Results are submitted; the engine advances only after submission.
4. **TEST** — Evaluation: all test questions presented at once; the student answers and submits. No per-question feedback; results shown after submit.
5. **HOMEWORK** — Assignment: homework is presented with due date and option to start now or complete later. Session can complete either way.
6. **COMPLETE** — Terminal: end-of-session screen (EndOfSessionCard) with completion message, performance summary (when data exists), and next-topic recommendation.

The engine may also transition to **EXPIRED** if the session has timed out; that state is handled separately in the UI.

### 3.2 Pedagogical Role of Each Phase

- **Overview** ensures the student never “jumps” straight into content; they see the plan and commit to the session.
- **Explanation** delivers the core instructional content.
- **Practice** reinforces learning with low-stakes questions and instant feedback.
- **Test** provides a summative check before the session is considered complete.
- **Homework** extends learning beyond the session and supports spacing.

Transitions (e.g. from Practice to Test) are controlled by the engine based on completion rules (e.g. at least one practice answer, test submitted). The UI does not decide when a phase is “done”; it only exposes actions that trigger engine APIs (advance, submit practice, submit test).

### 3.3 How the Deterministic Engine Controls Transitions

The session engine and related modules define:

- The canonical phase order and allowed transitions.
- When a phase is considered complete (e.g. phaseCompletionValidator).
- How state is persisted and how the next phase is determined (e.g. transitionSessionPhase).

The UI calls APIs (start session, advance phase, submit practice, submit test). The server applies validation and state updates; the client then receives the updated session view (including currentPhase) and re-renders. The UI never computes the next phase locally; it only reflects engine state and invokes actions.

---

## 4. UI Architecture

### 4.1 Entry Point and Container

The session route renders **SessionContainer**, which is the root orchestrator. It uses the useSession hook for all session lifecycle (start, advance, submit practice, submit test), resolves the current phase and content, and handles loading and error states. For the normal flow it resolves the phase component via **phaseRouter** and renders it inside **SessionLayout**. For terminal states (COMPLETE, EXPIRED) it renders the appropriate screen (e.g. EndOfSessionCard for COMPLETE) without a phase component. SessionContainer also builds phase-specific props (content, callbacks) and **footer configuration** (CTA label, disabled state, click handler) from the current phase and phase-reported readiness.

### 4.2 SessionLayout

**SessionLayout** provides the consistent shell for every session view: a sticky **SessionHeader**, a main content area (children), and an optional **SessionFooter**. It accepts an optional footer config (next label, onNext, disabled, loading, previous). When footer is provided, the main area uses extra bottom padding so content is not obscured by the sticky footer. Layout does not contain session logic; it only composes header, main, and footer.

### 4.3 SessionHeader

**SessionHeader** displays session context: typically a breadcrumb (e.g. subject and topic name) and the **SessionProgressBar**. It receives the session view and phase metadata so it can show the current step and topic. It is sticky at the top so progress and context remain visible while scrolling.

### 4.4 SessionProgressBar

**SessionProgressBar** renders the five learning steps (Overview, Learn, Practice, Quick Test, Homework) as a vertical step list. It receives currentPhase and phase index/total from the session view. Each step is shown as completed (checkmark), current (filled dot), or upcoming (empty circle). A “Step X of 5” line is shown at the top. The component is purely presentational; it derives state from props and does not call session APIs. It returns nothing for COMPLETE and EXPIRED.

### 4.5 SessionFooter

**SessionFooter** is the single place for the primary “next step” action during a session. It displays one main button with a phase-specific label (e.g. “Start Learning”, “Start Practice”, “Continue”, “Submit Test”, “Finish Session”) and optionally a previous button. The container decides the label and whether the button is enabled based on phase and on **readiness signals** from the active phase (e.g. onReadyToProceed, test all-answered, test result received). When the user clicks, the container runs the appropriate action (advance phase or trigger test submit). The footer does not implement learning rules; it only renders the CTA and delegates the click to the container.

### 4.6 TutorTipPanel

**TutorTipPanel** is a small panel that displays contextual tutor guidance (a short tip string). It is used in Explanation, Practice, and Test phases. Each phase passes a phase-appropriate tip (e.g. “Focus on the example carefully”, “Don’t worry if you make mistakes”, “Answer all questions, then submit”). The panel can be dismissed by the user. Layout is responsive: on larger screens it typically appears in a sidebar; on smaller screens it can appear above the main content so the experience remains usable.

### 4.7 EndOfSessionCard

**EndOfSessionCard** is shown when the session is in COMPLETE state. It displays a completion headline, an optional performance summary (accuracy, practice/test counts, mastery), a next recommended topic card (fetched from the existing next-action API), a primary CTA to start the next topic, and a secondary CTA to return to the dashboard. It does not drive session state; it only consumes topic name and subject from the session and optionally performance data if provided by the parent.

### 4.8 phaseRouter

**phaseRouter** is a pure mapping from phase identifier to the React component for that phase (OverviewPhase, ExplanationPhase, PracticePhase, TestPhase, HomeworkPhase). It returns null for COMPLETE and EXPIRED so the container can render the terminal UI. Adding a new phase in the engine would require a new phase component and an entry in this map; the container and layout remain unchanged.

### 4.9 Component Interaction Summary

SessionContainer owns session state and footer state (readiness, test submit handler registration). It passes content and callbacks (including onReadyToProceed, onTestStateChange, onRegisterTestSubmit for Test) into the phase component returned by phaseRouter. Phase components render their UI and optionally TutorTipPanel; they do not render the primary CTA button—they signal readiness and, in Test, register a submit handler. SessionContainer builds the footer config from phase and readiness and passes it to SessionLayout, which renders SessionFooter. Thus the flow is: phase signals readiness → container enables footer → user clicks footer → container runs advance or submit → engine returns new state → container re-renders with new phase or content.

---

## 5. Phase UX Behavior

### 5.1 OverviewPhase

**UI elements:** Topic introduction (“Today we will learn: …”), session steps preview (Overview → Learn → Practice → Quick Test → Homework), optional estimated time, learning goals (“You will:” with checkmarks), tutor intro message, optional summary. No primary button in the phase body; the primary CTA is in the footer.

**Tutor guidance:** The tutor block uses a reason label when provided (e.g. from recommendation) or a default message encouraging attention to the example.

**Student interaction:** The student reads the overview and uses the footer “Start Learning” button to proceed. The phase signals ready on mount so the footer is enabled immediately (unless loading).

**Transition expectations:** Clicking the footer triggers advancePhase. The engine moves to EXPLANATION.

### 5.2 ExplanationPhase

**UI elements:** Phase title (from content), sections of explanation text, optional sidebar with TutorTipPanel. No CTA inside the phase; the footer holds the primary action.

**Tutor guidance:** TutorTipPanel shows a tip such as “Focus on the example carefully.” Layout is responsive (sidebar on desktop, tip above content on mobile).

**Student interaction:** The student reads the content and proceeds via the footer “Start Practice” button. The phase signals ready on mount.

**Transition expectations:** Footer click calls advancePhase; the engine transitions to PRACTICE.

### 5.3 PracticePhase

**UI elements:** Phase header (“Practice Time”), tutor encouragement (“Let’s solve a few questions together”), question progress (“Question X of Y”), per-question prompt and choices, optional feedback message after each answer (e.g. “Great job!” / “Almost there — try again.”), and a results screen after the last question is submitted showing score and per-question correctness. TutorTipPanel in the sidebar. No primary CTA in the phase; the footer shows “Continue” only after results are available.

**Tutor guidance:** TutorTipPanel offers low-stakes messaging (e.g. mistakes are part of learning). Feedback messages after each answer reinforce or encourage.

**Student interaction:** The student answers each practice question in sequence. After the last answer, answers are submitted; when the engine returns a result, the results view is shown and the phase signals ready. The footer then shows “Continue” and advances to the next phase when clicked.

**Transition expectations:** Practice completion is determined by the engine (e.g. at least one answer, full submit). The UI only submits and then calls advancePhase when the user clicks the footer after results.

### 5.4 TestPhase

**UI elements:** Phase header (“Quick Test”), instruction (“Let’s check what you’ve learned”), question counter (“Question X of Y”) per question card, all questions and choices on one scrollable page, optional hint that all questions must be answered before submitting. TutorTipPanel with minimal guidance (e.g. “Answer all questions, then submit.”). No “Submit Test” or “Continue” button inside the phase; both actions live in the footer.

**Tutor guidance:** Tips are minimal to emphasize that the test is an evaluation step. The footer label is “Submit Test” until the test is submitted, then “Continue.”

**Student interaction:** The student answers all questions. The phase reports whether all are answered and whether the result has been received. The footer is enabled when all are answered; clicking it triggers the registered submit handler (which submits answers and then shows results). After results, the phase reports result received; the footer label switches to “Continue” and clicking advances the phase.

**Transition expectations:** The engine considers the test complete when answers are submitted and validated. The UI does not advance until the user clicks the footer after seeing results.

### 5.5 HomeworkPhase

**UI elements:** Homework assignment card (question count, due date, status), tutor note about completing homework soon, optional “Start Homework Now” link/button (navigates to homework/test flow). No primary “Finish Session” or “Complete Later” button in the phase; the footer holds “Finish Session.”

**Tutor guidance:** Short message about the benefit of doing homework within a few hours. No TutorTipPanel required for this phase in the current design.

**Student interaction:** The student can start homework now (navigates away) or use the footer “Finish Session” to complete the session. The phase signals ready on mount so the footer is enabled.

**Transition expectations:** Footer click calls advancePhase; the engine moves to COMPLETE.

---

## 6. SessionProgressBar Design

### 6.1 Role

The SessionProgressBar replaces a generic progress bar with a **step-based representation** of the session so students see exactly which steps exist, which are done, which is current, and which are upcoming.

### 6.2 Step Structure

The steps are the five displayable phases in order: **Overview**, **Learn** (Explanation), **Practice**, **Quick Test** (Test), **Homework**. Labels and order come from the client-phase config (e.g. PHASE_ORDER and PHASE_UI_CONFIG) so the bar stays in sync with the phase model without hardcoding.

### 6.3 Visual States

- **Completed:** Step index less than current phase index. Shown with a checkmark and muted text so the student sees what they have already done.
- **Current:** Step index equals current phase index. Shown with a filled dot and emphasized text; can be marked with aria-current for accessibility.
- **Upcoming:** Step index greater than current phase index. Shown with an empty circle and lighter text so the student sees what is left.

### 6.4 Mapping to Phases

The component receives currentPhase and phase index/total from the session view. It maps the current phase to the step index using the same ordered list used elsewhere (PHASE_ORDER). COMPLETE and EXPIRED are not rendered in the bar; the component returns null for those so the header does not show progress on the end screens.

---

## 7. TutorTipPanel System

### 7.1 Purpose

TutorTipPanel provides **contextual tutor guidance** so the session feels accompanied rather than static. It reinforces the idea that the tutor is present and giving phase-appropriate advice.

### 7.2 Usage Across Phases

- **Explanation:** Tip encourages focus on the example (e.g. “Focus on the example carefully.”).
- **Practice:** Tip reduces anxiety (e.g. “Don’t worry if you make mistakes. Practice helps learning.”).
- **Test:** Tip is minimal and procedural (e.g. “Answer all questions, then submit.”).

Each phase passes a single tip string. The panel does not choose the text; it only displays it, keeping phase logic in the phase components.

### 7.3 Behavior and Layout

The panel is dismissible; once dismissed it does not show again for that phase. Layout is responsive: on desktop it typically sits in a sidebar next to the main content; on mobile it can appear above the main content so the tip is visible without taking space from the primary task. This keeps tutor presence without overwhelming the main interaction.

---

## 8. SessionFooter Navigation

### 8.1 Why Centralize in the Footer

Previously, each phase implemented its own primary button (e.g. “Start Learning”, “Continue to Practice”). That led to inconsistent placement, styling, and behavior. Centralizing the primary CTA in **SessionFooter** gives one predictable location and one component to style and reason about, and ensures consistent behavior (e.g. loading state, disabled state) across phases.

### 8.2 Phase-Specific CTA Labels

The container maps the current phase (and, for Test, pre- vs post-submit state) to the footer label:

- Overview → “Start Learning”
- Explanation → “Start Practice”
- Practice → “Continue” (enabled only after results)
- Test → “Submit Test” (before submit), “Continue” (after results)
- Homework → “Finish Session”

The footer only renders the label and button; it does not decide the label or when to enable it.

### 8.3 How Phases Signal Readiness

Phases do not render the primary CTA themselves. They signal readiness so the container can enable or disable the footer and choose the right action:

- **Overview, Explanation, Homework:** Signal ready on mount (e.g. onReadyToProceed(true)) so the footer is enabled immediately.
- **Practice:** Signal not ready until the result is available after submitting all answers; then signal ready so “Continue” appears and works.
- **Test:** Report (allAnswered, resultSet). Before submit, the footer is enabled when allAnswered and triggers the registered submit handler; after resultSet, the footer shows “Continue” and triggers advancePhase.

The container holds footer state (e.g. phaseReadyToProceed, testAllAnswered, testResultSet) and a ref for the Test phase’s submit handler. Phases call callbacks (onReadyToProceed, onTestStateChange, onRegisterTestSubmit) so the container can update that state. The footer does not control learning logic; it only invokes the handler passed by the container.

---

## 9. EndOfSessionCard Redesign

### 9.1 Completion Experience

The EndOfSessionCard is the final screen when the session state is COMPLETE. It is designed to be **rewarding and informative** and to guide the student to the next action.

### 9.2 Elements Shown

- **Completion headline:** “Session Complete” with a celebration cue and a line such as “You completed [topic name].”
- **Performance summary:** Optional section showing Accuracy, Practice questions completed, Test questions completed, and Mastery status. When performance data is not provided, placeholders (e.g. “—”) keep the layout consistent and allow future wiring of real data without changing the component contract.
- **Next recommended topic card:** “Next Topic” label, recommended topic name, “Reason: …” (from the next-action API when available), and optional estimated time. Fetched via the existing client-side next-action API; no changes to the recommendation engine.
- **Primary CTA:** “Start Next Topic” linking to the session route for the recommended topic.
- **Secondary CTA:** “Return to Dashboard” as a clear secondary action.

### 9.3 Importance of Completion Reward

A clear, positive completion experience supports perceived progress and encourages the student to continue. Showing a performance summary (when data exists) and a justified next topic (with reason) makes the transition to the next session feel intentional and supported, which is important for long-term engagement and for Spinzy’s position as a replacement for home tuition.

---

## 10. System Constraints

### 10.1 Files That Must Not Be Modified by UI Work

The following files implement the **deterministic session engine** and phase logic. UI changes must not modify them:

- **lib/session/sessionEngine.ts** — Session lifecycle, phase order, session view shape, and core APIs (start, advance, submit practice, submit test). Changing this would risk inconsistent state and broken transitions.
- **lib/session/phaseRouter.tsx** — Mapping from phase identifier to phase component. It is a thin, stable map; new phases require coordinated engine and UI changes and should be done in a controlled way.
- **lib/session/transitionSessionPhase.ts** — Implementation of phase transitions and state updates. UI must not duplicate or override this logic.
- **lib/session/phaseCompletionValidator.ts** — Rules that determine when a phase is complete (e.g. minimum practice answers, test submitted). The UI must not relax or bypass these rules.

### 10.2 Why the Engine Must Remain Untouched

The engine is the single source of truth for:

- Which phases exist and in what order.
- When a phase is considered complete.
- How session and phase state are persisted and exposed.

The UI layer should only:

- Reflect current phase and content from the session view.
- Invoke engine APIs (start, advance, submit) in response to user actions.
- Present progress, tips, and CTAs based on current state and phase-reported readiness.

Keeping the engine untouched preserves correctness, testability, and the ability to evolve pedagogy (e.g. new phases or completion rules) in one place without unintended side effects from UI changes.

---

## 11. Implementation Strategy

The redesign was implemented in **incremental steps** to limit risk and keep the engine unchanged.

### 11.1 Phases of Implementation

1. **SessionProgressBar upgrade** — Replaced the previous progress representation with a step list (completed / current / upcoming) driven by PHASE_ORDER and phase config. Purely presentational; no API or engine changes.
2. **TutorTipPanel integration** — Introduced TutorTipPanel and wired it into Explanation, Practice, and Test with phase-specific tip text and responsive layout. Phases continued to own their CTAs at this stage.
3. **Overview phase UX improvements** — Added topic intro, session steps preview, estimated time, learning goals, and tutor intro message. No change to completion or transition logic.
4. **Practice phase feedback improvements** — Added phase header, encouragement copy, question progress, and per-answer feedback messages. No change to question fetching or submission flow.
5. **Test phase clarity** — Added “Quick Test” header, instruction copy, per-question counter, and minimal tips. Submit and continue behavior remained inside the phase.
6. **SessionFooter activation** — Moved the primary CTA into SessionFooter with phase-specific labels; phases were refactored to signal readiness (onReadyToProceed, onTestStateChange, onRegisterTestSubmit) and to remove in-phase primary buttons. Container took over footer state and click handling.
7. **EndOfSessionCard redesign** — Added completion headline, performance summary (with optional data), next-topic card with reason, and clear primary and secondary CTAs. Next recommendation still loaded via existing next-action API.

### 11.2 Why Incremental Steps

Implementing in small, ordered steps allowed:

- **Isolated changes:** Each step could be reviewed and tested without touching the engine.
- **Rollback clarity:** If an issue appeared, the offending step was easy to identify.
- **Stable contracts:** Phase props and container behavior evolved gradually (e.g. from onNext to onReadyToProceed + footer), reducing big-bang refactors.
- **Preserved behavior:** Transitions and validation remained entirely in the engine; only presentation and placement of CTAs changed.

---

## 12. Future Improvements

The following enhancements can be pursued **without modifying the session engine**, by extending only the UI and optional client or server-side data passed into existing components.

### 12.1 AI Tutor Voice Explanations

Explanation (and optionally Overview) could offer an audio “tutor read” of the content. Implementation would add a play/pause control and call a voice or TTS API; phase content and phase flow would stay the same. SessionContainer and phase components would only gain optional audio state and UI.

### 12.2 Adaptive Difficulty Messaging

If the engine or a separate API ever exposes difficulty or band (e.g. “intro”, “reinforce”), the UI could show short, encouraging messages (e.g. “You’re working at the right level for you.”) in Practice or Test. This would be copy and optional props only; no change to phase order or completion rules.

### 12.3 Learning Streak Indicators

A streak (e.g. “3 days in a row”) could be computed outside the session (e.g. dashboard or home API) and passed into SessionHeader or EndOfSessionCard as an optional prop. Display would be purely presentational.

### 12.4 Session Gamification

Badges, points, or level-up cues could be driven by post-session or dashboard logic and displayed on the EndOfSessionCard or in the header. The session engine would still control only phase flow and completion; gamification would consume session outcome data without changing how sessions run.

### 12.5 Visual Mastery Progress

If mastery or progress data is exposed (e.g. from the same API that powers recommendations), EndOfSessionCard could show a simple mastery indicator (e.g. bar or label) using the existing optional performance prop. No engine change required; only the source of that data and the rendering of it would be updated.

### 12.6 Safe Extension Pattern

In all cases, safe extension means: keep phase order, transition rules, and completion validation in the engine; add or change only UI components, props, and data fetching that feed into those components. New APIs or services can provide new data (e.g. streaks, mastery) as long as the session engine remains the sole authority for session and phase state.

---

*End of document.*

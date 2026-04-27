# Spinzy Upgraded Architecture Document

Manish, below is a **clear visual wireframe (text-style)** for the **Spinzy Dashboard** and the **Session Page**.
These are **MVP wireframes**, not final UI design — they define **structure, hierarchy, and flow** so the team can implement **one stable UX**.

The guiding principle:

> The student should **always know what to do next**.

Everything else is secondary.

---

## 1. Spinzy Dashboard — Wireframe

**Purpose:** Tell the student what to study today.

---

```text
┌─────────────────────────────────────────────┐
│ Good Evening, Manish 👋                     │
│ Class 10 • CBSE                            │
│                                             │
│ Ready to continue learning today?           │
└─────────────────────────────────────────────┘


┌─────────────────────────────────────────────┐
│ 📘 TODAY'S LESSON                           │
│                                             │
│ Mathematics                                 │
│ Arithmetic Progressions                     │
│                                             │
│ Topic                                       │
│ nth Term of an AP                           │
│                                             │
│ Lesson Plan                                 │
│ • Understand the concept                    │
│ • Practice questions                        │
│ • Quick test                                │
│                                             │
│ ⏱ 20 minutes                                │
│                                             │
│ [ Start Lesson ]                            │
│ [ Skip for Today ]                          │
└─────────────────────────────────────────────┘


┌─────────────────────────────┐ ┌─────────────────────────────┐
│ ▶ Resume Lesson              │ │ 🔥 Study Streak             │
│ Topic: Linear Equations      │ │ 3 Days                      │
│ Phase: Practice              │ │ Keep learning daily!        │
│                              │ │                             │
│ [ Continue ]                 │ │                             │
└─────────────────────────────┘ └─────────────────────────────┘


┌─────────────────────────────────────────────┐
│ 📊 WEEKLY PROGRESS                          │
│                                             │
│ Weekly Goal: 30 minutes                     │
│ ██████████░░░░░░░░                          │
│                                             │
│ Topics Learned: 2                           │
│ Sessions Completed: 3                       │
│ Accuracy: 75%                               │
└─────────────────────────────────────────────┘


┌─────────────────────────────────────────────┐
│ ⚠ WEAK TOPICS                               │
│                                             │
│ Linear Equations                            │
│ Polynomials                                 │
│                                             │
│ [ Practice Weak Topics ]                    │
└─────────────────────────────────────────────┘


┌─────────────────────────────────────────────┐
│ 📝 ASSIGNMENTS                              │
│                                             │
│ Arithmetic Progressions Homework            │
│ Due Tomorrow                                │
│                                             │
│ [ Start Homework ]                          │
└─────────────────────────────────────────────┘


Bottom Navigation
------------------------------------------------
Home | Notes | Practice | Doubts | Profile
```

---

## Why This Dashboard Works

Within **3 seconds**, the student knows:

- 1. What to study
- 2. Their progress
- 3. Their weaknesses
- 4. Their homework

That is exactly how **a tutor guides a student**.

---

## 2. Spinzy Session Page — Wireframe

**Route:** `/session/[sessionId]`

**Purpose:** Run the entire learning session.

---

### Session Layout

```text
┌─────────────────────────────────────────────┐
│ Mathematics                                 │
│ Arithmetic Progressions                     │
│ Topic: nth Term of an AP                    │
└─────────────────────────────────────────────┘


┌─────────────────────────────────────────────┐
│ Lesson Progress                             │
│                                             │
│ Overview → Explanation → Practice → Test → Homework │
│    ●          ○            ○        ○         ○       │
└─────────────────────────────────────────────┘
```

---

### Phase 1 — Lesson Overview

```text
┌─────────────────────────────────────────────┐
│ WHAT YOU WILL LEARN                         │
│                                             │
│ • What an Arithmetic Progression is         │
│ • How to calculate the nth term             │
│ • How to solve exam questions               │
│                                             │
│ LESSON STEPS                                │
│                                             │
│ 1. Concept explanation                      │
│ 2. Practice questions                       │
│ 3. Quick test                               │
│                                             │
│ ⏱ Estimated Time: 20 minutes                │
│                                             │
│ [ Begin Lesson ]                            │
└─────────────────────────────────────────────┘
```

---

### Phase 2 — Concept Explanation

```text
┌─────────────────────────────────────────────┐
│ CONCEPT                                     │
│                                             │
│ An Arithmetic Progression (AP) is a         │
│ sequence where the difference between       │
│ consecutive numbers is constant.            │
│                                             │
│ Example                                     │
│                                             │
│ 2, 5, 8, 11                                 │
│                                             │
│ Common Difference = 3                       │
│                                             │
│ Example Problem                             │
│                                             │
│ Find the 6th term of the AP:                │
│ 2, 5, 8, ...                                │
│                                             │
│ [ Continue to Practice ]                    │
└─────────────────────────────────────────────┘
```

---

### Phase 3 — Guided Practice

```text
┌─────────────────────────────────────────────┐
│ PRACTICE QUESTION 1 / 3                     │
│                                             │
│ Find the 5th term of the AP:                │
│ 2, 5, 8, ...                                │
│                                             │
│ ○ 11                                        │
│ ○ 14                                        │
│ ○ 17                                        │
│ ○ 20                                        │
│                                             │
│ [ Submit Answer ]                           │
└─────────────────────────────────────────────┘
```

**Feedback:**

```text
Correct! 🎉
The correct answer is 14.
```

---

### Phase 4 — Quick Test

```text
┌─────────────────────────────────────────────┐
│ QUICK TEST                                  │
│                                             │
│ 3 questions                                 │
│ ⏱ 3 minutes                                 │
│                                             │
│ [ Start Test ]                              │
└─────────────────────────────────────────────┘
```

**Result:**

```text
Score
2 / 3 correct

Mastery Updated
```

---

### Phase 5 — Homework

```text
┌─────────────────────────────────────────────┐
│ HOMEWORK ASSIGNED                           │
│                                             │
│ Arithmetic Progressions                     │
│                                             │
│ 5 questions                                 │
│ Due tomorrow                                │
│                                             │
│ [ Start Homework ]                          │
│ [ Do Later ]                                │
└─────────────────────────────────────────────┘
```

---

### Phase 6 — Completion Screen

```text
┌─────────────────────────────────────────────┐
│ TOPIC COMPLETED 🎉                          │
│                                             │
│ Arithmetic Progressions                     │
│                                             │
│ Mastery                                     │
│ 65%                                         │
│                                             │
│ 🔥 Study Streak                             │
│ 3 days                                      │
│                                             │
│ Weekly Progress                             │
│ Topics Learned: 2                           │
│                                             │
│ [ Continue Learning ]                       │
└─────────────────────────────────────────────┘
```

---

## 3. Why This UX Is Strong for Spinzy

This design achieves:

- Clear learning flow
- Low cognitive load
- Tutor-like guidance
- Visible progress
- Habit formation

Students **never feel lost**.

---

## 4. What You Should Freeze

Lock these **for MVP**:

- Dashboard structure
- Session flow
- Navigation
- Lesson phases

No more UI redesign until **student testing**.

---

## 5. What Happens Next

Once this UX is implemented, the next product step is **very powerful**:

**Adaptive AI Tutor Loop** — which will make Spinzy **feel intelligent**.

It improves:

- Topic recommendations
- Difficulty adaptation
- Revision scheduling

And it integrates perfectly with your:

- TopicRanker
- Session Engine
- StudentTopicProgress

---

## Admin
Manish, this is a **very important question** because the **Admin side determines how scalable Spinzy becomes**.

Students see a **tutor-like interface**, but admins (you + internal operators) must see a **control center**.

Think of it like this:

- **Student App** → Learning Experience
- **Admin App** → Learning Control System

If the admin system is weak, the platform becomes **hard to manage as content and users grow**.

So the admin pages should be designed around **5 core responsibilities**.

---

### Spinzy Admin System — Core Responsibilities

1. Curriculum Management
2. Content Generation
3. Student Learning Analytics
4. Learning Engine Control
5. Operations & Monitoring

Each responsibility maps to **specific admin pages**.

---

### 1. Admin Dashboard (System Overview)

**Purpose:** See the health of the platform instantly.

**Wireframe:**

```text
┌────────────────────────────────────┐
│ Spinzy Admin Dashboard             │
└────────────────────────────────────┘

Students
--------------------------------
Total Students: 2,350
Active Today: 312

Learning Activity
--------------------------------
Sessions Today: 640
Topics Completed: 180

Content Status
--------------------------------
Subjects: 5
Chapters: 80
Topics: 720
Notes Generated: 720
Questions Generated: 8,400

Homework
--------------------------------
Assignments Issued: 420
Completed: 312

System Health
--------------------------------
Worker Status: Healthy
Queue Jobs Pending: 18
```

This page helps answer: **Is the system running well today?**

---

### 2. Curriculum Management

**Purpose:** Control subjects, chapters, topics.

**Page:** `/admin/curriculum`

**Wireframe:**

```text
Subjects
--------------------------------
Mathematics
Science
Physics
Chemistry

Click Subject
↓
Chapters
--------------------------------
Arithmetic Progressions
Quadratic Equations
Trigonometry

Click Chapter
↓
Topics
--------------------------------
nth Term of AP
Sum of AP
Applications of AP
```

**Actions:** Add topic, Edit topic, Disable topic, Reorder curriculum

---

### 3. Content Generation Control

**Purpose:** Control the AI content generation pipeline.

**Page:** `/admin/content-generation`

**Wireframe:**

```text
Content Generation Jobs
--------------------------------
Topic: Arithmetic Progressions
Status: Completed
Notes: ✓
Questions: ✓
Tests: ✓

Topic: Trigonometry
Status: Running
Progress: 60%

Topic: Quadratic Equations
Status: Failed
Retry Button
```

**Actions:** Generate content, Retry generation, Inspect generated content

This interacts with your: HydrateAll job, BullMQ worker, LLM generator

---

### 4. Content Viewer (Quality Control)

**Purpose:** Check AI-generated notes and questions.

**Page:** `/admin/content-viewer`

**Wireframe:**

```text
Subject: Mathematics
Chapter: Arithmetic Progressions
Topic: nth Term of AP

--------------------------------
Notes
--------------------------------
Full explanation text

--------------------------------
Questions
--------------------------------
Question 1
Question 2
Question 3
```

**Actions:** Edit content, Regenerate, Disable question

This ensures **quality control**.

---

### 5. Student Analytics

**Purpose:** Understand how students are learning.

**Page:** `/admin/students`

**Wireframe:**

```text
Student List
--------------------------------
Name
Grade
Sessions
Topics Completed
Accuracy

Manish Kumar
Class 10
Sessions: 12
Topics: 5
Accuracy: 72%
```

**Click student:** Student Profile — Topics Studied, Weak Topics, Homework Completion, Study Streak, Session History

This helps detect: learning problems, engagement drop, weak subjects

---

### 6. Topic Performance Analytics

**Purpose:** Find difficult topics across students.

**Page:** `/admin/topic-performance`

**Wireframe:**

```text
Topic Difficulty
--------------------------------
Topic
Avg Score
Attempts

Quadratic Equations
Score: 52%

Trigonometry
Score: 61%

Arithmetic Progressions
Score: 78%
```

This helps you: Improve explanations, Add better questions, Adjust difficulty

---

### 7. Recommendation Engine Debug

**Purpose:** Debug the AI tutor decisions.

**Page:** `/admin/recommendations`

**Wireframe:**

```text
Student: Manish Kumar

Recommendation Trace
--------------------------------
Topic: Linear Equations
Reason: WeakTopicBoost

Score
--------------------------------
WeakTopicBoost: +0.4
RecencyPenalty: -0.1
FinalScore: 0.72
```

This connects with your: **RecommendationTrace** table

---

### 8. Session Monitoring

**Purpose:** Monitor active learning sessions.

**Page:** `/admin/sessions`

**Wireframe:**

```text
Active Sessions
--------------------------------
Student
Topic
Phase

Manish
Linear Equations
Practice

Rahul
AP
Explanation
```

Useful for debugging.

---

### 9. Homework Monitoring

**Purpose:** Track homework completion.

**Page:** `/admin/homework`

**Wireframe:**

```text
Assignments
--------------------------------
Topic
Assigned
Completed

Arithmetic Progressions
120
82
```

---

### 10. System Monitoring

**Purpose:** Monitor workers and queues.

**Page:** `/admin/system`

**Wireframe:**

```text
Queue Status
--------------------------------
hydrateAll
pending: 5

generateQuestions
pending: 2

Workers
--------------------------------
worker-1: running
worker-2: running
```

---

### Final Admin Page Structure

Your admin app should look like:

- **Admin Dashboard**
- Curriculum, Content Generation, Content Viewer
- Students, Topic Performance, Sessions, Homework
- Recommendation Debug, System Monitoring

---

### Important Design Principle

- **Student app** must feel: simple, guided, calm
- **Admin app** must feel: powerful, data-driven, transparent

They serve **different audiences**.

---

### What I Recommend You Implement First

For MVP admin system, only build:

- Admin Dashboard
- Curriculum Manager
- Content Viewer
- Student Analytics
- Recommendation Debug

You can add the rest later.

## Prompts

Manish, this is the **right architectural checkpoint** before you start generating large volumes of content.
Changing the **UX and learning flow** without adjusting the **content generation prompts** can lead to misaligned content.

I'll answer your two key questions clearly:

1. **Do we already have backend infrastructure for the new UX?**
2. **How should the content generation prompts change to support the new structure?**

---

### 1. Do You Already Have Backend Infrastructure for the New Structure?

**Short answer:** Yes — about 85–90% of the backend already supports it. Only **small adjustments** are needed.

Your current backend architecture already contains:

- Curriculum Engine
- TopicRanker
- StudentTopicProgress
- StructuredSession
- PhaseContentResolver
- HomeworkAssignment
- RecommendationTrace

These are exactly what the **7-screen tutor journey needs**.

Let's map it.

---

## Mapping Backend to the New UX

#### Screen 1 — Dashboard

**Needs:** NextTopicRecommendation, StudentTopicProgress, StudentStreak, HomeworkAssignment

**You already have:** TopicRanker, StudentTopicProgress, HomeworkAssignment, StudentStreak

So **no backend change needed**.

---

#### Screen 2 — Lesson Overview

**Needs:** topic title, learning objectives, lesson steps, estimated time

**Backend currently stores:** Topic, TopicNote

You may need **one small addition:** TopicLearningObjective (or store objectives in TopicNote metadata).

---

#### Screen 3 — Explanation

**Needs:** TopicNote, examples, visual explanation

**You already generate:** TopicNote — no major change needed.

---

#### Screen 4 — Guided Practice

**Needs:** practice questions, difficulty mix, instant feedback

**You already have:** Question table. You only need **better tagging** (e.g. `questionType = practice | test | homework`, `difficulty = easy | medium | hard`).

---

#### Screen 5 — Quick Test

**Needs:** 3–5 test questions. **You already have:** GeneratedTest, or can reuse Question with `questionType = test`.

---

#### Screen 6 — Homework

**Needs:** HomeworkAssignment — already implemented.

---

#### Screen 7 — Progress Summary

**Needs:** StudentTopicProgress, Session history, Study streak — already implemented.

---

### Conclusion

Your backend **already supports the new UX**. Only **minor schema improvements** may be needed: `questionType`, `difficulty`, `learningObjectives`, `estimatedMinutes`. These are small.

---

### 2. How the Content Generation Prompts Should Change

This is the **most important part**.

Previously the content pipeline likely generated: Topic → Notes, Topic → Questions, Topic → Tests.

But the new UX requires **structured lesson content**. The prompt must now generate content aligned to **session phases**.

---

### New Content Structure

Instead of generating random notes/questions, generate:

- **LessonContent**
  - Explanation
  - PracticeQuestions
  - QuickTestQuestions
  - HomeworkQuestions

Each topic should produce a **complete learning unit**.

---

### Updated Content Generation Prompt

Below is the **improved prompt template**.

This will dramatically improve **learning quality**.

---

#### Prompt for Topic Lesson Content

```text
You are an expert mathematics teacher for Indian CBSE students.

Create a structured lesson for the topic:

{topicTitle}

Grade: {grade}
Subject: {subject}

The lesson must follow this structure.

------------------------------------------------

1. Learning Objectives

List 3–4 things the student will learn.

------------------------------------------------

2. Concept Explanation

Explain the concept in simple language suitable for a Grade {grade} student.

Include:

• step-by-step explanation
• real-world analogy
• one worked example

Avoid unnecessary complexity.

------------------------------------------------

3. Guided Practice Questions

Generate 3 practice questions.

Requirements:

• increasing difficulty
• multiple choice
• include correct answer
• include short explanation

------------------------------------------------

4. Quick Test

Generate 3 test questions.

These should check conceptual understanding.

Return:

question
options
correct answer

------------------------------------------------

5. Homework Questions

Generate 5 homework questions.

Mix:

• conceptual
• numerical
• application

------------------------------------------------

Return response in JSON format.
```

---

### Example Output Structure

The generator should return:

```json
{
  "learningObjectives": [
    "Understand arithmetic progression",
    "Identify common difference",
    "Find nth term"
  ],
  "explanation": "...",
  "practiceQuestions": [],
  "quickTest": [],
  "homework": []
}
```

This maps perfectly to your **session phases**.

---

### Backend Change Needed in Generator

Your generator pipeline should change from `generateNotes()`, `generateQuestions()`, `generateTests()` to something like `generateLessonContent()` which returns **LessonContent**, then store parts separately: TopicNote, Question (practice), Question (test), Question (homework).

---

### Recommended Content Tags

Update Question schema with `questionType`: `practice` | `test` | `homework`. Example: `questionType = practice`. This helps the session engine pick the right questions.

---

### Phase Content Resolver

Your `getPhaseContent()` should then behave like:

- `phase = explanation` → return TopicNote
- `phase = practice` → return practiceQuestions
- `phase = test` → return quickTestQuestions
- `phase = homework` → return homeworkQuestions

Which perfectly matches the UX.

---

### Important Content Quality Rules

Add these instructions to every prompt:

- Explain concepts clearly.
- Avoid unnecessary jargon.
- Use simple language for Indian school students.
- Provide step-by-step reasoning.
- Include real-world examples where possible.

This dramatically improves quality.

---

### Final Architecture After Upgrade

Your system will look like:

- Curriculum Graph → TopicRanker → StructuredSession → LessonContent → PhaseContentResolver → Student UI

This is a **true AI tutor architecture**.

---

### One More Critical Suggestion

Before generating **thousands of topics**, generate **only 5–10 topics first** and test: lesson flow, practice difficulty, test quality, homework quality. Otherwise you'll generate **large amounts of mediocre content**.

---

## Complete Spinzy System Architecture Diagram (Student App + Admin App + Workers + AI pipeline + Prompts + Analytics)
Manish, I’ll give you a **clear, end-to-end architecture blueprint for Spinzy** so the whole system becomes easy to reason about and scale.
I’ll break it into:

1. **Complete System Architecture Diagram**
2. **How Data Flows Through the System**
3. **AI Content Pipeline + Prompt Layer**
4. **Student Learning Runtime**
5. **Admin Control System**
6. **Analytics + Intelligence Layer**
7. **High-Level Changes Needed to Implement the New UX System**
8. **What Should NOT Change (to keep stability)**

The goal is to make Spinzy a **scalable AI tutor platform**, not just a content website.

---

### 1. Complete Spinzy System Architecture

Below is the **full platform architecture**.

```text
                   ┌─────────────────────────────┐
                   │        STUDENT APP          │
                   │     (Next.js Frontend)      │
                   │                             │
                   │  Dashboard                  │
                   │  Session Page               │
                   │  Notes                      │
                   │  Practice                   │
                   │  Doubts                     │
                   │  Profile                    │
                   └──────────────┬──────────────┘
                                  │
                                  │ API
                                  ▼
                   ┌─────────────────────────────┐
                   │        API LAYER            │
                   │       (Next.js APIs)        │
                   │                             │
                   │ /student/next-topic         │
                   │ /session/start              │
                   │ /session/next               │
                   │ /student/progress           │
                   │ /student/weak-topics        │
                   │ /student/homework           │
                   │ /student/streak             │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │   LEARNING ORCHESTRATION    │
                   │                             │
                   │ TopicRanker                 │
                   │ SessionEngine               │
                   │ PhaseContentResolver        │
                   │ HomeworkGenerator           │
                   │ TopicProgressUpdater        │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │        DATABASE             │
                   │        (PostgreSQL)         │
                   │                             │
                   │ Subjects                    │
                   │ Chapters                    │
                   │ Topics                      │
                   │ TopicNotes                  │
                   │ Questions                   │
                   │ GeneratedTests              │
                   │ HomeworkAssignments         │
                   │ StudentTopicProgress        │
                   │ StudentLearningPlan         │
                   │ StructuredSession           │
                   │ RecommendationTrace         │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │          REDIS              │
                   │         (Queues)            │
                   │                             │
                   │ hydrateAllQueue             │
                   │ generateLessonQueue         │
                   │ generateQuestionsQueue      │
                   │ analyticsQueue              │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │        WORKER LAYER         │
                   │        (BullMQ)             │
                   │                             │
                   │ Curriculum Generator        │
                   │ Lesson Content Generator    │
                   │ Question Generator          │
                   │ Homework Generator          │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │           AI LAYER          │
                   │                             │
                   │ Prompt Templates            │
                   │ LLM API                     │
                   │ Content Validation          │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │         ADMIN APP           │
                   │                             │
                   │ Curriculum Manager          │
                   │ Content Viewer              │
                   │ Student Analytics           │
                   │ Topic Performance           │
                   │ Recommendation Debug        │
                   │ Worker Monitoring           │
                   └─────────────────────────────┘
```

---

### 2. Learning Runtime (Student Journey)

This is the **core runtime loop** when a student studies.

```text
Student opens dashboard
        ↓
API /student/next-topic
        ↓
TopicRanker
        ↓
Recommended Topic
        ↓
Student clicks Start Lesson
        ↓
POST /session/start
        ↓
StructuredSession created
        ↓
Session page loads
        ↓
PhaseContentResolver
        ↓
Explanation → Practice → Test → Homework
        ↓
StudentTopicProgress updated
        ↓
TopicRanker recalculates
```

This loop is what makes Spinzy feel like a **tutor**.

---

### 3. AI Content Generation Pipeline

The **AI system runs separately from student sessions**. This is important for **scalability and cost control**.

```text
Admin triggers curriculum generation
        ↓
HydrateAll Job
        ↓
Create Subjects
        ↓
Create Chapters
        ↓
Create Topics
        ↓
Generate Lesson Content
        ↓
Generate Questions
        ↓
Generate Tests
        ↓
Store in Database
```

---

### 4. Prompt Layer (AI Intelligence)

Instead of random content prompts, the system now generates **structured lesson content**.

```text
Prompt Template
       ↓
Topic: Arithmetic Progressions
Grade: 10
Board: CBSE
       ↓
LLM Response
       ↓
LessonContent JSON
```

**Structure returned:** learningObjectives, explanation, practiceQuestions, quickTestQuestions, homeworkQuestions

The worker pipeline then stores them as: TopicNote, Question (practice), Question (test), Question (homework)

---

### 5. Admin System Architecture

Admin is not just a dashboard. It is the **control system of the AI tutor**.

**Admin modules:** Admin Dashboard, Curriculum Manager, Content Viewer, Content Generation, Student Analytics, Topic Performance, Recommendation Debug, System Monitoring

**Example flow:**

```text
Admin creates curriculum
        ↓
Workers generate lesson content
        ↓
Admin reviews content
        ↓
Students consume content
        ↓
Analytics reveal weak topics
        ↓
Admin improves content
```

---

### 6. Analytics + Intelligence Layer

Analytics should power **future AI improvements**.

**Events collected:** SESSION_STARTED, PHASE_COMPLETED, QUESTION_ANSWERED, TEST_COMPLETED, HOMEWORK_SUBMITTED, TOPIC_COMPLETED

**From these events we compute:** Topic difficulty, Student mastery, Weak topic clusters, Drop-off points, Engagement metrics

**This feeds back into:** TopicRanker, Content improvements, Difficulty tuning

---

### 7. High-Level Changes Needed for the New UX System

Your backend already supports most of this, but a few **structural improvements** are needed.

---

#### Change 1 — Lesson Content Generation

- **Old system:** notes, questions, tests
- **New system:** LessonContent (Explanation, PracticeQuestions, QuickTestQuestions, HomeworkQuestions)
- **Worker change:** `generateLessonContent()`

---

#### Change 2 — Question Tagging

Add fields: `questionType`, `difficulty`, `topicId`. Example values: practice, test, homework.

---

#### Change 3 — Session Phase Resolver

Update `getPhaseContent()`: phase=explanation → TopicNote; phase=practice → practiceQuestions; phase=test → testQuestions; phase=homework → homeworkQuestions.

---

#### Change 4 — TopicRanker Guardrails

Ensure TopicRanker never returns empty. Fallback: next topic in curriculum.

---

#### Change 5 — Lesson Metadata

Add fields to Topic: learningObjectives, estimatedMinutes, difficulty. This powers the **lesson overview screen**.

---

#### Change 6 — Analytics Event Logging

Add table **LearningEvent** with fields: studentId, sessionId, eventType, metadata, timestamp.

---

### 8. What Should NOT Change

Important to maintain stability. Do NOT change: Prisma schema core structure, TopicRanker architecture, SessionEngine structure, BullMQ worker system, Next.js routing. Only extend them.

---

### Final Architecture Maturity

Your system is now roughly: Content engine 9/10, Learning engine 8/10, AI architecture 8/10, UX alignment 6/10.

Once the **session UX is implemented**, Spinzy becomes a **true AI tutor platform**.

---

### One More Strategic Insight

Most edtech platforms fail because they build a **Content library**. Spinzy is correctly moving toward: **Decision engine** → **Session engine** → **Learning experience**. That is the architecture used by **the best adaptive learning systems**.

---

## Deployment using Almalinux
Yes, Manish — **you absolutely can deploy Spinzy on AlmaLinux using PM2**, and for an MVP or early-stage platform this is actually a **very practical and controllable setup**. Many production Node.js systems run this way.

However, the **key is structuring the server correctly** so that:

* the **Next.js app**
* the **BullMQ workers**
* the **Redis connection**
* the **database**
* and the **AI generation jobs**

all run reliably without interfering with each other.

I’ll explain:

1. **Whether AlmaLinux + PM2 is a good idea**
2. **Recommended server architecture**
3. **Process layout with PM2**
4. **Deployment structure**
5. **Scaling strategy later**
6. **Example PM2 config**

---

### 1. Is AlmaLinux + PM2 a Good Choice?

For Spinzy’s current stage:

**Yes.**

**Advantages:** Full control, Low cost, Persistent workers supported, No serverless limitations, Good for BullMQ, Simple debugging

This avoids problems like: Vercel blocking workers, Serverless timeouts, Cold starts, Queue issues

A single AlmaLinux server can run: Next.js app, Workers, Redis, PM2 process manager

---

### 2. Recommended AlmaLinux Architecture

Your server should look like this:

```text
Internet
   │
   ▼
Nginx
   │
   ▼
Next.js (PM2)
   │
   ├── Student App
   ├── Admin App
   └── API routes

Redis
   │
   ▼
BullMQ Queues
   │
   ▼
Worker Processes (PM2)

Postgres (external)
```

So your system becomes:

```text
Users
  ↓
Nginx
  ↓
Next.js App
  ↓
API layer
  ↓
Postgres + Redis
  ↓
Workers
  ↓
AI generation
```

---

### 3. Server Components

Your AlmaLinux server should run:

- **Reverse Proxy — Nginx:** HTTPS, Load balancing, Static assets
- **Process Manager — PM2:** Run Next.js, Run workers, Restart crashed processes, Monitor logs
- **Redis:** BullMQ queues, Caching, Session jobs. Install locally or use managed Redis.
- **Database:** Recommended Neon, Supabase, AWS RDS. Keep DB external for safety.

---

### 4. Spinzy Process Layout

PM2 should run **multiple processes**.

**Example:** `pm2 list` → spinzy-web, spinzy-worker-content, spinzy-worker-questions, spinzy-worker-analytics

- **Web Server:** Runs Next.js app — Command: `npm run start`
- **Worker 1 — Content Generation:** Handles generateLessonQueue
- **Worker 2 — Question Generation:** Handles generateQuestionsQueue
- **Worker 3 — Analytics:** Handles analyticsQueue

---

### 5. Directory Layout

On the server:

```text
/opt/spinzy
   ├── app
   │    ├── .next
   │    ├── package.json
   │    └── src
   │
   ├── workers
   │    ├── contentWorker.ts
   │    ├── questionWorker.ts
   │    └── analyticsWorker.ts
   │
   ├── ecosystem.config.js
   └── logs
```

---

### 6. PM2 Ecosystem Config

Example:

```javascript
module.exports = {
  apps: [

    {
      name: "spinzy-web",
      script: "npm",
      args: "start",
      cwd: "/opt/spinzy/app",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    },

    {
      name: "spinzy-worker-content",
      script: "dist/workers/contentWorker.js",
      cwd: "/opt/spinzy/app",
      instances: 1
    },

    {
      name: "spinzy-worker-questions",
      script: "dist/workers/questionWorker.js",
      cwd: "/opt/spinzy/app",
      instances: 1
    },

    {
      name: "spinzy-worker-analytics",
      script: "dist/workers/analyticsWorker.js",
      cwd: "/opt/spinzy/app",
      instances: 1
    }

  ]
};
```

Start everything: `pm2 start ecosystem.config.js`

Save config: `pm2 save`, `pm2 startup`

---

### 7. Nginx Configuration

Example:

```nginx
server {
  listen 80;
  server_name spinzyacademy.com;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
  }
}
```

---

### 8. Scaling Strategy Later

Your architecture should evolve like this:

- **Stage 1 (Now):** 1 server, PM2, Redis, Workers — Handles 5k–10k students
- **Stage 2:** Split workers — Server 1 → Next.js, Server 2 → Workers, Server 3 → Redis — Handles 50k students
- **Stage 3:** Container orchestration (Kubernetes) — Handles 500k+ students

---

### 9. Monitoring Tools

Add: PM2 dashboard, pm2 logs, Sentry, UptimeRobot. Monitor: worker crashes, queue backlog, AI errors, API latency.

---

### 10. Cost Advantage

AlmaLinux server example: 4 vCPU, 8GB RAM, $25–40/month. This can easily handle 10k active students.

---

### Final Recommendation

For Spinzy today: AlmaLinux VPS, PM2, Nginx, Redis, External Postgres — is a **very solid architecture**.

You can migrate to distributed infrastructure later without rewriting the app.

---

## Arch Doc

### Spinzy Academy – Complete System Architecture, UX Blueprint, Content Pipeline, and Deployment Document

This document consolidates the full architecture, UX philosophy, learning flow, AI content generation pipeline, admin system, and deployment architecture for **SpinzyAcademy**, an AI-powered tutoring platform designed to replace low-cost home tuition for Indian students (Grades 6–12).

The goal of this document is to provide a **single clear blueprint** so development, product design, and infrastructure decisions remain aligned while scaling the platform.

---

### 1. Product Philosophy

Spinzy must behave like a **personal tutor**, not a content library.

The student should always know:

1. What should I study now?
2. Am I understanding this?
3. Am I improving?

Most edtech platforms fail because they present: Notes, Practice, Tests, Videos — which creates: Information overload, No guidance, Low engagement.

Spinzy instead follows:

```text
Decision Engine
       ↓
Structured Learning Session
       ↓
Guided Learning Experience
```

---

### 2. Product Architecture (Three-Layer Model)

The system is designed using a three-layer architecture used by leading learning platforms.

```text
Layer 1 — Learning Intelligence
Layer 2 — Learning Orchestration
Layer 3 — Learning Experience
```

---

#### Layer 1 — Learning Intelligence

This layer decides: **What should the student learn next?**

**Core components:** TopicRanker, StudentTopicProgress, WeakTopicDetection, LearningMomentum, StudentLearningPlan, CurriculumGraph

**Example decision:**

```text
Student weak in Algebra
↓
Recommend Linear Equations
```

**Output:** NextTopicRecommendation

---

#### Layer 2 — Learning Orchestration

This layer decides: **How should the lesson happen?**

**Components:** SessionEngine, StructuredSession, SessionPhase, PhaseContentResolver, HomeworkGenerator, TopicCompletion

**Example:**

```text
Topic: Linear Equations

Phase 1 — Explanation
Phase 2 — Practice
Phase 3 — Quick Test
Phase 4 — Homework
```

---

#### Layer 3 — Learning Experience

This layer shows the student interface. **Components:** Dashboard, Session UI, Notes, Practice, Progress

---

### 3. Core Learning Loop

The fundamental learning loop is:

```text
Student opens app
        ↓
Tutor recommends topic
        ↓
Student starts lesson
        ↓
Concept explanation
        ↓
Guided practice
        ↓
Quick test
        ↓
Homework assigned
        ↓
Progress updated
        ↓
Next topic recommended
```

If this loop works smoothly, Spinzy becomes a **home tutor replacement**.

---

### 4. The 7-Screen Learning Journey

These represent the learning flow (not necessarily separate pages): 1. Welcome Dashboard, 2. Lesson Overview, 3. Concept Explanation, 4. Guided Practice, 5. Quick Test, 6. Homework, 7. Progress Summary

---

#### Screen 1 — Welcome Dashboard

**Purpose:** Tell the student what to study today.

**Example UI:**

```text
Good Evening, Manish 👋
Class 10 • CBSE

Today's Lesson
Mathematics
Arithmetic Progressions

Topic
nth Term of an AP

Lesson Plan
• Understand the concept
• Practice questions
• Quick test

⏱ 20 minutes

[ Start Lesson ]
```

**Secondary sections:** Resume Lesson, Weekly Progress, Weak Topics, Homework, Study Streak

---

#### Screen 2 — Lesson Overview

**Purpose:** Reduce learning anxiety before the lesson begins.

**Example:**

```text
Topic
Arithmetic Progressions

What you'll learn
• What an AP is
• How to find nth term
• Solve exam questions

Lesson Plan
1. Concept explanation
2. Practice questions
3. Quick test

Estimated Time: 20 minutes
```

---

#### Screen 3 — Concept Explanation

**Purpose:** Teach the concept clearly. **Content source:** TopicNote

**Example:**

```text
An Arithmetic Progression is a sequence where the difference
between consecutive numbers is constant.

Example:
2, 5, 8, 11

Common Difference = 3
```

---

#### Screen 4 — Guided Practice

**Purpose:** Apply the concept.

**Example:**

```text
Practice Question

Find the 5th term of AP:
2, 5, 8, ...

Options
11
14
17
20
```

**Feedback:** Correct! 🎉

---

#### Screen 5 — Quick Test

**Purpose:** Check understanding quickly.

**Example:** Quick Test — 3 questions, 3 minutes

**Result:** Score: 2 / 3, Mastery Updated

---

#### Screen 6 — Homework

**Purpose:** Reinforce learning later.

**Example:**

```text
Homework Assigned

Arithmetic Progressions
5 questions
Due Tomorrow
```

---

#### Screen 7 — Progress Summary

**Purpose:** Motivate the student.

**Example:**

```text
Topic Completed 🎉

Mastery: 65%
Study Streak: 3 days

Weekly Progress
Topics Learned: 2
```

---

### 5. UI Page Structure

Instead of seven separate pages, Spinzy should have **four primary pages**: `/dashboard`, `/session/[sessionId]`, `/notes`, `/practice`

**Navigation:** Home | Notes | Practice | Doubts | Profile

Most usage should occur within `/session/[sessionId]`.

---

### 6. Full Spinzy System Architecture

```text
                   ┌─────────────────────────────┐
                   │        STUDENT APP          │
                   │     (Next.js Frontend)      │
                   │                             │
                   │  Dashboard                  │
                   │  Session Page               │
                   │  Notes                      │
                   │  Practice                   │
                   │  Doubts                     │
                   │  Profile                    │
                   └──────────────┬──────────────┘
                                  │
                                  │ API
                                  ▼
                   ┌─────────────────────────────┐
                   │        API LAYER            │
                   │       (Next.js APIs)        │
                   │                             │
                   │ /student/next-topic         │
                   │ /session/start              │
                   │ /session/next               │
                   │ /student/progress           │
                   │ /student/weak-topics        │
                   │ /student/homework           │
                   │ /student/streak             │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │   LEARNING ORCHESTRATION    │
                   │                             │
                   │ TopicRanker                 │
                   │ SessionEngine               │
                   │ PhaseContentResolver        │
                   │ HomeworkGenerator           │
                   │ TopicProgressUpdater        │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │        DATABASE             │
                   │        (PostgreSQL)         │
                   │                             │
                   │ Subjects                    │
                   │ Chapters                    │
                   │ Topics                      │
                   │ TopicNotes                  │
                   │ Questions                   │
                   │ GeneratedTests              │
                   │ HomeworkAssignments         │
                   │ StudentTopicProgress        │
                   │ StudentLearningPlan         │
                   │ StructuredSession           │
                   │ RecommendationTrace         │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │          REDIS              │
                   │         (Queues)            │
                   │                             │
                   │ hydrateAllQueue             │
                   │ generateLessonQueue         │
                   │ generateQuestionsQueue      │
                   │ analyticsQueue              │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │        WORKER LAYER         │
                   │        (BullMQ)             │
                   │                             │
                   │ Curriculum Generator        │
                   │ Lesson Content Generator    │
                   │ Question Generator          │
                   │ Homework Generator          │
                   │ Analytics Processor         │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │           AI LAYER          │
                   │                             │
                   │ Prompt Templates            │
                   │ LLM API                     │
                   │ Content Validation          │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │         ADMIN APP           │
                   │                             │
                   │ Curriculum Manager          │
                   │ Content Viewer              │
                   │ Student Analytics           │
                   │ Topic Performance           │
                   │ Recommendation Debug        │
                   │ Worker Monitoring           │
                   └─────────────────────────────┘
```

---

### 7. AI Content Generation Pipeline

Content generation runs asynchronously.

```text
Admin triggers generation
        ↓
HydrateAll Job
        ↓
Create Subjects
        ↓
Create Chapters
        ↓
Create Topics
        ↓
Generate Lesson Content
        ↓
Generate Questions
        ↓
Generate Tests
        ↓
Store in Database
```

---

### 8. Prompt Structure for Lesson Generation

**Prompt template:**

```text
You are an expert mathematics teacher for CBSE students.

Topic: {topicTitle}
Grade: {grade}

Generate structured lesson content.

1. Learning Objectives
2. Concept Explanation
3. Guided Practice Questions
4. Quick Test Questions
5. Homework Questions

Return JSON.
```

**Expected output:** learningObjectives, explanation, practiceQuestions, quickTestQuestions, homeworkQuestions

---

### 9. Admin System

**Admin responsibilities:** Curriculum Management, Content Generation, Content Quality Review, Student Analytics, Recommendation Debug, System Monitoring

**Admin pages:** `/admin/dashboard`, `/admin/curriculum`, `/admin/content-viewer`, `/admin/students`, `/admin/topic-performance`, `/admin/recommendations`, `/admin/system`

---

### 10. Optimal Deployment Architecture

For scalability and reliability.

```text
Users
  ↓
Vercel (Next.js frontend + APIs)
  ↓
Application Layer
  ↓
Postgres Database
  ↓
Redis Queue
  ↓
Worker Servers
  ↓
AI Generation
```

**Diagram:**

```text
Users
   ↓
Vercel
   ├ Student App
   ├ Admin App
   └ API Routes

Postgres (Neon / Supabase)

Redis (Upstash)

Workers (Railway / Fly.io)

AI Services (OpenAI / Claude)
```

---

### 11. AlmaLinux + PM2 Deployment Option

Alternative deployment using a VPS.

**Architecture:**

```text
Internet
   ↓
Nginx
   ↓
Next.js (PM2)
   ↓
API Layer
   ↓
Postgres
   ↓
Redis
   ↓
Workers
   ↓
AI Services
```

**PM2 processes:** spinzy-web, spinzy-worker-content, spinzy-worker-questions, spinzy-worker-analytics

**Example PM2 ecosystem file:** apps: spinzy-web, spinzy-worker-content, spinzy-worker-questions, spinzy-worker-analytics

---

### 12. Scaling Strategy

- **Stage 1 (MVP):** Single server, PM2, Redis, External Postgres — Handles 5k–10k students
- **Stage 2:** Separate worker server — Handles 50k students
- **Stage 3:** Container orchestration (Kubernetes) — Handles 500k+ students

---

### 13. Monitoring

**Recommended tools:** PM2 logs, Sentry, UptimeRobot, Queue monitoring

**Track:** Worker failures, Queue backlog, AI errors, API latency

---

### 14. Cost Estimate (MVP)

**Typical monthly cost:** Server/VPS $30–40, Database $20, Redis $10, LLM usage variable. **Approximate:** $50–100/month

---

### Final System Summary

Spinzy is designed as an **AI tutor platform**.

```text
Learning Intelligence
        ↓
TopicRanker
        ↓
Session Engine
        ↓
Lesson Content
        ↓
Student Learning Experience
```

Instead of building a **Content library**, Spinzy builds:

```text
AI decision engine
        ↓
Structured learning session
        ↓
Guided student experience
```

This architecture supports **long-term scalability and personalized learning**.

---

*End of Document.*

---

## Production server setup checklist (30 steps)

*See **Almalinux-Deployment-Guide.md** for the full 30-step production server setup checklist.*
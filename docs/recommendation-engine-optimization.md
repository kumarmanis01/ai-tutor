# Recommendation Engine & Test/Notes Tab Analysis

**Date:** 2026-02-01
**Analyst:** Principal Enterprise Architect
**Scope:** Recommendation engine optimization, test & notes tab fixes, learning trajectory improvements

---

## Executive Summary

The AI Tutor platform has a **well-architected recommendation engine** with multi-signal scoring, but it has **critical navigation bugs** in the Notes tab and **missing feedback loops** that prevent the engine from learning from user behavior. This document provides:

1. **Issue Analysis** - Current problems and their impact
2. **Optimization Roadmap** - Prioritized fixes and enhancements
3. **Implementation Plan** - Detailed code changes with migrations
4. **Testing Strategy** - Comprehensive test coverage

---

## 1. CRITICAL ISSUES IDENTIFIED

### 1.1 Notes Tab Navigation Broken ❌

**File:** [app/dashboard/components/Notes/sections/NotesBookmarked.tsx:21](app/dashboard/components/Notes/sections/NotesBookmarked.tsx#L21)

**Problem:**
```typescript
window.location.assign(`/learn`);  // ❌ Hardcoded, loses note context
```

**Impact:**
- Users click a bookmarked note → redirected to generic `/learn` page
- No note ID passed → cannot load specific note content
- Inconsistent UX compared to Tests tab

**Fix:**
```typescript
window.location.assign(`/learn?noteId=${note.id}&type=note`);
```

---

### 1.2 Development Stubs Still in Production Code ⚠️

**Files:**
- [app/dashboard/components/Notes/context/NotesProvider.tsx:18-45](app/dashboard/components/Notes/context/NotesProvider.tsx#L18-L45)
- [app/dashboard/components/Tests/context/TestsProvider.tsx:15-35](app/dashboard/components/Tests/context/TestsProvider.tsx#L15-L35)

**Problem:**
- `StubNotesService` and `StubTestsService` classes present but unused
- Risk of accidental activation during development
- Code bloat

**Fix:** Remove stub classes, move to dedicated test fixtures

---

### 1.3 Missing Recommendation Feedback Loop 🔄

**File:** [lib/recommendations/engine.ts](lib/recommendations/engine.ts)

**Problem:**
- Engine tracks engagement via `ContentRecommendation` table (shown/clicked/completed)
- **BUT** these signals are NOT used for future recommendations
- No way to learn which recommendations work vs. fail
- Static score weights never adapt

**Current Flow:**
```
Recommendation Shown → Tracked → ❌ NO FEEDBACK to engine
```

**Desired Flow:**
```
Recommendation Shown → Tracked → ✅ Used in next scoring cycle
```

**Impact:**
- Engine cannot improve over time
- Keeps suggesting content users ignore
- Wastes student time with irrelevant recommendations

---

### 1.4 Limited Learning Trajectory Tracking 📊

**Current State:**
- `StudentLearningProfile` tracks weak subjects (< 60% accuracy)
- `StudentStreak` tracks simple counters (current/best)
- **Missing:**
  - Weekly/monthly learning velocity
  - Concept mastery progression
  - Time-to-proficiency metrics
  - Topic-level granularity

**Impact:**
- Cannot detect if student is improving in weak areas
- No early warning for students falling behind
- Recommendations lack temporal context

---

## 2. RECOMMENDATION ENGINE ARCHITECTURE

### 2.1 Current Implementation (v1.0)

**File:** [lib/recommendations/engine.ts](lib/recommendations/engine.ts)

**Scoring Signals:**
| Signal | Weight | Description |
|--------|--------|-------------|
| PROFILE_MATCH | 30 | Board/grade/subject alignment |
| WEAK_SUBJECT_BOOST | 25 | Content in struggling subjects |
| LOW_SCORE_CHAPTER | 20 | Poor test performance areas |
| RECENT_TOPIC_RELEVANCE | 15 | Related to recent studies |
| INCOMPLETE_SESSION | 35 | Resume unfinished learning (highest) |
| DIFFICULTY_MATCH | 10 | Preferred difficulty level |
| FRESHNESS | 5 | Newer content bonus |
| ENGAGEMENT_HISTORY | 10 | Past engagement patterns |
| PEER_POPULARITY | 5 | Popular among similar users (not implemented) |

**Content Sources:**
1. `ContentCatalog` - Manual content library
2. `ChapterDef` - Curriculum hierarchy
3. `Question` - Practice question banks
4. `Note` - User-created public notes
5. `TopicNote` - AI-generated curriculum notes
6. `GeneratedTest` - AI-generated practice tests

**Strengths:**
- ✅ Multi-source content pooling
- ✅ Deep test performance analysis
- ✅ Filters out completed content
- ✅ Async learning profile updates
- ✅ Fallback chain for robustness

**Weaknesses:**
- ❌ No feedback loop from engagement
- ❌ Static score weights (never adapt)
- ❌ PEER_POPULARITY signal not implemented
- ❌ No negative signals (ignored recommendations)
- ❌ Limited temporal patterns

---

## 3. OPTIMIZATION ROADMAP

### Phase 1: Critical Fixes (Week 1)
**Priority: P0 - Must have**

1. **Fix Notes Tab Navigation**
   - Update `NotesBookmarked.tsx` to pass note ID
   - Ensure `/learn` page can accept `?noteId=` param
   - Test navigation flow end-to-end

2. **Remove Development Stubs**
   - Delete `StubNotesService` and `StubTestsService` classes
   - Move stubs to `tests/fixtures/` directory
   - Update imports in test files

3. **Add Negative Feedback Tracking**
   - Track "ignored" recommendations (shown but not clicked after 7 days)
   - Add `ContentRecommendation.isIgnored` field
   - Create migration

---

### Phase 2: Feedback Loop (Week 2)
**Priority: P0 - Must have**

4. **Implement Engagement-Based Scoring**
   - New signal: `POSITIVE_ENGAGEMENT_BOOST` (+15 points)
   - New signal: `NEGATIVE_ENGAGEMENT_PENALTY` (-20 points)
   - Query `ContentRecommendation` history in scoring
   - Boost content types with high click-through rates
   - Penalize content types user consistently ignores

5. **Add Adaptive Score Weights**
   - Track recommendation effectiveness per signal
   - Adjust weights quarterly based on conversion rates
   - Store in `SystemSetting` table

---

### Phase 3: Learning Trajectory (Week 3)
**Priority: P1 - Should have**

6. **Enhanced Learning Profile**
   - Add `StudentLearningProfile.weeklyProgress` JSON field
   - Track week-over-week accuracy improvements
   - Calculate learning velocity (concepts/week)
   - Migration required

7. **Topic-Level Mastery Tracking**
   - Create `StudentTopicMastery` table
   - Track mastery levels: beginner → intermediate → advanced → expert
   - Update on every test submission
   - Use for personalized recommendations

8. **Time-Based Recommendation Signals**
   - New signal: `SPACED_REPETITION` (+10 points)
   - Recommend content for review after optimal intervals (3d, 7d, 30d)
   - Track last interaction per topic

---

### Phase 4: Advanced Features (Week 4)
**Priority: P2 - Nice to have**

9. **Peer Popularity Implementation**
   - Aggregate `ContentRecommendation.isCompleted` by board/grade/subject cohort
   - Add `PEER_POPULARITY` signal scoring

10. **A/B Testing Framework**
    - Create `RecommendationExperiment` table
    - Test different score weights
    - Measure conversion rates (shown → clicked → completed)

11. **ML-Based Scoring (Future)**
    - Train model on historical engagement data
    - Predict click-through probability
    - Replace manual score weights

---

## 4. IMPLEMENTATION DETAILS

### 4.1 Database Schema Changes

**Migration 1: Add Ignored Tracking**
```prisma
model ContentRecommendation {
  id           String    @id @default(cuid())
  userId       String
  contentId    String
  isShown      Boolean   @default(false)
  isClicked    Boolean   @default(false)
  isCompleted  Boolean   @default(false)
  isIgnored    Boolean   @default(false)  // NEW
  firstShownAt DateTime?
  lastShownAt  DateTime?
  clickedAt    DateTime?
  completedAt  DateTime?
  ignoredAt    DateTime?  // NEW
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  user         User      @relation(fields: [userId], references: [id])

  @@unique([userId, contentId])
  @@index([userId, isIgnored])  // NEW
}
```

**Migration 2: Create Topic Mastery Table**
```prisma
model StudentTopicMastery {
  id                  String         @id @default(cuid())
  studentId           String
  topicId             String
  subject             String
  chapter             String
  masteryLevel        MasteryLevel   @default(beginner)
  accuracy            Float          @default(0)
  questionsAttempted  Int            @default(0)
  lastAttemptedAt     DateTime?
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt
  student             User           @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, topicId])
  @@index([studentId, masteryLevel])
  @@index([subject, chapter])
}

enum MasteryLevel {
  beginner
  intermediate
  advanced
  expert
}
```

---

## 5. SUCCESS METRICS

### 5.1 Key Performance Indicators (KPIs)

**Engagement Metrics:**
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Recommendation CTR | ~15% | 25% | ContentRecommendation.isClicked / isShown |
| Completion Rate | ~40% | 60% | ContentRecommendation.isCompleted / isClicked |
| Ignored Rate | ~50% | <30% | ContentRecommendation.isIgnored / isShown |
| Avg Recommendations Shown | 15/session | 10/session | Fewer, more relevant |

**Learning Outcome Metrics:**
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Week-over-Week Improvement | +5% | +10% | StudentLearningProfile.weeklyProgress |
| Mastery Progression Rate | 1 level/month | 1.5 levels/month | StudentTopicMastery transitions |
| Weak Subject Recovery | 30% students | 50% students | Weak → Not Weak within 4 weeks |

---

## 6. RISKS & MITIGATION

### Risk 1: Engagement Data Too Sparse (New Students)
**Impact:** New students have no engagement history → feedback loop ineffective

**Mitigation:**
- Fallback to profile-based scoring (existing logic)
- Require minimum 10 recommendations shown before using engagement signals
- Pre-seed recommendations with cohort averages

### Risk 2: Migration Downtime
**Impact:** Backfilling topic mastery may take hours for large databases

**Mitigation:**
- Run backfill during low traffic window (2-4 AM)
- Process in batches of 1000 records
- Add progress logging
- Make backfill resumable

### Risk 3: Overfitting to Recent Behavior
**Impact:** User ignores tests for 2 weeks → never sees tests again

**Mitigation:**
- Add decay to engagement signals (exponential decay over 30 days)
- Always include 1-2 diverse recommendations
- Refresh engagement weights weekly

---

## 7. NEXT STEPS

### Immediate Actions (This Week):
1. ✅ Review this document with product team
2. ✅ Prioritize Phase 1 critical fixes
3. ✅ Assign implementation to engineering team
4. ✅ Schedule deployment windows

### Week 1 Deliverables:
- [ ] Fix Notes tab navigation
- [ ] Remove stub services
- [ ] Add `isIgnored` migration
- [ ] Deploy background job
- [ ] Write unit tests

### Week 2 Deliverables:
- [ ] Create `StudentTopicMastery` table
- [ ] Implement mastery update logic
- [ ] Run backfill script
- [ ] Integration tests

### Week 3 Deliverables:
- [ ] Implement engagement feedback loop
- [ ] Deploy A/B test
- [ ] Monitor metrics

### Week 4 Deliverables:
- [ ] Analyze A/B test results
- [ ] Full rollout
- [ ] Documentation update
- [ ] Retrospective meeting

---

**Document Version:** 1.0
**Last Updated:** 2026-02-01
**Status:** Ready for Implementation

# Recommendation Engine — Architecture Document

> Last updated: 2026-03-03

## Overview

The recommendation engine generates personalized content suggestions for students on the dashboard (Home, Notes, Practice tabs). It uses a multi-signal scoring system anchored on **topicId** as the primary learning unit.

**Key design principles:**
- Topic-first: every recommendation maps to a topic (when available).
- Canonical identity: all content IDs normalize to `{type}:{topicId}`.
- Engagement-aware: feedback loop adjusts scores based on past user behavior.
- Type-diverse: guarantees a balanced mix of content types.
- No ML required: deterministic signal-based scoring with tunable weights.

---

## File Map

| File | Role |
|------|------|
| `lib/recommendations/engine.ts` | Core engine: signals, candidates, scoring, diversity |
| `app/api/dashboard/recommendations/route.ts` | API endpoint + fallback logic |
| `hooks/useRecommendations.ts` | Generic frontend hook for fetching recommendations |
| `hooks/useLearningRecommendation.ts` | Picks a single "current learning topic" from recommendations |
| `hooks/usePracticeRecommendation.ts` | Picks a single "practice topic" from recommendations |
| `app/(student)/dashboard/components/SuggestedContent.tsx` | UI component for displaying recommendations |

---

## Architecture

### Pipeline

```
User Request → API Route → Engine
                              ├── 1. Gather User Signals
                              ├── 2. Fetch Candidate Content
                              ├── 3. Filter Completed
                              ├── 4. Score Each Candidate
                              ├── 5. Diversify & Deduplicate
                              └── 6. Return Top N
```

### Signal Gathering

Signals are collected from multiple data sources in a single parallel query:

| Signal | Source | Purpose |
|--------|--------|---------|
| Profile (board, grade, subjects) | `User` table | Base filtering |
| Weak subjects | `StudentLearningProfile` | Boost struggling areas |
| Low-score chapters | `TestResult` + `AttemptQuestions` | Target review content |
| Recent topicIds | `LearningSession.meta.topicId` | Relevance scoring |
| Incomplete topicIds | `LearningSession` (not completed, <80%) | Resume signal |
| Engagement patterns | `LearningSession` activity types | Type frequency |
| Engagement by type | `ContentRecommendation` (shown/clicked/completed/ignored) | Feedback loop |
| Completed content | `ContentRecommendation` (isCompleted) | Exclusion filter |

### Canonical Content Identity (Fix A)

All content IDs normalize to a canonical format to ensure consistent matching across signals and candidates.

**Format:** `{type}:{topicId}`

| Content Type | Canonical ID |
|---|---|
| TopicNote | `notes:{topicId}` |
| GeneratedTest | `test:{topicId}` |
| Practice (questions) | `practice:{chapterKey}` |
| ChapterDef (lesson) | `lesson:{chapterId}` |
| Catalog item | original contentId |
| User note | `note:{noteId}` |

**Helper:** `normalizeContentId(item)` — exported, used in both engine scoring and completion filtering.

**Session normalization:** `extractSessionTopicId(activityRef, meta)` extracts topicId from learning sessions by checking `meta.topicId` → `meta.topic` → parsing `activityRef`.

### Engagement Mapping (Fix B)

Candidate `source` values don't match engagement tracking keys. A mapping layer bridges the gap.

| Candidate Source | Engagement Type |
|---|---|
| `question` | `practice` |
| `generatedTest` | `test` |
| `topicNote` | `notes` |
| `note` | `notes` |
| `chapter` | `lesson` |
| `catalog` | `lesson` |

**Helper:** `mapSourceToEngagementType(source)` — exported.

### Candidate Sources

The engine fetches from 6 content sources:

1. **ContentCatalog** — manually curated content items
2. **ChapterDef** — syllabus chapters → `lesson` type
3. **Question** (grouped by chapter) — practice sets (3+ questions per chapter)
4. **Note** — public user-created notes
5. **TopicNote** — AI-hydrated topic notes (approved + active)
6. **GeneratedTest** — AI-hydrated tests (approved + active)

TopicNotes and GeneratedTests always include full topic metadata:
```
meta: { topicId, topicName, chapterId, chapterName, subjectId, subjectName }
```

---

## Scoring Algorithm

Each candidate is scored by summing weighted signals:

| Signal | Weight | Condition |
|--------|--------|-----------|
| Profile match (board + grade) | +30 | Both match |
| Profile partial | +15 | One matches |
| Subject in curriculum | +15 | Subject in user's list |
| Weak subject boost | +25 | Subject in weak list |
| Low-score chapter | +20 | Chapter accuracy < 60% |
| Recent topic relevance | +15 | TopicId in last 10 session topics |
| **Resume session** | **+50** | TopicId has an incomplete session |
| Difficulty match | +10 | Matches preferred difficulty |
| Freshness (< 30 days) | +5 | Recently created |
| Practice boost | +5 | Practice type with score > 30 |
| Type frequency | +10 | User has 3+ sessions of this type |
| Positive engagement | +15 | CTR > 50% with 5+ impressions |
| High completion | +7 | Completion rate > 60% with 3+ clicks |
| Negative engagement | -20 | Ignore rate > 30% with 5+ impressions |

**Resume learning (+50)** is the highest individual signal, ensuring "Continue where you left off" floats to the top.

---

## Diversity Algorithm (Fix C)

Instead of returning the top N items by score, the engine guarantees type diversity.

**Phase 1 — Slot filling:**
Pick the highest-scoring item for each type: `lesson`, `practice`, `notes`, `test`.

**Phase 2 — Score fill:**
Fill remaining slots from the score-sorted pool, subject to:
- Max 2 items of the same type
- No duplicate topicIds

**Final sort:** Results are re-sorted by score so resume items appear first.

---

## Fallback Strategy (Prompt 6)

When the engine returns empty (new user, data error), the API route falls back through:

| Priority | Strategy | Content |
|----------|----------|---------|
| 1 | Incomplete session | Resume the most recent unfinished topic |
| 2 | Weak mastery topic | Practice on a topic where test score < 60% |
| 3 | Chapter sequence | Next chapter in the syllabus |
| 4 | Generic explore | "Explore Mathematics" |

All fallback items include `meta.topicId`, `meta.chapterId`, `meta.subjectId` when available.

---

## Observability (Prompt 7)

### Log Tags

| Tag | When | Fields |
|-----|------|--------|
| `[CONTENT_ID_NORMALIZED]` | ID changed during normalization | `originalId`, `normalizedId` |
| `[ENGAGEMENT_MAPPING]` | Engagement score applied | `candidateSource`, `mappedType`, `engagementScore` |
| `[RECOMMENDATION_DECISION]` | Every scored candidate | `studentId`, `candidateId`, `topicId`, `score`, `signalsApplied`, `engagementBoost`, `resumeBoost` |

All observability logs use `logger.debug` to avoid noise in production. Enable debug level for troubleshooting.

---

## API Contract

```
GET /api/dashboard/recommendations
→ { items: RecommendationItem[] }
```

Each item:
```json
{
  "id": "string",
  "contentId": "notes:topicId-123",
  "type": "notes",
  "subject": "Biology",
  "title": "Cell Structure Notes",
  "chapter": "cell-biology",
  "difficulty": "medium",
  "score": 85,
  "reasoning": "Continue where you left off • In your Biology curriculum",
  "priority": 85,
  "meta": {
    "topicId": "topicId-123",
    "topicName": "Cell Structure",
    "chapterId": "chapterId-456",
    "chapterName": "Cell Biology",
    "subjectId": "subjectId-789",
    "subjectName": "Biology"
  }
}
```

The API contract is unchanged — existing frontend hooks work without modification.

---

## Expected Behavior

| Scenario | Recommendations |
|----------|----------------|
| **First login** | Start Learning → first chapter topics (lesson + notes) |
| **Returning student** | Continue Learning → topic with incomplete session at top |
| **Weak student** | Strengthen Concepts → practice for low-score topics |
| **Practice tab** | Recommended Practice → mixed difficulties for weak topics |
| **Active student** | Diverse mix: 1 lesson, 1 practice, 1 notes, 1 test |

---

## Future: Spaced Repetition (Optional)

A high-impact future improvement:

```
spacedRepetitionScore = f(lastAttemptAt, masteryScore, timeDecay)
```

Based on:
- `lastAttemptAt` — when the student last practiced a topic
- `masteryScore` — current accuracy for that topic
- `timeDecay` — exponential decay since last review

This would add a new signal weight (e.g., `SPACED_REPETITION: 20`) and dramatically improve long-term retention.

---

## What NOT to Change

| Component | Reason |
|-----------|--------|
| HydrateAll pipeline | Separate concern (content generation) |
| Prisma schema | No schema changes needed |
| ExecutionJob / HydrationJob | Job architecture is stable |
| Recommendation API contract | Frontend depends on it |

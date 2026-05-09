<!--
FILE OBJECTIVE:
- Comprehensive requirements specification for the Analytics & Learning Intelligence System (ALIS) that powers adaptive learning, AI quality optimization, retention, and executive decision-making across the Vidya AI tutor platform.

LINKED UNIT TEST:
- tests/unit/docs/analytics_requirements.spec.ts

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/ENGINEERING_PRACTICES.md
- .github/copilot-instructions.md
- /docs/v2/VISION.md

EDIT LOG:
- 2026-05-09T00:00:00Z | copilot | created initial analytics requirements specification
- 2026-05-09T00:00:00Z | copilot | added sections 30-45: governance, safety, data architecture, cost control, access management, outcomes tracking
-->

# Analytics & Learning Intelligence System Requirements

## Vidya — AI Home Tutor Platform

---

# 1. Objective

The analytics system shall function as the central intelligence layer of the Vidya platform.

It shall:

- capture behavioral, academic, operational, financial, AI, and engagement data
- power adaptive learning
- improve AI tutoring quality
- optimize pedagogy
- improve retention and monetization
- support parent communication
- reduce churn
- enable predictive interventions
- support executive and operational decision-making

The analytics system shall not be limited to traditional product analytics (DAU, clicks, sessions).

It shall operate as:

> a real-time educational intelligence and decisioning platform.

---

# 2. Scope

The analytics platform shall capture and process data from:

- student applications
- parent applications
- web platform
- mobile applications
- AI tutor interactions
- content generation systems
- assessment engines
- revision engines
- notifications
- billing systems
- subscription systems
- support systems
- infrastructure systems
- experimentation systems
- recommendation systems

---

# 3. Architectural Principles

The analytics system shall be:

| Principle        | Requirement                                        |
| ---------------- | -------------------------------------------------- |
| Event-driven     | All important actions emitted as structured events |
| Near real-time   | Core behavioral data available within seconds      |
| Historical       | Long-term trend analysis supported                 |
| Student-centric  | Unified student learning timeline maintained       |
| AI-observable    | Every AI generation and interaction tracked        |
| Privacy-aware    | COPPA/GDPR/DPDP compliant where applicable         |
| Scalable         | Must support millions of events/day                |
| Extensible       | New event types added without schema breakage      |
| Queryable        | Support operational + analytical querying          |
| Cost-aware       | Efficient storage and processing strategy          |
| Experiment-ready | A/B test attribution built-in                      |

---

# 4. Core Analytics Domains

The platform shall support the following analytics domains:

1. Authentication & Onboarding Analytics
2. Student Demographic Analytics
3. Product Usage Analytics
4. Learning Journey Analytics
5. Concept Mastery Analytics
6. AI Tutor Analytics
7. AI Content Generation Analytics
8. Behavioral & Engagement Analytics
9. Assessment Analytics
10. Revision Analytics
11. Recommendation Analytics
12. Notification Analytics
13. Parent Analytics
14. Payment & Revenue Analytics
15. Subscription Analytics
16. Support & Operations Analytics
17. Infrastructure & Performance Analytics
18. Experimentation Analytics
19. Predictive Intelligence Analytics
20. Executive Intelligence Analytics

---

# 5. Authentication & Onboarding Analytics Requirements

## 5.1 Event Tracking

The system shall track:

- signup_started
- signup_completed
- otp_sent
- otp_verified
- otp_failed
- login_success
- login_failure
- session_expired
- logout
- password_reset_requested
- password_reset_completed

---

## 5.2 Funnel Analytics

The system shall track onboarding funnel progression:

```text
Landing Page
→ Signup Started
→ OTP Verified
→ Parent Profile Created
→ Student Added
→ Board Selected
→ Class Selected
→ Subject Preferences Selected
→ First Lesson Started
→ First AI Interaction
→ First Session Completed
→ First Subscription Purchase
```

---

## 5.3 Metrics

The platform shall compute:

- signup conversion rate
- onboarding completion rate
- OTP failure rate
- login failure rate
- time-to-first-learning-session
- time-to-first-AI-interaction
- time-to-first-payment
- onboarding abandonment rate
- onboarding step dropoff distribution

---

# 6. Student Demographic Analytics Requirements

The system shall store and analyze:

| Category      | Data                      |
| ------------- | ------------------------- |
| Geography     | city, state, country      |
| Academic      | board, class, subjects    |
| Institution   | school type               |
| Language      | preferred language        |
| Device        | device ownership type     |
| Connectivity  | network quality           |
| Family        | sibling count (optional)  |
| Usage Context | shared vs personal device |

---

## 6.1 Cohort Segmentation

The system shall support segmentation by:

- board
- grade
- geography
- school type
- language
- acquisition source
- subscription plan
- study consistency
- learning pace
- engagement level

---

# 7. Product Usage Analytics Requirements

## 7.1 Navigation Analytics

The platform shall capture:

- page visits
- screen transitions
- navigation paths
- session durations
- feature entry points
- rage clicks
- dead clicks
- excessive back navigation
- scroll depth
- search usage

---

## 7.2 Feature Analytics

The system shall measure usage frequency for:

- AI tutor
- notes
- quizzes
- tests
- revision tools
- flashcards
- bookmarks
- voice tutor
- practice engine
- exam prep tools

---

# 8. Learning Journey Analytics Requirements

## Critical Requirement

The system shall maintain a continuous learning timeline per student.

---

## 8.1 Learning Events

The platform shall track:

- lesson_started
- lesson_paused
- lesson_resumed
- lesson_completed
- lesson_abandoned
- topic_started
- topic_completed
- chapter_completed
- revision_started
- revision_completed

---

## 8.2 Journey Metrics

The system shall compute:

- chapter completion rate
- topic completion rate
- average learning duration
- abandonment points
- replay frequency
- skipped section frequency
- resumption rate
- learning continuity score

---

## 8.3 Dropoff Intelligence

The system shall identify:

- high abandonment sections
- difficult examples
- confusing explanations
- excessive replay zones
- low completion concepts

---

# 9. Concept Mastery Analytics Requirements

The system shall maintain concept-level mastery models.

---

## 9.1 Per Concept Tracking

The system shall store:

- mastery score
- confidence score
- attempts
- accuracy
- revision frequency
- retention score
- hint dependency
- misconception frequency
- forgetting curve score

---

## 9.2 Mastery Intelligence

The platform shall support:

- weak concept detection
- prerequisite gap detection
- retention decay prediction
- mastery progression tracking
- concept dependency analysis

---

# 10. AI Tutor Analytics Requirements

## High Priority Requirement

Every AI interaction shall be observable.

---

## 10.1 AI Interaction Tracking

The platform shall capture:

- doubt_asked
- hint_requested
- voice_query_started
- voice_query_completed
- clarification_requested
- explanation_regenerated
- conversation_abandoned
- feedback_submitted

---

## 10.2 AI Conversation Metrics

The system shall compute:

- average conversation depth
- follow-up question rate
- confusion loop frequency
- explanation effectiveness
- language preference
- voice vs text usage
- frustration indicators
- satisfaction indicators

---

## 10.3 Confusion Detection

The system shall detect signals such as:

- repeated same doubt
- repeated explanation requests
- abandonment after explanation
- "I don't understand" phrases
- excessive hint dependency

---

# 11. AI Content Generation Analytics Requirements

## Critical AI Cost & Quality Layer

---

## 11.1 Generation Tracking

The platform shall track every generation request:

| Field              | Requirement                |
| ------------------ | -------------------------- |
| generation_id      | unique                     |
| generation_type    | notes/quiz/explanation/etc |
| model_used         | required                   |
| prompt_version     | required                   |
| token_input        | required                   |
| token_output       | required                   |
| latency            | required                   |
| retry_count        | required                   |
| regeneration_count | required                   |
| cache_hit          | required                   |
| cost               | required                   |

---

## 11.2 Generation Types

Supported analytics for:

- notes generation
- quiz generation
- revision generation
- flashcard generation
- explanation generation
- translation generation
- voice synthesis
- image generation
- adaptive remediation generation

---

## 11.3 AI Efficiency Metrics

The system shall compute:

- average generation cost
- average latency
- regeneration frequency
- cache reuse rate
- duplicate generation rate
- generation abandonment rate
- failed generation rate
- generation satisfaction rate

---

# 12. Behavioral & Engagement Analytics Requirements

## 12.1 Behavioral Signals

The system shall capture:

- active days/week
- streaks
- study timing
- procrastination patterns
- reminder response rate
- comeback frequency
- inactivity periods
- exam-season behavior

---

## 12.2 Engagement Metrics

The system shall compute:

- DAU
- WAU
- MAU
- session frequency
- average session duration
- feature engagement rates
- retention D1/D7/D30
- cohort retention

---

# 13. Assessment Analytics Requirements

## 13.1 Assessment Events

The platform shall track:

- question_answered
- question_skipped
- answer_correct
- answer_incorrect
- mock_test_started
- mock_test_completed

---

## 13.2 Performance Metrics

The system shall compute:

- accuracy
- speed
- concept-wise performance
- question-type performance
- cognitive-skill performance
- careless mistake frequency
- improvement velocity

---

## 13.3 Cognitive Skill Classification

Questions shall support classification into:

- recall
- understanding
- application
- analysis

---

# 14. Revision Analytics Requirements

The system shall support spaced repetition analytics.

---

## 14.1 Revision Metrics

The platform shall compute:

- revision frequency
- revision completion rate
- forgotten concept rate
- retention after revision
- revision compliance

---

## 14.2 Retention Intelligence

The system shall estimate:

- retention decay
- optimal revision timing
- high-risk forgetting concepts

---

# 15. Recommendation Engine Analytics Requirements

The system shall track:

- recommendation impressions
- recommendation clicks
- recommendation completions
- ignored recommendations
- recommendation effectiveness
- intervention success rate

---

# 16. Notification Analytics Requirements

## 16.1 Notification Events

Track:

- notification_sent
- notification_opened
- notification_clicked
- notification_ignored
- notification_muted

---

## 16.2 Metrics

The system shall compute:

- open rates
- click rates
- reminder effectiveness
- comeback-after-notification rate
- notification fatigue score
- mute probability

---

# 17. Parent Analytics Requirements

## 17.1 Parent Engagement Metrics

Track:

- report open rates
- WhatsApp interaction rates
- email open rates
- parent dashboard visits
- parent concern categories
- support tickets

---

## 17.2 Parent Trust Signals

The system shall estimate:

- parent engagement score
- trust score
- churn-risk due to parent disengagement

---

# 18. Payment & Revenue Analytics Requirements

## Critical Business Layer

---

## 18.1 Payment Events

Track:

- trial_started
- trial_completed
- payment_attempted
- payment_successful
- payment_failed
- subscription_started
- subscription_renewed
- subscription_cancelled
- refund_requested
- refund_processed

---

## 18.2 Revenue Metrics

Compute:

- MRR
- ARR
- ARPU
- LTV
- CAC
- renewal rate
- churn rate
- failed payment recovery rate

---

## 18.3 Pending Payment Analytics

Track:

- overdue payments
- average overdue duration
- payment reminder effectiveness
- payment recovery rate

---

## 18.4 Repeat Customer Analytics

Compute:

- repeat payment rate
- annual upgrade rate
- plan migration patterns
- cross-subject purchase rate

---

# 19. Support & Operations Analytics Requirements

The platform shall track:

- ticket volume
- average resolution time
- escalation rate
- refund request rate
- AI resolution rate
- common complaint categories

---

# 20. Infrastructure & Performance Analytics Requirements

## Critical for India-scale deployment

---

## 20.1 Client Performance Metrics

Track:

- app load time
- API latency
- crash rate
- video buffering rate
- memory usage
- battery impact
- low-end device failures

---

## 20.2 AI Infrastructure Metrics

Track:

- queue latency
- token consumption
- model failure rates
- timeout rates
- throughput
- peak generation windows

---

# 21. Experimentation Analytics Requirements

The system shall support:

- A/B testing
- cohort experimentation
- prompt experimentation
- pedagogy experiments
- notification timing experiments

---

## 21.1 Attribution Requirements

Every event shall support:

- experiment_id
- variant_id
- prompt_version
- feature_flag

---

# 22. Predictive Intelligence Requirements

## Advanced Layer

The system shall support predictive models for:

- churn risk
- exam risk
- burnout risk
- payment default risk
- disengagement probability
- topper potential
- retention decay

---

# 23. Executive Dashboard Requirements

## 23.1 CEO Dashboard

Must expose:

- revenue
- retention
- engagement
- AI costs
- learning outcomes
- churn risk
- subscription growth

---

## 23.2 Product Dashboard

Must expose:

- dropoff points
- weak UX flows
- feature adoption
- AI satisfaction
- pedagogy effectiveness

---

## 23.3 Academic Dashboard

Must expose:

- mastery progression
- weak concepts
- exam readiness
- revision compliance

---

## 23.4 AI Ops Dashboard

Must expose:

- token costs
- generation latency
- cache hit rates
- model reliability
- prompt effectiveness

---

# 24. Data Architecture Requirements

The system shall support:

- event streaming
- event replay
- immutable event storage
- aggregation pipelines
- warehouse integration
- near real-time dashboards

---

## 24.1 Event Structure

All events shall include:

```json
{
  "event_id": "",
  "event_name": "",
  "timestamp": "",
  "student_id": "",
  "parent_id": "",
  "session_id": "",
  "device_id": "",
  "platform": "",
  "metadata": {}
}
```

---

# 25. Privacy & Compliance Requirements

The platform shall support:

- consent tracking
- parental consent workflows
- data deletion workflows
- anonymization
- encryption
- audit logs

---

# 26. Scalability Requirements

The analytics system shall support:

- millions of daily events
- near real-time processing
- long-term historical storage
- low-latency querying
- distributed ingestion pipelines

---

# 27. Non-Functional Requirements

| Category          | Requirement                     |
| ----------------- | ------------------------------- |
| Availability      | 99.9%                           |
| Event Durability  | No data loss                    |
| Scalability       | Horizontal                      |
| Query Performance | Sub-second dashboards           |
| Extensibility     | Schema evolution supported      |
| Security          | Encryption in transit & at rest |

---

# 28. Final Product Philosophy

The analytics platform shall not merely report usage statistics.

It shall function as:

- a learning intelligence engine
- a pedagogy optimization engine
- a retention optimization system
- an AI observability platform
- a parent trust intelligence layer
- a predictive intervention system

The ultimate objective is:

> understanding what helps each student learn most effectively, consistently, confidently, and successfully.

---

# 29. Success Criteria

The Analytics & Learning Intelligence System is considered production-ready when:

1. **Core Events**: 100% of critical business events (signup, lesson, doubt, payment, assessment, revision) are captured and validated
2. **Real-time Dashboards**: All executive dashboards render within 2 seconds with <5s event-to-dashboard latency
3. **Historical Availability**: Complete event history available for analysis with query latency <1s
4. **Data Quality**: 99.99% event integrity, zero data loss in production
5. **Privacy Compliance**: All COPPA/GDPR/DPDP requirements met and audited
6. **Scalability**: System processes 10M+ events/day without degradation
7. **AI Cost Attribution**: Token costs and regeneration patterns accurately tracked for all models
8. **Student Timeline**: Continuous unified learning journey available per student
9. **Predictive Models**: Churn, exam risk, and disengagement models deployed and validated
10. **Documentation**: Comprehensive event schema, dashboard specs, and data dictionary maintained

---

# 30. Analytics Governance Requirements

The analytics platform shall operate under an explicit governance framework that prevents metric drift, naming conflicts, and operational chaos.

---

## 30.1 Event Naming Convention

All events shall follow a mandatory three-part naming structure:

```text
domain.entity.action
```

Where:
- **domain**: Functional area (auth, learning, ai, payment, support, infrastructure)
- **entity**: Subject (signup, lesson, doubt, subscription, ticket, queue)
- **action**: Verb (started, completed, failed, updated, cancelled)

### Examples

```text
auth.signup.started
auth.signup.completed
auth.otp.verified
auth.otp.failed
learning.lesson.started
learning.lesson.completed
learning.lesson.abandoned
learning.doubt.asked
ai.generation.started
ai.generation.completed
ai.generation.failed
payment.subscription.started
payment.subscription.renewed
payment.subscription.cancelled
payment.payment.succeeded
payment.payment.failed
```

---

## 30.2 Schema Versioning

All event schemas shall support versioning to enable evolution without breaking consuming systems.

Requirements:

- **Backward Compatibility**: New event versions must be readable by consumers expecting previous versions
- **Version Tracking**: Every event must include `schema_version` field
- **Deprecated Field Handling**: Deprecated fields must remain valid for 90 days minimum before removal
- **Migration Strategy**: Breaking changes require migration plan and deprecation notice period of 30 days minimum
- **Documentation**: All schema changes must be documented with rationale and timeline

---

## 30.3 Metric Ownership

Every KPI and dashboard metric shall have explicit ownership to prevent orphaning and ensure accountability.

For each metric, define:

- **Owner Team**: The team responsible for metric correctness and interpretation
- **Definition**: Precise business definition (not just SQL)
- **Formula**: Exact calculation method including edge cases
- **Source of Truth**: Canonical data source (which table/database)
- **Refresh Frequency**: How often the metric updates
- **Alerting Threshold**: When to escalate metric degradation
- **Historical Data Available**: Date from which metric data exists

Example:

| Metric | Owner | Definition | Formula | Source | Refresh |
|--------|-------|------------|---------|--------|---------|
| Onboarding Conversion Rate | Product | % of signups that complete onboarding | completed_onboardings / signups | events.onboarding | Daily |
| Avg Generation Cost | AI Ops | Average token cost per AI generation | sum(tokens_output × cost_per_token) / generation_count | ai_generations | Real-time |

---

## 30.4 Analytics Review Process

Material changes to analytics infrastructure shall undergo governance review.

Changes requiring review:

- **New Events**: All new event types before emission
- **Schema Changes**: Any field additions/removals/renames
- **Dashboard Changes**: New executive dashboards or metric changes
- **Predictive Models**: New models before deployment
- **Retention Policies**: Changes to data retention rules
- **Access Control**: Changes to dashboard visibility or metric restrictions

Review process:

1. Proposer submits change with business rationale
2. Analytics lead validates schema/correctness
3. Product lead approves business relevance
4. Legal/compliance reviews if sensitive
5. Approved changes documented with rationale and timeline

---

# 31. Data Platform Architecture Requirements

The analytics system shall define explicit storage, processing, and retention architectures to support scalability and cost efficiency.

---

## 31.1 Storage Layers

The platform shall maintain three storage tiers with different cost/performance/retention profiles:

### Hot Storage (Real-time)

- **Data**: Last 30 days of events
- **Technology**: In-memory cache (Redis) + operational data store
- **Latency**: Sub-second query response
- **Retention**: 30 days
- **Purpose**: Real-time dashboards, alerting, operational queries
- **Cost Profile**: High cost per GB, used for frequently accessed data

### Warm Storage (Analytical)

- **Data**: 30 days to 24 months
- **Technology**: Columnar data warehouse (e.g. BigQuery, Snowflake, Redshift)
- **Latency**: Sub-second to few seconds
- **Retention**: 24 months
- **Purpose**: Analytics queries, dashboards, reporting
- **Cost Profile**: Medium cost per GB, optimized for analytical queries

### Cold Storage (Archival)

- **Data**: Beyond 24 months
- **Technology**: Object storage (S3, GCS) with compression
- **Latency**: Minutes to hours (batch retrieval)
- **Retention**: 7 years (statutory requirement for financial/educational data)
- **Purpose**: Long-term audits, legal holds, historical analysis
- **Cost Profile**: Minimal cost per GB, infrequently accessed

---

## 31.2 Processing Layers

The platform shall support multiple processing patterns:

### Stream Processing (Real-time)

- **Technology**: Kafka/Kinesis → Stream processor (Flink/Spark Streaming)
- **Latency**: <5 second end-to-end
- **Purpose**: Real-time aggregations, alerting, immediate dashboards
- **Example**: Streak updates, inactivity alerts, live metrics

### Batch Processing (Daily)

- **Technology**: Scheduled jobs (Airflow, Cloud Composer)
- **Frequency**: Daily at 00:00 UTC
- **Purpose**: Historical aggregations, fact table updates, warehouse loads
- **Example**: Daily cohort reports, monthly MRR computation

### ML Feature Pipelines

- **Technology**: Feature store (e.g. Tecton, Feast) or custom
- **Frequency**: Daily refresh
- **Purpose**: Model training, prediction serving
- **Example**: Student mastery features, churn risk features, engagement scores

---

## 31.3 Data Models

The warehouse shall maintain multiple data model layers:

### Event Tables (Raw)

- **events** (all events in order)
- **event_schema**: Metadata about event types
- Immutable append-only structure
- No aggregation, all raw data retained

### Aggregated Fact Tables (Analytical)

- **daily_student_engagement**: Aggregated per-student per-day metrics
- **daily_ai_generation_metrics**: Token costs, latency, success rates per day
- **daily_payment_metrics**: Revenue, subscriptions, churn per day
- **daily_learning_progress**: Mastery scores, completion rates per day
- Updated daily in batch

### Dimensional Models

- **dim_student**: Student attributes (grade, board, geography)
- **dim_parent**: Parent attributes, subscription status
- **dim_content**: Chapter, concept, assessment metadata
- **dim_time**: Date, week, month, academic year
- Slowly changing dimension support for historical accuracy

### Student Learning Timeline

- **student_learning_journey**: Chronological unified timeline per student
- Fields: student_id, timestamp, event_type, content_id, mastery_score, engagement_score
- Enables quick retrieval of "what happened when" for any student
- Updated real-time from event stream

---

## 31.4 Retention Policies

Data retention shall balance legal requirements, analytical value, and storage cost:

| Data Type | Retention | Reason | Compliance |
|-----------|-----------|--------|-----------|
| Raw events (general) | 24 months | Historical analysis | GDPR right to erasure |
| AI conversations | 90 days | Quality monitoring, short-term improvement | GDPR sensitive data |
| Voice recordings | 30 days | Safety review window, then delete | COPPA audio restriction |
| Aggregated metrics | 7 years | Long-term trend analysis | Statutory |
| Payment records | 7 years | Tax/audit requirements | Income tax, GST |
| Student identification data | Until deletion request | Student identity required | COPPA parental rights |
| Consent records | Until withdrawal | Legal compliance | GDPR consent tracking |
| AI generation metadata (not content) | 24 months | Cost/quality analysis | GDPR data minimization |
| Predictive scores (churn/risk) | 90 days | Model relevance window | GDPR automated decisions |
| Support tickets | 3 years | Dispute resolution | Consumer protection |

---

# 32. AI Safety & Educational Accuracy Requirements

The analytics system shall continuously monitor AI-generated content for safety, accuracy, and educational alignment.

---

## 32.1 Hallucination Monitoring

The system shall detect and report instances where AI generates false, unsupported, or contradictory information.

Track:

- **Reported Hallucinations**: Student-reported incorrect explanations or answers
- **Factual Disputes**: Cases where AI contradicts authoritative sources (NCERT, board syllabus)
- **Unsupported Claims**: Statements with high confidence but no supporting evidence
- **Consistency Violations**: Explanations that contradict previous explanations to same student

Metrics:

```text
hallucination_rate = reported_hallucinations / total_explanations
factual_dispute_rate = factual_disputes / explanations
self_contradiction_frequency = contradictions_detected / total_explanations
```

Thresholds and Alerts:

- hallucination_rate > 0.5% → daily review
- hallucination_rate > 1% → immediate model review
- 3 hallucinations from same prompt → prompt retirement

---

## 32.2 Unsafe Content Monitoring

The system shall detect content that violates safety guidelines.

Track:

- **Harmful Recommendations**: Advice that could cause harm to student
- **Unsafe Content**: Violence, abuse, illegal guidance
- **Age-Inappropriate Content**: Material not suitable for student grade level
- **Bias and Discrimination**: Content that perpetuates stereotypes or biases
- **Emotional Harm**: Responses that could cause psychological distress

Metrics:

```text
unsafe_response_rate = unsafe_responses / total_responses
age_inappropriate_rate = inappropriate_responses / total_responses
bias_incident_rate = biased_responses / total_responses
```

---

## 32.3 Curriculum Alignment Monitoring

The system shall track how well AI-generated content aligns with official curriculum.

Track:

- **NCERT Alignment**: % of explanations aligned with NCERT textbooks
- **Board Syllabus Coverage**: % of topics covered per CBSE/ICSE syllabi
- **Exam Pattern Alignment**: % of exam-pattern questions correctly addressed
- **Misconception Avoidance**: Rate at which AI avoids teaching known misconceptions

Metrics:

```text
ncert_alignment_score = aligned_explanations / total_explanations
syllabus_coverage_completeness = covered_topics / syllabus_topics
exam_pattern_adherence = exam_aligned_responses / exam_questions
misconception_avoidance_rate = avoiding_misconceptions / misconceptions_known
```

---

## 32.4 Content Quality Scoring

Every AI-generated explanation shall be scored on multiple dimensions:

- **Factual Accuracy**: Is the explanation factually correct?
- **Clarity**: Is the explanation understandable to the target grade?
- **Completeness**: Does it address the question fully?
- **Pedagogical Value**: Does it help learning or just give answers?
- **Engagement**: Is the explanation engaging/memorable?

---

# 33. Content Intelligence Requirements

The system shall track content performance and effectiveness to continuously improve pedagogical quality.

---

## 33.1 Content Effectiveness Metrics

Track per piece of content:

- **Explanation Replay Rate**: % of students who replay explanation (indicates confusion)
- **Time Spent**: Average time spent on content (too short = skimming, too long = confusion)
- **Mastery Improvement**: % improvement in mastery score after content consumption
- **Concept Confusion Density**: How many confusion events per 1000 students exposed
- **Abandonment Rate**: % of students who abandon lesson before completing content
- **Follow-up Question Rate**: % of students who ask doubt/clarification after content

---

## 33.2 High-Performing Content Patterns

Identify patterns in high-effectiveness content:

- **Analogy Effectiveness**: Which analogies lead to better mastery?
- **Example Effectiveness**: Which example types improve understanding?
- **Explanation Structure**: Which explanation formats work best per concept?
- **Board-Specific Patterns**: What works best for CBSE vs ICSE?

---

## 33.3 Weak Content Identification

Identify content that underperforms:

- **Confusing Explanations**: Content with high replay/doubt rates
- **Low Mastery Improvement**: Content that doesn't improve scores
- **High Abandonment**: Content students skip or leave
- **Weak Examples**: Examples that don't clarify concept
- **Outdated References**: Content with references to old exam patterns

---

## 33.4 Board & Curriculum Alignment

Track content quality against Indian educational standards:

- **NCERT Alignment Score**: How closely does explanation align with NCERT textbook?
- **Board Syllabus Accuracy**: Does content cover syllabus topics correctly?
- **Exam Pattern Alignment**: Are explained concepts in exam patterns?
- **Regional Variations**: Does content account for state-specific boards?
- **Language Appropriateness**: Is vocabulary appropriate for grade level?

---

# 34. Child Safety & Consent Governance

The system shall implement strict safeguards for minor data protection and parental consent.

---

## 34.1 Parent Consent Management

The system shall track complete consent lifecycle:

- **Consent Version**: Which version of consent policy was agreed to
- **Consent Timestamp**: Exact date/time of consent
- **Consent Scope**: What data/features were authorized (e.g. voice, video, AI training)
- **Withdrawal Status**: Whether parent has withdrawn consent
- **Guardian Verification**: Identity verification of legal guardian
- **Update History**: Audit trail of all consent changes

Consent attributes:

```json
{
  "parent_id": "",
  "consent_version": "v2.1",
  "timestamp": "2026-05-09T10:30:00Z",
  "consented_to": [
    "educational_ai",
    "voice_input",
    "progress_reporting"
  ],
  "not_consented_to": [
    "third_party_sharing",
    "ai_training_data"
  ],
  "withdrawal_date": null,
  "guardian_verified": true,
  "ip_address": "202.x.x.x"
}
```

---

## 34.2 Minor Data Restrictions

The system shall explicitly prohibit certain practices with minor data:

**Explicitly Prohibited**:

- ❌ Advertising profiling based on learning data
- ❌ Third-party data resale
- ❌ Non-educational behavioral tracking
- ❌ Data mining for commercial purposes
- ❌ Cross-product profiling (e.g., Vidya learning + social media)
- ❌ Predictive targeting based on sensitive attributes

**Permitted Only With Explicit Consent**:

- ✅ Parent communication (progress reports)
- ✅ Educational improvement (pedagogical analysis)
- ✅ Student safety monitoring (distress detection)
- ✅ Exam readiness assessment

---

## 34.3 Voice Data Governance

Voice data requires special protection due to COPPA and privacy sensitivity.

Requirements:

- **Explicit Opt-In**: Voice recording disabled by default; parents must affirmatively enable
- **Recording Disclosure**: Student must be notified when recording begins
- **Retention Limits**: Voice recordings retained maximum 30 days
- **Deletion Rights**: Parents can request immediate deletion of voice recordings
- **Encryption**: All voice data encrypted in transit and at rest
- **Training Restrictions**: Voice data explicitly NOT used for model training
- **Transcription Limits**: Transcripts retained 90 days; audio deleted at 30 days
- **Audit Trail**: All voice data access logged

---

## 34.4 AI Conversation Privacy

The system shall implement boundaries on parental access to student-AI conversations.

**Parents Automatically Cannot Access**:

- ❌ Emotional disclosures ("I'm sad about exams")
- ❌ Personal struggles or vulnerabilities
- ❌ Sensitive health information
- ❌ Social relationship discussions
- ❌ Self-harm or concerning ideation (reported separately to appropriate channel)

**Parents Can Access**:

- ✅ Academic progress summaries
- ✅ Mastery scores and weak concepts
- ✅ Study patterns and engagement
- ✅ Exam readiness assessments
- ✅ Pedagogical recommendations

**Policy**: Sensitive conversations are summarized to learning insights, not raw transcripts.

---

# 35. Identity & Session Resolution Requirements

The system shall maintain accurate identity graphs to enable correct attribution and prevent duplicate records.

---

## 35.1 Parent Identity Graph

The system shall maintain unified parent identity across devices and platforms:

- **Parent ID**: Canonical identifier
- **Phone Numbers**: All known phone numbers with verification status
- **Email Addresses**: All known emails
- **Device IDs**: All devices accessed from
- **Session History**: All sessions across devices
- **Linked Accounts**: Any linked parent accounts
- **Merger History**: If accounts were merged, record source accounts

Enables:

- Correct parent reporting across multiple devices
- Prevention of duplicate parent accounts
- Accurate parent engagement metrics
- Parent session continuity

---

## 35.2 Student Identity Graph

The system shall maintain unified student identity:

- **Student ID**: Canonical identifier
- **Parent Link**: Which parent manages this student
- **Device IDs**: All devices student uses
- **Session History**: Complete session timeline
- **Grade/Board**: Immutable after first selection
- **Linked Identities**: Anonymous → authenticated merge
- **Merger History**: If student accounts merged

---

## 35.3 Multi-Device Linking

The system shall correctly attribute activity across devices:

- **Device ID Tracking**: Every app install gets device ID
- **Login Linking**: Login event establishes student-device mapping
- **Offline Sync**: Offline session merge when syncing
- **Device Switching**: Session continues across devices for same user
- **Shared Device Handling**: Multiple students on one device correctly separated
- **Device Upgrade**: Old device → new device transition tracked

---

## 35.4 Anonymous → Authenticated Merge

Students often start as anonymous, then create accounts:

- **Anonymous Session ID**: Pre-login activity tracked under temporary ID
- **Merge on Auth**: When student logs in, merge anonymous activity to authenticated ID
- **Merge Timestamp**: Record when merge occurred
- **Activity Continuity**: No loss of activity history
- **Event Reattribution**: All events re-attributed to correct student ID

Example:

```
Anonymous session: anon_xyz (30 mins activity)
→ Student signs up as student_123
→ System merges: all anon_xyz events now attributed to student_123
→ Continuous timeline from anonymous through authenticated
```

---

## 35.5 Session Stitching

The system shall maintain continuous user sessions across interruptions:

- **Session ID**: Unique identifier for learning session
- **Session Start/End**: Clear boundaries
- **Interruptions**: Network failures don't break session
- **Resume**: Student resumes previous session if within 4 hours
- **Session Metrics**: Time on session, concepts covered, progress made
- **Off-Session Events**: Events outside defined sessions attributed correctly

---

# 36. Curriculum Intelligence Requirements

The system shall build a comprehensive curriculum knowledge graph that becomes a long-term competitive asset.

---

## 36.1 Curriculum Graph Structure

The system shall model relationships between educational entities:

```
Subject
  ├─ Chapter
  │   ├─ Topic
  │   │   ├─ Concept
  │   │   │   ├─ Prerequisites (other concepts)
  │   │   │   ├─ Assessment Questions
  │   │   │   ├─ Examples
  │   │   │   └─ Common Misconceptions
  │   │   └─ Remediation Paths
  │   └─ Exam Pattern
  └─ Learning Outcomes
```

---

## 36.2 Prerequisite & Dependency Mapping

Track concept dependencies:

- **Hard Prerequisites**: Concepts that MUST be understood first
- **Soft Prerequisites**: Concepts that should be understood first
- **Concept Chains**: Sequences of dependent concepts
- **Gap Detection**: Missing prerequisite chains
- **Difficulty Estimation**: Based on prerequisite complexity

Example (Math):

```
Algebra Concepts
Linear Equations → Quadratic Equations → Polynomial Equations
       ↓
  (prerequisite)
       ↓
  Factorization
       ↓
  Number Systems
```

---

## 36.3 Assessment-Concept Mapping

Maintain relationship between assessments and concepts:

- **Question → Concept**: Which concepts does each question test?
- **Question → Cognitive Level**: Recall/Understanding/Application/Analysis
- **Assessment → Concept Coverage**: Which concepts covered by exam?
- **Difficulty → Concept**: Question difficulty vs concept mastery
- **Exam Pattern Alignment**: Are questions aligned with exam patterns?

---

## 36.4 Remediation Path Intelligence

The system shall recommend remediation sequences:

- **Weak Concept Detection**: Identify concepts below mastery threshold
- **Root Cause Analysis**: Identify prerequisite gaps causing weak concept
- **Remediation Sequence**: Optimal order to re-learn prerequisites
- **Targeted Practice**: Practice questions for gaps
- **Re-assessment**: Validate gap closure

---

## 36.5 Long-term Strategic Value

This curriculum graph enables:

- **Adaptive Sequencing**: Optimal learning sequence per student
- **Smart Retry Logic**: Intelligent concept presentation order
- **Prerequisite Gap Prevention**: Catch weak foundations early
- **Exam Readiness**: Validate all exam concepts mastered
- **Weak Concept Ranking**: Identify systemically hard concepts
- **Board Comparison**: Compare CBSE vs ICSE coverage
- **Teacher Insights**: Identify commonly weak topics

---

# 37. Intervention Intelligence Requirements

The system shall transform analytics into actionable interventions that improve learning outcomes.

---

## 37.1 Intervention Triggers

The system shall define clear conditions that trigger interventions:

### Inactivity Intervention

```
Trigger:
  - No activity for 5 consecutive days
  - AND student has active subscription
  - AND exam within 60 days
  
Action:
  - Send parent alert: "Student hasn't studied in 5 days"
  - Suggest revision topics
  - Offer personalized learning plan
```

### Weak Concept Intervention

```
Trigger:
  - Concept mastery < 40%
  - AND concept is prerequisite for upcoming topics
  - AND no activity on concept in 7 days
  
Action:
  - Recommend review content
  - Suggest practice questions
  - Alert parent: "Weak foundation detected"
```

### Confusion Loop Intervention

```
Trigger:
  - Student asked same doubt 3+ times
  - OR requested explanation >5 times
  - OR abandoned after explanation 2+ times
  
Action:
  - Escalate to human tutor
  - Flag for content review
  - Alert: "Student confused on [concept]"
```

### Burnout Risk Intervention

```
Trigger:
  - Study streak > 14 consecutive days
  - OR daily study hours > 3
  - OR frustration_score > 0.7
  
Action:
  - Suggest break
  - Recommend lighter session
  - Parent alert: "Student may be overworking"
```

---

## 37.2 Escalation Policies

Define when human intervention is required:

| Situation | Escalation Level | Action |
|-----------|-----------------|--------|
| Repeated confusion on concept | Tutor | Escalate to human tutor |
| Distress signal detected | Parent + Support | Notify parent, support review |
| Exam in 7 days, <50% mastery | Parent | Alert parent to intensive prep |
| Technical issue blocking learning | Support | Auto-ticket to support |
| Potential churn risk | Parent + Ops | Parent engagement campaign |

---

## 37.3 Notification Throttling

The system shall prevent notification fatigue:

- **Max Notifications**: 1 per day per parent
- **Do Not Disturb**: Quiet hours 9 PM - 8 AM
- **Frequency Capping**: Don't repeat same intervention within 48 hours
- **User Preference**: Allow parent to configure alert sensitivity

---

## 37.4 Parent Escalation Rules

Define when to escalate to parents:

- **Positive**: Streak achievements, milestones reached
- **Alert**: Inactivity, weak concepts, exam readiness concerns
- **Critical**: Distress signals, repeated failures, churn risk

---

## 37.5 Human Review Interventions

Certain situations require human judgment:

- **Predictive Model Overrides**: Support can override "churn risk" predictions
- **Academic Escalations**: Complex tutoring needed beyond AI
- **False Risk Scores**: Support can clear false positive alerts
- **Exception Cases**: Unusual situations requiring human discretion

---

# 38. Data Quality & Reliability Requirements

The system shall continuously monitor data integrity and alert to degradation.

---

## 38.1 Event Quality Monitoring

Track event ingestion health:

- **Event Loss Rate**: % of events lost in pipeline
- **Duplicate Rate**: % of duplicate events detected
- **Delayed Events**: Events arriving >1 hour late
- **Schema Violations**: Events missing required fields
- **Null Field Rate**: % of unexpected nulls in fields

Metrics:

```text
event_loss_rate = (expected_events - received_events) / expected_events
duplicate_rate = duplicate_events / total_events
delay_rate = delayed_events / total_events
schema_violation_rate = invalid_events / total_events
```

Thresholds:

- event_loss_rate > 0.1% → immediate alert
- duplicate_rate > 0.5% → investigate pipeline
- delay_rate > 5% → check backend load

---

## 38.2 Pipeline Health Monitoring

Track data processing pipeline reliability:

- **Pipeline Success Rate**: % of jobs that complete successfully
- **Average Latency**: How long from event ingestion to warehouse
- **Failed Job Rate**: % of scheduled jobs that fail
- **Retry Rate**: How many retries before job succeeds
- **SLA Violation Rate**: % of data missing SLA

---

## 38.3 Dashboard Freshness

Track how current dashboard data is:

- **Dashboard Lag**: Delay from event to dashboard appearance
- **Stale Metrics**: Metrics not updated in >2 hours
- **Inconsistent Metrics**: Different dashboards showing different values
- **Missing Data**: Gaps in time-series data

Requirements:

- Operational dashboards: <5 minute refresh
- Executive dashboards: <1 hour refresh
- Analytics dashboards: <4 hour refresh

---

## 38.4 Data Reconciliation

Periodic verification that data is correct:

- **Count Reconciliation**: Event counts match between systems
- **Revenue Reconciliation**: Total revenue in analytics = actual revenue
- **Metric Audit**: Spot-check metric calculations
- **Historic Verification**: Audit past data for correctness

---

## 38.5 Data Quality Alerts

Automated alerts for data issues:

```text
Alert: Event Loss
  Trigger: event_loss_rate > 0.1% for 10 min
  Action: Page on-call engineer

Alert: Dashboard Lag
  Trigger: dashboard_lag > 1 hour
  Action: Page data ops team

Alert: Revenue Mismatch
  Trigger: |analytics_revenue - actual_revenue| > 5%
  Action: Page finance + data team
```

---

# 39. AI Cost Governance Requirements

The system shall implement controls to prevent unbounded AI spending at scale.

---

## 39.1 Token Consumption Tracking

Track token burn at multiple dimensions:

- **Per Feature**: Notes generation, quiz generation, explanation, etc
- **Per Student**: Which students drive highest token spend?
- **Per Model**: OpenAI vs Claude, GPT-4 vs GPT-3.5, cost comparison
- **Per Prompt Version**: Different prompt versions have different costs
- **Per Regeneration**: How much token waste from user regenerations?

Metrics:

```text
tokens_per_feature = sum(tokens) group by feature
cost_per_feature = sum(cost) group by feature
cost_per_student = sum(cost) group by student_id
regeneration_cost_rate = cost(regenerations) / total_cost
```

---

## 39.2 Cost Per Learning Session

Calculate economic impact of each learning session:

```text
cost_per_session = AI_tokens_used × price_per_token × feature_discount
profitability = subscription_price - cost_per_session - platform_cost
```

Track:

- Which features are cost-negative (losing money per use)
- Which student segments have highest cost per session
- Whether AI cost trends toward unsustainability

---

## 39.3 Regeneration Abuse Detection

Detect and limit excess regeneration:

- **Per-Student Regeneration Rate**: How often does student request regeneration?
- **High-Cost Regenerations**: Regenerations of expensive operations
- **Duplicate Regenerations**: Same content regenerated multiple times
- **Abandoned After Regeneration**: User regenerated then left (wasted cost)

Trigger regeneration limits:

```
If student requests 5+ regenerations/day:
  - Warn student: "Regenerations limited to 5/day"
  - Show cached option first
  - Escalate for abuse pattern
```

---

## 39.4 Expensive Prompt Pattern Detection

Identify prompts that consume excessive tokens:

- **High Token Prompts**: Prompts generating 1000+ tokens
- **Low Completion Rate**: Prompts that take long to complete
- **High Cost Per Concept**: Explaining some concepts expensive
- **Prompt Bloat**: Prompts growing over time with instructions

Action:

```
If prompt_avg_tokens > 800:
  - Review prompt efficiency
  - Test prompt optimization
  - Calculate cost vs quality tradeoff
```

---

## 39.5 Semantic Caching

Leverage cache to reduce AI cost:

- **Cache Hit Rate**: % of requests served from cache without AI call
- **Cache Miss Rate**: % of requests requiring AI generation
- **Potential Savings**: Revenue opportunity from better caching

Target:

- Cache hit rate > 40% for common explanations
- Avoid regenerating same content for different students
- Serve cached explanations from similar questions

---

## 39.6 Daily Token Budgets

Implement hard budgets to prevent runaway costs:

```
Daily Token Budget: 500M tokens

Allocation:
  - Notes: 30% (150M)
  - Explanations: 40% (200M)
  - Quizzes: 20% (100M)
  - Other: 10% (50M)

When approaching budget:
  - Apply degradation strategy
  - Reduce regeneration allowance
  - Serve cached content
  - Alert team to potential issue
```

---

## 39.7 Generation Quotas

Limit generations per student to control costs:

```
Premium Tier: 50 generations/day
Standard Tier: 20 generations/day
Free Tier: 5 generations/day

Includes: notes, quizzes, explanations
Excludes: assessments, tutor doubts
```

---

# 40. Analytics Priority Classification

The system shall classify analytics needs to prevent overload and ensure focus on critical metrics.

---

## 40.1 Priority Tiers

All analytics shall be classified into four priority tiers:

### P0 — Critical Production Metrics

Essential for business continuity and immediate decision-making.

Characteristics:
- Used by executives daily
- Drive immediate actions
- Material business impact
- Monitored continuously

Examples:
- DAU, MAU, subscription count
- Revenue (MRR, ARR)
- Conversion rates (signup, payment)
- System uptime and availability
- Student engagement (active days/week)
- AI generation success rate

SLA: < 5 minute latency, 99.9% availability

### P1 — Important Operational Metrics

Critical for operational management and weekly decision-making.

Characteristics:
- Used by operational leads
- Drive weekly planning
- Important but not critical
- Monitored daily

Examples:
- Feature adoption rates
- Mastery progression trends
- Cohort retention metrics
- AI cost per feature
- Churn risk predictions
- Support ticket resolution time

SLA: < 1 hour latency, 99% availability

### P2 — Optimization Metrics

Useful for iterative improvement and A/B testing.

Characteristics:
- Used for optimization projects
- Drive experimental decisions
- Important for learning
- Monitored weekly

Examples:
- UI element engagement
- Content effectiveness scores
- Recommendation effectiveness
- Email open rates
- Feature discovery rates

SLA: < 4 hour latency, 95% availability

### P3 — Research & Experimental Metrics

Exploratory analytics for research and future products.

Characteristics:
- Used for research projects
- Not business-critical
- Can be slow and approximate
- Monitored ad-hoc

Examples:
- Learning curve analysis
- Prototype effectiveness
- Experimental pedagogy outcomes
- Emerging pattern detection

SLA: No strict latency requirement, best effort

---

## 40.2 Event Priority Classification

Events shall be classified by their priority:

| Event | Priority | Reasoning |
|-------|----------|-----------|
| signup_completed | P0 | Funnel critical |
| lesson_started | P0 | Learning signal |
| ai.generation.completed | P0 | Revenue critical |
| payment_successful | P0 | Revenue metric |
| doubt_asked | P0 | Product core |
| login_success | P1 | Operational tracking |
| ui_element_clicked | P2 | Optimization |
| page_viewed | P2 | Navigation analysis |
| ab_test_exposed | P1 | Experimentation |

---

## 40.3 Dashboard Priority

Executive dashboards shall prioritize P0 metrics:

**CEO Dashboard** (P0 metrics only):
- Revenue (MRR, ARR, ARPU)
- Retention (D1, D7, D30)
- Churn risk
- Engagement (DAU, WAU)
- Subscription growth

**Operations Dashboard** (P0 + P1 metrics):
- Feature adoption
- Mastery trends
- AI costs
- Cohort retention
- Support metrics

**Analytics Dashboard** (All priorities):
- Exploratory queries
- Research metrics
- Ad-hoc analysis

---

## 40.4 Engineering Load Prevention

Prevents analytics from causing engineering overload:

- **Event Spam Prevention**: Not every action is an event
- **P3 Metrics**: Don't implement until clear value shown
- **Dashboard Consolidation**: Consolidate related metrics rather than creating new dashboards
- **Metric Reuse**: Reuse existing metrics rather than creating similar ones
- **Quarterly Review**: Remove unused metrics annually

---

# 41. Analytics Access Control Requirements

The system shall implement role-based access control to protect sensitive data and ensure appropriate visibility.

---

## 41.1 Role-Based Dashboard Access

Define dashboard visibility by role:

### Student Role

**Can See**:
- Own learning progress
- Mastery scores
- Study patterns
- Exam readiness
- Personalized recommendations

**Cannot See**:
- Parent details
- Subscription/payment info
- Teacher analytics
- Comparative rankings (privacy-first)

### Parent Role

**Can See**:
- Child's academic progress
- Mastery and weak concepts
- Study time and consistency
- Exam readiness assessment
- Learning recommendations
- Engagement trends
- Weekly digest

**Cannot See**:
- Payment details (only summary)
- Other students' data
- AI conversation details (summarized only)
- Support tickets from other parents
- Full conversation transcripts

### Teacher Role (if adopted)

**Can See**:
- Cohort mastery patterns
- Weak concept aggregates
- Engagement trends
- Study patterns

**Cannot See**:
- Individual payment data
- Student personal data
- Sensitive conversations
- Parental consent details

### Support Role

**Can See**:
- Ticket-related analytics
- Support resolution times
- Common issues
- Student technical issues
- Refund patterns

**Cannot See**:
- Parent payment methods
- Student personal data beyond ticket context
- AI conversation details
- Parental consent records

### Admin Role

**Can See**:
- All analytics
- System performance
- Data quality metrics
- Access logs
- Configuration

---

## 41.2 Sensitive Metrics Access

Certain metrics restricted to specific roles:

| Metric | Access | Restriction |
|--------|--------|-------------|
| MRR, ARR | CEO, Finance | Financial confidentiality |
| Payment amounts | Finance only | PCI compliance |
| Student test scores vs national percentile | Parents, not public | Privacy |
| Distress signals | Support, not parents | Student privacy |
| AI conversation transcripts | Admins only | Student privacy |
| Voice recordings | Secure audit trail | COPPA compliance |

---

## 41.3 Sensitive Data Visibility

Explicit restrictions on sensitive data:

**PII Protection**:
- Names, phone numbers, email: Encrypted, logged access
- Student ID: Pseudonymized in reports
- Parent ID: Hidden from analytics exports

**Educational Data**:
- Actual test answers: Logged, restricted access
- Student conversations: Only administrators
- Emotional disclosures: No automatic parent access

**Financial Data**:
- Payment amounts: Finance only
- Subscription details: Parent can see own, not others
- Revenue reports: Executive only

---

## 41.4 Parent-Safe Reporting

Dashboards for parents exclude sensitive information:

**Include**:
- ✅ Mastery scores
- ✅ Weak concepts
- ✅ Study time and consistency
- ✅ Exam readiness
- ✅ Progress trends

**Exclude**:
- ❌ Emotional data or distress signals
- ❌ Comparative rankings
- ❌ AI conversation transcripts
- ❌ Sensitive academic struggles
- ❌ Biometric data

---

## 41.5 AI Ops Visibility

AI operations team access:

**Can See**:
- Token costs and burn
- Generation latency
- Model failure rates
- Cache hit rates
- Expensive prompts
- Regeneration patterns
- Cost by feature
- Cost by student (aggregated)

**Cannot See**:
- Individual student conversations
- Payment data
- Student names/personal info
- Parent data

---

## 41.6 Access Logging

All analytics access logged for audit:

- Who accessed what dashboard
- When access occurred
- What data was exported
- Whether sensitive metrics were viewed
- IP address and device

Retention: 2 years for audit trails

---

# 42. Experimentation Governance Requirements

The system shall support rigorous A/B testing with statistical validation and rollback capabilities.

---

## 42.1 Experiment Lifecycle

All experiments follow a structured lifecycle:

### Proposal Phase

- **Hypothesis**: Clear hypothesis and expected outcome
- **Design**: Sample size, significance level, success criteria
- **Duration**: Planned experiment length (typically 2 weeks minimum)
- **Metrics**: Primary and secondary success metrics

### Execution Phase

- **Variant Assignment**: Students randomly assigned to control/treatment
- **Randomization**: Prevent bias through proper randomization
- **Logging**: Every student action tagged with experiment_id and variant
- **Monitoring**: Real-time metric tracking to detect issues

### Analysis Phase

- **Statistical Testing**: Significance testing (p < 0.05)
- **Effect Size**: Practical significance beyond statistical
- **Unintended Consequences**: Check for negative secondary metrics
- **Segment Analysis**: Does effect hold across segments?

### Decision Phase

- **Winner Selection**: Did treatment outperform control?
- **Rollout Criteria**: Graduated rollout vs full rollout
- **Rollback Plan**: How to quickly revert if issues emerge

---

## 42.2 Experiment Isolation

Prevent experiment contamination:

- **Device Isolation**: Same student on different devices = different variants?
  - Solution: Assign by user_id, not device_id
- **Carryover Effects**: Does treatment effect persist after experiment?
  - Solution: Washout period before next experiment
- **Multiple Testing**: Running too many experiments simultaneously?
  - Solution: Coordinate experiment schedule

---

## 42.3 Statistical Significance

Require proper statistical rigor:

- **Sample Size**: Sufficient for 80% power, 5% significance
- **Minimum Duration**: 2 weeks minimum (avoid day-of-week bias)
- **Minimum Effect Size**: Practical minimum (not just statistical)
- **P-value Threshold**: p < 0.05 for success declaration
- **Confidence Intervals**: Report 95% CI around effect estimate

Example:

```
Experiment: Gamified mastery display
Control: Current
Treatment: Stars + streaks

Results:
  Control: 2.3 hrs/day avg study
  Treatment: 2.5 hrs/day avg study
  Diff: +0.2 hrs/day (8.7% improvement)
  P-value: 0.032 (significant)
  95% CI: [0.05, 0.35] hrs/day
  
  Decision: Roll out to 50% of users
```

---

## 42.4 Rollback Criteria

When to immediately roll back experiment:

- **Safety Issue**: Any safety/moderation issue detected
- **Massive Negative Impact**: Primary metric down >10%
- **Data Quality Issue**: Logging errors, data corruption
- **Business Impact**: Subscription cancellations spike
- **User Complaints**: >100 support complaints about feature

Rollback process:

```
1. Alert on-call engineer
2. Pause new assignments to variant
3. Revert active users within 1 hour
4. Conduct root cause analysis
5. Document lesson learned
```

---

# 43. Offline & Low Connectivity Analytics Requirements

The system shall support students with intermittent connectivity, critical for India-scale deployment.

---

## 43.1 Offline Activity Tracking

Track activities that occur offline:

- **Offline Session Duration**: How long student studies offline
- **Content Downloaded**: Which content accessed without network
- **Offline Completions**: Lessons/quizzes completed offline
- **Offline AI Interactions**: Doubts asked offline (queued)
- **Sync Timestamp**: When activity synced to backend

---

## 43.2 Sync Failure Handling

Track sync issues when connectivity restored:

- **Sync Failures**: Events that failed to sync after multiple retries
- **Delayed Syncs**: Events taking >1 hour to sync
- **Partial Syncs**: Sync completed but missing events
- **Data Loss**: Events lost due to unrecoverable sync failure
- **Recovery Rate**: % of failed syncs eventually recovered

---

## 43.3 Delayed Event Upload

Graceful handling of events arriving late:

- **Upload Delay Distribution**: How long until events uploaded?
- **Event Reordering**: Events arriving out of order
- **Timestamp Accuracy**: Local time vs server time drift
- **Causality Maintenance**: Ensure cause happens before effect

---

## 43.4 Learning Completion Metrics

Track completion despite connectivity challenges:

- **Completion Rate Offline**: % of lessons completed without network
- **Completion Rate Low-Network**: Completion with poor connectivity
- **Retry Rate**: How many retries needed to complete?
- **Abandonment Due to Connectivity**: Sessions abandoned due to network

---

## 43.5 Network Quality Indicators

Track student connectivity environment:

- **Network Type**: WiFi vs mobile data vs mixed
- **Signal Strength**: Network signal quality
- **Bandwidth Available**: Download/upload speeds
- **Latency**: Network latency and jitter
- **Geographic Data**: Where students have poor connectivity

Use these to:

- Optimize content for low-bandwidth (reduce video, images)
- Proactive offline content download
- Cached responses when live would be too slow

---

# 44. Academic Outcome Tracking Requirements

The system shall track external academic outcomes to validate that AI tutoring drives school success.

---

## 44.1 School Exam Score Improvement

Track improvement in actual school exams:

- **Exam Scores**: Raw scores from school exams
- **Score Improvement**: Change from previous exam
- **Subject-Wise**: Improvements by subject
- **Percentile Movement**: Percentile rank changes
- **Grade Improvement**: Changes in letter grades

Correlate with:

- Mastery improvements on Vidya
- Study hours on platform
- Concept coverage
- Exam readiness scores

---

## 44.2 Board Readiness Assessment

Track readiness for board exams:

- **Syllabus Coverage**: % of exam syllabus covered in Vidya
- **Weak Concept Count**: Number of weak concepts before exam
- **Predicted Score**: ML model prediction of board exam score
- **Actual Score**: Actual board exam result
- **Prediction Accuracy**: How accurate are predictions?

---

## 44.3 Percentile Improvement

Track improvement in national/state rankings:

- **Percentile Rank**: Student's percentile in student cohort
- **Percentile Trend**: Movement up/down over time
- **Subject Percentiles**: Individual subject rankings
- **Comparison**: Improvement vs same-board students

---

## 44.4 Parent-Reported Outcomes

Capture qualitative parent feedback:

- **Survey**: "Has your child's grades improved?" (post-exam)
- **Confidence Change**: "How confident is your child?" (before/after)
- **Subject Improvement**: "Which subjects improved most?"
- **Time to Understanding**: "Does your child understand faster?"

---

## 44.5 Longitudinal Tracking

Track multi-year outcomes:

- **Grade Progression**: Mastery improvements across grades
- **Subject Progression**: Concept mastery across curriculum
- **Retention Over Time**: Does learning stick long-term?
- **Foundation Strength**: Do weak foundations in Grade 8 cause issues in Grade 10?

---

# 45. Human Review & Override System Requirements

The system shall implement human judgment layer for high-stakes decisions.

---

## 45.1 Predictive Intervention Overrides

Allow support team to override automated interventions:

- **Churn Risk Prediction**: Can override "high risk" flag if context suggests otherwise
- **Distress Detection**: Can suppress false-positive distress alerts
- **Weak Concept Intervention**: Can delay intervention if student context suggests otherwise (e.g., preparing for different exam)

Process:

```
1. Support review intervention trigger
2. Understand student context (messages, history)
3. Override if disagreement with prediction
4. Log reason for override
5. Track override accuracy (did prediction prove wrong?)
```

---

## 45.2 AI Moderation Overrides

For moderation/safety decisions:

- **Hallucination False Positives**: Content flagged but actually correct
- **Safety Overrides**: Content flagged as unsafe but educational
- **Curriculum Misalignment**: Content flagged as misaligned but valid
- **Bias Accusations**: Content flagged as biased but neutral

Require:

- Human review by trained moderator
- Documented reasoning
- Escalation if disagreement
- Content creator notification

---

## 45.3 Academic Escalations

Complex academic situations requiring human tutor:

- **Conceptual Breakthrough Needed**: Student needs human guidance
- **Unusual Learning Pattern**: Student learns differently
- **Prerequisite Complexity**: Understanding requires live teaching
- **Special Needs**: Student needs accommodation

---

## 45.4 False Risk Score Handling

When predictive models get it wrong:

- **Churn Prediction Error**: Predicted churn that doesn't happen
- **Burnout Prediction Error**: Predicted burnout that's actually healthy engagement
- **Exam Risk Error**: Predicted exam failure but student succeeds

Process:

```
1. Support identifies false positive
2. Documents evidence of error
3. Overrides prediction
4. Records for model retraining
5. Improves model for future
```

---

## 45.5 Support Escalation Workflows

Define escalation paths:

```
L1 Support (Automated) → Can override low-impact predictions

L2 Support (Human) → Can escalate complex cases

L3 (Tutor) → Can intervene for academic issues

Management → Can override high-impact business decisions
```

Example escalation:

```
Distress Signal Detected
  ↓ (requires verification)
L1 Review (AI confidence < 70%?)
  ↓
L2 Human Review (read messages, assess context)
  ↓
If confirmed: Escalate to parent + support
If false: Override, improve model
```

---

# ANALYTICS EXCELLENCE ROADMAP

The 16 additional sections transform the analytics system from **intelligence collection** to **intelligent operation**.

## Phase 1: Foundation (Months 1–2)
- Sections 30–32: Governance + Safety
- Establish metrics ownership and event naming
- Deploy hallucination monitoring

## Phase 2: Data Architecture (Months 2–3)
- Section 31: Warehouse + storage
- Implement retention policies
- Deploy data quality monitoring (Section 38)

## Phase 3: Safety & Privacy (Months 1–3)
- Sections 34–35: Consent + Identity
- Implement child safety controls
- Deploy identity resolution

## Phase 4: Operational Intelligence (Months 3–4)
- Sections 36–37: Curriculum graph + Interventions
- Build intervention engine
- Deploy trigger-based actions

## Phase 5: Cost & Control (Months 2–4)
- Sections 39–40: Cost governance + Priority classification
- Deploy token budgets
- Implement priority tiers

## Phase 6: Enterprise Readiness (Months 4–5)
- Sections 41–45: Access control + Experimentation + Outcomes
- Deploy RBAC
- Implement human review systems

---

The complete analytics system is now **enterprise-grade ready for implementation**.


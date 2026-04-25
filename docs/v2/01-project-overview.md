# Spinzy Academy — Project Overview

**Last updated: 2026-03-23**

---

## Product

**Spinzy Academy** is an AI-powered home tutoring platform for Indian K-12 students.
The AI tutor persona is **Vidya** — a female teacher character depicted in a green saree with spectacles.
The platform mascot is the **Spinzy owl**.

- **Domain:** https://spinzyacademy.com
- **Package name:** `ai-tutor-india` (v0.1.0)
- **Pricing:** ₹399/month freemium (free tier: 3 questions/day)
- **Target device:** Budget Android, 360px viewport, 4G, 2 GB RAM. Desktop is secondary.

---

## Mission and North Star Metric

**Mission:** Make high-quality tutoring affordable for every Indian student.

**North Star metric:** Weekly Active Learning Sessions > 5 per paid student.

Vidya never gives a direct answer to a practice problem. She asks guiding questions back. This is the core product differentiator — violating it once destroys student trust permanently.

---

## Current Scope

| Dimension    | Value                                       |
| ------------ | ------------------------------------------- |
| Boards       | CBSE, ICSE                                  |
| Grades       | 1–12 (taxonomy seeded); MVP = CBSE Grade 10 |
| MVP subjects | Mathematics, Science                        |
| Languages    | English (`en`), Hindi (`hi`)                |
| Rollout      | `ROLLOUT_PERCENTAGE=5` → 20 → 50 → 100      |

---

## Actor Map

| Actor                | Description                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Student**          | Primary user. Signs in via Google OAuth or email. Completes onboarding (board, grade, subjects), takes diagnostic, enters learning sessions.         |
| **Parent**           | Linked via `ParentStudent`. Receives weekly digest email. Views child progress on parent dashboard. Must verify under-18 students (DPDP compliance). |
| **Admin**            | Internal staff. Triggers content hydration, reviews flagged questions, manages workers, monitors costs.                                              |
| **AI Tutor (Vidya)** | LLM-backed tutor. Responds to student turns in `StructuredSession`. Never gives direct answers — guiding questions only.                             |

---

## Brand

| Element        | Value     |
| -------------- | --------- |
| Primary purple | `#534AB7` |
| Theme orange   | `#FF7A00` |
| Success green  | `#1D9E75` |
| Warning amber  | `#BA7517` |
| Danger red     | `#E24B4A` |
| Purple bg      | `#EEEDFE` |
| Green bg       | `#EAF3DE` |
| Amber bg       | `#FAEEDA` |
| Red bg         | `#FCEBEB` |

Copy rules (enforced everywhere):

- Never use: "broke", "missed", "failed", "lost" in streak or progress copy.
- Forward-looking tone: "Start a new streak today — your best is still ahead."
- Never show numeric score on knowledge map results — colour bands only.
- Never mention referral programme (feature does not exist).
- Parent-facing copy: plain language, no jargon, low digital literacy assumed.

---

## Rollout and Feature Flags

| Flag                        | Default      | Notes                                 |
| --------------------------- | ------------ | ------------------------------------- |
| `ROLLOUT_PERCENTAGE`        | `5`          | % of users who see V2 session engine  |
| `ENABLE_AI_TUTOR`           | `true` (VPS) | Master switch for Vidya               |
| `ENABLE_SESSION_ENGINE`     | `false`      | V2 session engine staged rollout      |
| `ENABLE_DISTRESS_DETECTION` | `false`      | Do not enable without on-call process |
| `NEXT_PUBLIC_CONSENT_LIVE`  | `false`      | Do not enable without lawyer approval |
| `LLM_MODE`                  | `real`       | `mock` for tests without OpenAI       |
| `LLM_SAFE_MODE`             | `true`       | Enables content safety filtering      |

---

## Key People

- **Manish Kumar** — founder, sole engineer. `manish.mcaipu@gmail.com`

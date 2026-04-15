# Data Breach Response Runbook

**Owner:** On-call engineer  
**Severity:** P0 — Immediate response required  
**Last updated:** 2026-04-13  
**F-ADM-040 AC-06**

---

## 1. Detection

A breach may be detected via:
- Automated secret scanning alert (GitHub `run_secret_scanning` or Cloudflare)
- Unusual DB query volume / data exfiltration patterns in logs
- Third-party security researcher report
- PII appearing in external locations (search engines, paste sites)
- Internal audit log anomaly (bulk reads from `AuditLog`, `User`, `DiagnosticSession`)

---

## 2. Immediate Response (first 30 minutes)

### 2.1 Assess and contain

1. **Do not panic. Preserve evidence first.**
2. Open an incident Slack channel: `#incident-breach-<date>` — invite Manish + on-call.
3. Determine scope: which table(s), how many rows, what fields (PII? payment? health?).
4. If breach is ongoing, **immediately rotate affected credentials**:
   - `DATABASE_URL`: rotate Neon password via Neon console → restart PM2.
   - `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`: revoke in provider dashboard.
   - `RAZORPAY_KEY_SECRET`: revoke in Razorpay dashboard.
   - `VAPID_PRIVATE_KEY`: rotate and redeploy push subscriptions.
5. If source is a compromised API route, disable it:
   ```bash
   # Add EMERGENCY_BLOCK=true to .env, then:
   pm2 restart all
   ```
6. If DB is actively being queried by an unknown session, terminate connections:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE usename != 'postgres' AND state != 'idle';
   ```

### 2.2 Preserve evidence

- Take a snapshot of relevant PM2 logs: `pm2 logs --lines 5000 > /tmp/incident-<date>.log`
- Export `AuditLog` rows from the breach window (do not delete).
- Screenshot or export any external evidence before it disappears.

---

## 3. Scope Assessment (first 2 hours)

Run these queries to assess what data may have been exposed.

```bash
# How many users affected?
bash scripts/db-exec.sh "SELECT COUNT(*) FROM \"User\" WHERE \"updatedAt\" BETWEEN '<breach_start>' AND '<breach_end>'"

# Were payment records accessed?
bash scripts/db-exec.sh "SELECT COUNT(*) FROM \"Payment\" WHERE \"createdAt\" BETWEEN '<breach_start>' AND '<breach_end>'"

# Were DiagnosticSessions or health indicators exposed?
bash scripts/db-exec.sh "SELECT COUNT(*) FROM \"DiagnosticSession\" WHERE \"startedAt\" BETWEEN '<breach_start>' AND '<breach_end>'"

# Check AuditLog for admin actions in breach window
bash scripts/db-exec.sh "SELECT action, COUNT(*) FROM \"AuditLog\" WHERE \"createdAt\" BETWEEN '<breach_start>' AND '<breach_end>' GROUP BY action"
```

Classify by data type:
| Category | Fields | DPDP obligation |
|---|---|---|
| Contact | `User.email`, `User.phone` | Mandatory notification |
| Identity | `User.name`, `User.dateOfBirth` | Mandatory notification |
| Financial | `Payment.amount`, `PaymentOrder` | Mandatory notification, RBI alert |
| Academic | `DiagnosticSession`, `StudentConceptState` | Notify if sensitive |
| Device | `PushSubscriptionRecord.endpoint` | Low severity |

---

## 4. Notification Obligations (India — DPDP Act 2023)

| Trigger | Timeline | Recipient |
|---|---|---|
| Personal data breach | As soon as reasonably practicable | Data Protection Board of India |
| Significant breach (payment, health, children) | Within 72 hours | Data Protection Board + affected users |

### 4.1 Notify affected users

1. Draft email: plain language, what happened, what data, what to do.
2. Do NOT send raw PII in the notification email body.
3. Use `sendMailSafe` with BCC to a compliance record address.
4. Offer: free credit monitoring if financial data was exposed.

### 4.2 Notify Data Protection Board

Contact: dpdpboard@meity.gov.in (provisional until Board is constituted).  
Include: incident description, scope, remediation steps, and timeline.

---

## 5. Remediation

After breach is contained:

1. **Rotate ALL secrets** even if only a subset were exposed (belt and braces).
2. Run the DPDP erasure flow for affected users who request deletion:
   - Trigger via `POST /api/admin/users/[id]/erasure` with `action=PURGE`.
3. Pseudonymise affected records where full erasure is not possible:
   - `POST /api/admin/users/[id]/erasure` with `action=PSEUDONYMISE`.
4. Patch the vulnerability that allowed the breach (code fix + deploy).
5. Add a regression test that would have caught this.
6. Write a post-mortem within 5 business days and share with Manish.

---

## 6. Post-Incident

- [ ] Patch deployed and verified in production
- [ ] All affected credentials rotated
- [ ] Affected users notified
- [ ] DPDP Board notified (if required)
- [ ] AuditLog evidence preserved for 2 years
- [ ] Post-mortem written and shared
- [ ] Security controls improved to prevent recurrence
- [ ] Incident channel archived

---

## 7. Key Contacts

| Role | Contact |
|---|---|
| Founder / data controller | Manish (internal Slack) |
| On-call engineer | See PagerDuty / PM2 monitor |
| Neon DB support | console.neon.tech |
| Razorpay support | dashboard.razorpay.com > Help |
| Cloudflare | dash.cloudflare.com > Support |

# Subscription Purchase Cycle: Route Responsibilities

## 1. `/api/billing/checkout`

**File:** `route.ts`

**Responsibility:**

- Initiates the payment process.
- Checks user authentication.
- Receives selected plan and billing cycle.
- Calculates the amount.
- Creates a Razorpay order.
- Returns order ID, amount, and user email to the frontend.

**Summary:**
Starts the payment by creating a Razorpay order for the selected subscription plan.

---

## 2. `/api/billing/verify`

**File:** `route.ts`

**Responsibility:**

- Verifies payment and activates subscription.
- Checks user authentication.
- Receives payment details and signature from Razorpay.
- Verifies payment authenticity using Razorpay secret.
- If valid:
  - Creates a new subscription record (plan, billing cycle, payment/order IDs, amount, dates, etc.).
  - Sends a payment success email to the user.
- Returns success or error.

**Summary:**
Finalizes the subscription purchase by verifying payment and activating the subscription in your database.

---

## 3. `/api/billing/status`

**File:** `route.ts`

**Responsibility:**

- Returns current user's subscription status.
- Checks authentication.
- Finds the latest active subscription for the user.
- Returns plan, billing cycle, status, and validity date.

**Summary:**
Checks the user's current subscription status (useful for UI and access control).

---

## Frontend (`/pricing` page)

- Calls `/api/billing/checkout` to start payment.
- Uses Razorpay modal for payment.
- On payment success, calls `/api/billing/verify` to activate subscription.

---

## Summary Table

| Route                   | Responsibility                                    |
| ----------------------- | ------------------------------------------------- |
| `/api/billing/checkout` | Initiate payment, create Razorpay order for plan  |
| `/api/billing/verify`   | Verify payment, activate subscription, send email |
| `/api/billing/status`   | Return current subscription status                |

---

**In short:**

- `/checkout` starts the payment for a subscription.
- `/verify` confirms payment and activates the subscription.
- `/status` checks the user's current subscription.

**This separation is optimal for security, maintainability, and clarity in your subscription purchase cycle.**

// components/SubscriptionModal.tsx
"use client";

import { useState } from "react";
import Button from "@/components/UI/Loader" /* replace with your button if different */;
import { signIn, useSession } from "next-auth/react";

/**
 * Subscription modal
 * - Choose plan, billing cycle (monthly/yearly)
 * - Calls /api/subscribe to create order
 * - Opens Razorpay checkout and confirms on success
 *
 * NOTE: This component assumes `window.Razorpay` is available (include Razorpay script in _document or page).
 */

export default function SubscriptionModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const [plan, setPlan] = useState<"pro" | "enterprise">("pro");
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    if (!session) {
      // encourage login first
      signIn(undefined, { callbackUrl: "/" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing }),
      });
      const data = await res.json();
      if (data.orderId) {
        // Open Razorpay checkout
        const options = {
          key: data.key,
          amount: data.amount,
          currency: data.currency,
          order_id: data.orderId,
          handler: async function (response: any) {
            // On success, confirm server-side
            await fetch("/api/subscribe/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan,
                billing,
              }),
            });
            onClose();
            window.location.href = "/profile";
          },
          prefill: {
            name: session.user?.name,
            email: session.user?.email,
          },
        };

        // @ts-ignore
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        alert("Unable to create order.");
      }
    } catch (err) {
      console.error("subscribe client error", err);
      alert("Subscription failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
      <div className="w-96 bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-3">Subscribe</h3>

        <div className="mb-3">
          <label className="block text-sm text-gray-600">Plan</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as any)}
            className="w-full border rounded p-2"
          >
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        <div className="mb-3">
          <label className="block text-sm text-gray-600">Billing</label>
          <div className="flex gap-2">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-3 py-1 rounded ${billing === "monthly" ? "bg-blue-600 text-white" : "border"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-3 py-1 rounded ${billing === "yearly" ? "bg-blue-600 text-white" : "border"}`}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 border rounded">
            Cancel
          </button>
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="px-3 py-1 bg-indigo-600 text-white rounded"
          >
            {loading ? "Processing..." : "Subscribe"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";
import React from "react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function BillingButton({
  provider,
}: {
  provider: "stripe" | "razorpay";
}) {
  async function subscribe() {
    if (provider === "stripe") {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan: "pro" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } else {
      const res = await fetch("/api/billing/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 499, currency: "INR" }),
      });
      const order = await res.json();

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount: order.amount,
        currency: order.currency,
        name: "AI Tutor",
        description: "Pro Subscription",
        order_id: order.id,
        handler: function (response: any) {
          alert("Payment successful: " + response.razorpay_payment_id);
        },
        prefill: { name: "User", email: "user@example.com" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    }
  }

  return (
    <button
      onClick={subscribe}
      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
    >
      Subscribe ({provider})
    </button>
  );
}

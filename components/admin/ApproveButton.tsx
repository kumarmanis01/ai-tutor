"use client";
import React from "react";

interface ApproveButtonProps {
  id: string;
  type: "chapter" | "topic" | "note" | "question";
  onApproved?: () => void;
}

export const ApproveButton: React.FC<ApproveButtonProps> = ({ id, type, onApproved }) => {
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  void error;

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/content/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      if (!res.ok) throw new Error("Approval failed");
      setSuccess(true);
      onApproved?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleApprove}
      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
      disabled={loading || success}
    >
      {loading ? "Approving..." : success ? "Approved" : "Approve"}
    </button>
  );
};

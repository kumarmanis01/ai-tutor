import React from "react";
import { ApproveButton } from "@/components/Admin/ApproveButton";

// Example: This would be replaced with real data fetching in production
const pendingItems = [
  { id: "1", type: "note", label: "Note: Algebra Basics" },
  { id: "2", type: "chapter", label: "Chapter: Geometry" },
  { id: "3", type: "topic", label: "Topic: Trigonometry" },
  { id: "4", type: "question", label: "Question: What is 2+2?" },
];

export default function AdminContentApprovalPage() {
  // In production, fetch pending items from API
  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Content Approval</h1>
      <div className="space-y-4">
        {pendingItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded shadow">
            <span>{item.label}</span>
            <ApproveButton id={item.id} type={item.type as any} />
          </div>
        ))}
      </div>
    </div>
  );
}

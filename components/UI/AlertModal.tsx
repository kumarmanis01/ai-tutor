"use client";
import React, { useEffect, useState } from "react";

type AlertDetail = {
  title?: string;
  message: string;
  variant?: "info" | "success" | "warning" | "error";
  confirmText?: string;
  onConfirm?: () => void;
};

const ALERT_EVENT = "app-alert";

export function emitAlert(detail: AlertDetail) {
  window.dispatchEvent(new CustomEvent(ALERT_EVENT, { detail }));
}

export default function AlertModal() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<AlertDetail | null>(null);

  useEffect(() => {
    function onAlert(e: Event) {
      const ce = e as CustomEvent<AlertDetail>;
      setDetail(ce.detail);
      setOpen(true);
    }
    window.addEventListener(ALERT_EVENT, onAlert as EventListener);
    return () => window.removeEventListener(ALERT_EVENT, onAlert as EventListener);
  }, []);

  if (!open || !detail) return null;

  const { title = "Alert", message, variant = "info", confirmText = "OK", onConfirm } = detail;

  const headerClass: Record<Required<AlertDetail>['variant'], string> = {
    info: "border-blue-500",
    success: "border-green-500",
    warning: "border-yellow-500",
    error: "border-red-500",
  } as const;

  const buttonClass: Record<Required<AlertDetail>['variant'], string> = {
    info: "bg-blue-600 hover:bg-blue-700",
    success: "bg-green-600 hover:bg-green-700",
    warning: "bg-yellow-600 hover:bg-yellow-700",
    error: "bg-red-600 hover:bg-red-700",
  } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className={`relative z-10 w-full max-w-md rounded-lg bg-white shadow-xl`}>
        <div className={`border-b-4 ${headerClass[variant]} p-4`}>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{message}</p>
        </div>
        <div className="flex justify-end gap-2 p-4">
          <button
            className="rounded-md bg-gray-200 px-4 py-2 hover:bg-gray-300"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
          <button
            className={`rounded-md px-4 py-2 text-white ${buttonClass[variant]}`}
            onClick={() => {
              setOpen(false);
              onConfirm?.();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

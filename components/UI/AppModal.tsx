"use client";
import { useEffect, useState } from 'react';

type ModalPayload = { title?: string; message?: string; actions?: Array<{ label: string; onClick?: () => void }> };

export default function AppModal() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<ModalPayload>({});

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ModalPayload>).detail || {};
      setPayload(detail);
      setOpen(true);
    };
    window.addEventListener('app:modal', handler as EventListener);
    return () => window.removeEventListener('app:modal', handler as EventListener);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">{payload.title || 'Alert'}</h2>
        <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{payload.message}</p>
        <div className="mt-4 flex justify-end gap-2">
          {(payload.actions || []).map((a, i) => (
            <button
              key={i}
              className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300"
              onClick={() => {
                a.onClick?.();
                setOpen(false);
              }}
            >
              {a.label}
            </button>
          ))}
          <button className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700" onClick={() => setOpen(false)}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
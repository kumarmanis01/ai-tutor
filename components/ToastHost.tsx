 'use client';

import React, { useEffect, useState } from 'react';

type ToastEventDetail = { message: string; duration?: number };

export default function ToastHost() {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string }>>([]);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastEventDetail>).detail;
      if (!detail || !detail.message) return;
      const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 9);
      setToasts((t) => [...t, { id, message: detail.message }]);
      const dur = detail.duration ?? 5000;
      window.setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, dur);
    }

    window.addEventListener('app:toast', onToast as EventListener);
    return () => window.removeEventListener('app:toast', onToast as EventListener);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="max-w-xs bg-card border border-border rounded px-3 py-2 shadow-lg">
          <div className="text-sm text-foreground">{t.message}</div>
        </div>
      ))}
    </div>
  );
}

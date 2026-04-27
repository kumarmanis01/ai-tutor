// components/Auth/LogoutButton.tsx
"use client";
import { signOut } from "next-auth/react";
import React, { useState } from "react";

export default function LogoutButton() {
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    try {
      await signOut({ redirect: false });
      if (typeof window !== 'undefined') {
        window.location.replace('/');
      }
    } catch {
      // swallow errors; user can retry
    } finally {
      setOpen(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700"
      >
        Logout
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-sm mx-auto">
            <div className="px-5 pt-5 pb-3 border-b">
              <h3 className="text-base font-semibold">Confirm logout</h3>
              <p className="text-sm text-muted-foreground">Are you sure you want to log out?</p>
            </div>
            <div className="px-5 py-3 flex justify-end gap-3">
              <button className="px-3 py-2 border rounded" onClick={() => setOpen(false)}>Cancel</button>
              <button className="px-3 py-2 bg-red-600 text-white rounded" onClick={handleConfirm}>Log out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

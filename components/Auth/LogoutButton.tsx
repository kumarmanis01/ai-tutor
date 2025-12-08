// components/Auth/LogoutButton.tsx
"use client";
import { signOut } from "next-auth/react";
import React from "react";

export default function LogoutButton() {
  return (
    <button
      onClick={async () => {
        const ok = typeof window !== 'undefined' ? window.confirm("Are you sure you want to log out?") : true;
        if (!ok) return;
        try {
          await signOut({ redirect: false });
          if (typeof window !== 'undefined') {
            window.location.replace('/');
          }
        } catch {
          // swallow errors; user can retry
        }
      }}
      className="px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700"
    >
      Logout
    </button>
  );
}

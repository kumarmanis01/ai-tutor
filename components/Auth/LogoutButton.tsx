// components/Auth/LogoutButton.tsx
"use client";
import { signOut } from "next-auth/react";
import React from "react";

export default function LogoutButton() {
  return (
    <button onClick={() => signOut()} className="px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700">
      Logout
    </button>
  );
}

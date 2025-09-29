// components/Auth/LoginButton.tsx
"use client";
import { signIn } from "next-auth/react";
import React from "react";

export default function LoginButton({
  label = "Login with Google",
}: {
  label?: string;
}) {
  return (
    <button
      onClick={() => signIn("google")}
      className="px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
    >
      {label}
    </button>
  );
}

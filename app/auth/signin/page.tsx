"use client"

import { signIn } from "next-auth/react"

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">Sign in</h1>

      <button
        onClick={() => signIn("google")}
        className="px-4 py-2 bg-red-500 text-white rounded mb-2"
      >
        Sign in with Google
      </button>

      <button
        onClick={() =>
          signIn("credentials", {
            email: "test@example.com",
            password: "password123",
          })
        }
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Sign in with Email
      </button>
    </div>
  )
}

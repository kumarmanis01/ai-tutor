"use client";

import { signIn } from "next-auth/react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export default function LoginModal({ isOpen, onClose, message }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>

        <h2 className="text-lg font-semibold mb-2">Sign in to continue</h2>
        {message && <p className="text-sm text-gray-600 mb-4">{message}</p>}

        <div className="space-y-3">
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Continue with Google
          </button>
          {/* <button
            onClick={() => signIn("facebook", { callbackUrl: "/" })}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Continue with Meta
          </button> */}
          {/* <button
            onClick={() => signIn("email", { callbackUrl: "/" })}
            className="w-full px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900"
          >
            Continue with Email
          </button> */}
        </div>
      </div>
    </div>
  );
}

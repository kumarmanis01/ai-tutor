'use client';
import { useState } from 'react';

export default function SetPasswordModal({
  email,
  onSubmit,
  onChangeEmail,
  onClose,
  isOpen,
}: {
  email: string;
  onSubmit: (password: string) => void;
  onChangeEmail: () => void;
  onClose: () => void;
  isOpen: boolean;
}) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  const validate = (pw: string) => {
    return pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate(password)) {
      setError('Password does not meet requirements.');
      return;
    }
    setError('');
    onSubmit(password);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-md p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl"
          aria-label="Close"
        >
          ×
        </button>
        {/* App logo */}
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-2xl">A</span>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-4 text-center text-gray-900 dark:text-yellow-200">
          Create your password
        </h2>
        <div className="mb-2 text-center text-gray-700 dark:text-yellow-100">
          {email}{' '}
          <button
            type="button"
            onClick={onChangeEmail}
            className="text-blue-600 dark:text-yellow-300 hover:underline text-sm"
          >
            Change
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              className="block w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-yellow-200"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-2 text-gray-500 dark:text-gray-400"
              tabIndex={-1}
            >
              {show ? '🙈' : '👁️'}
            </button>
          </div>
          <ul className="mb-4 text-gray-700 dark:text-yellow-100 text-sm">
            <li className="flex items-center gap-2">
              <span>✓</span> Must include 8 characters
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Must include at least 1 alphabet
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Must include a number
            </li>
            <li className="flex items-center gap-2">
              <span>✓</span> Must include a special character
            </li>
          </ul>
          <button
            type="submit"
            disabled={!validate(password)}
            className="w-full px-5 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 transition"
          >
            Create Password
          </button>
          {error && <div className="mt-4 text-red-600 dark:text-red-400 text-sm">{error}</div>}
        </form>
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onChangeEmail}
            className="text-blue-600 dark:text-yellow-300 hover:underline text-sm"
          >
            Use another method
          </button>
        </div>
      </div>
    </div>
  );
}

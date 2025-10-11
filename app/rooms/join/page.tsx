'use client';
import { useState } from 'react';

/**
 * RoomJoinPage component
 * - Allows users to join a room using an invite code.
 * - Handles dark/light mode consistency.
 * - Shows loading state and error feedback.
 */
export default function RoomJoinPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handles joining a room by invite code
  const handleJoin = async () => {
    setLoading(true);
    setError('');
    const res = await fetch('/api/rooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: code }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      window.location.href = `/rooms/${code}`;
    } else {
      setError('Invalid code or unable to join room');
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <h2 className="text-2xl font-bold mb-6 text-indigo-700 dark:text-yellow-300">Join a Room</h2>
      <input
        className="block w-full mb-4 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-yellow-200"
        placeholder="Enter Room Code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button
        onClick={handleJoin}
        disabled={loading || !code}
        className="w-full px-5 py-2 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700 transition"
      >
        {loading ? 'Joining...' : 'Join Room'}
      </button>
      {error && <div className="mt-4 text-red-600 dark:text-red-400 text-sm">{error}</div>}
    </div>
  );
}

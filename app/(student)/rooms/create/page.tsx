'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * CreateRoomPage component
 * - Allows admins to create a new study room by providing a name, subject, description, and privacy setting.
 * - On successful creation, redirects to the new room's page.
 * - Handles dark/light mode consistency.
 * - Includes a back button to return to the admin panel.
 */
export default function CreateRoomPage() {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [grade, setGrade] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Handles room creation by sending a POST request to the API
  const handleCreate = async () => {
    setLoading(true);
    setError('');
    const res = await fetch('/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, subject, description, isPrivate, grade }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.id) router.push(`/rooms/${data.id}`);
    else setError('Error creating room');
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      {/* Back button to admin panel */}
      {/* Use this in all admin child pages (e.g., create, moderate, etc.) */}
      <button
        onClick={() => router.push('/rooms?tab=admin')}
        className="mb-4 flex items-center text-indigo-600 dark:text-yellow-300 hover:underline"
      >
        ← Back to Admin Panel
      </button>
      <h2 className="text-2xl font-bold mb-6 text-indigo-700 dark:text-yellow-300">
        Create a Study Room
      </h2>
      <input
        className="block w-full mb-4 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-yellow-200"
        placeholder="Room Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="block w-full mb-4 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-yellow-200"
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <input
        className="block w-full mb-4 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-yellow-200"
        placeholder="Grade"
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
      />
      <textarea
        className="block w-full mb-4 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-yellow-200"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <label className="flex items-center mb-4">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          className="mr-2"
        />
        Private Room
      </label>
      <button
        onClick={handleCreate}
        disabled={loading || !name || !subject || !grade}
        className="w-full px-5 py-2 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700 transition"
      >
        {loading ? 'Creating...' : 'Create Room'}
      </button>
      {error && <div className="mt-4 text-red-600 dark:text-red-400 text-sm">{error}</div>}
    </div>
  );
}

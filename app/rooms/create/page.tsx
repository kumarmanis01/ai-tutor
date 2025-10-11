'use client';
import { useState } from 'react';

/**
 * CreateRoomPage component
 * Allows users to create a new study room by providing a name, subject, description, and privacy setting.
 * On successful creation, redirects to the new room's page.
 */
export default function CreateRoomPage() {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  // Handles room creation by sending a POST request to the API
  const handleCreate = async () => {
    const res = await fetch('/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, subject, description, isPrivate }),
    });
    const data = await res.json();
    if (data.id) window.location.href = `/rooms/${data.id}`;
    else alert('Error creating room');
  };

  return (
    <div>
      <h2>Create a Study Room</h2>
      <input placeholder="Room Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <label>
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        Private Room
      </label>
      <button onClick={handleCreate}>Create Room</button>
    </div>
  );
}

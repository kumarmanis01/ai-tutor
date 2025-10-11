'use client';
import { useState } from 'react';

export default function RoomJoinPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    setLoading(true);
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
      alert('Invalid code or unable to join room');
    }
  };

  return (
    <div>
      <h2>Join a Room</h2>
      <input placeholder="Enter Room Code" value={code} onChange={(e) => setCode(e.target.value)} />
      <button onClick={handleJoin} disabled={loading}>
        {loading ? 'Joining...' : 'Join Room'}
      </button>
    </div>
  );
}

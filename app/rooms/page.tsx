'use client';
import { useEffect, useState } from 'react';

/**
 * Type for a study room.
 */
type Room = {
  id: string;
  name: string;
  subject?: string | null;
};

/**
 * RoomsPage component
 * Displays a list of available public study rooms.
 * Fetches room data from /api/rooms/list on mount.
 */
export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    // Fetch the list of public rooms from the API
    fetch('/api/rooms/list')
      .then((res) => res.json())
      .then(setRooms);
  }, []);

  return (
    <div>
      <h2>Available Rooms</h2>
      <ul>
        {rooms.map((room) => (
          <li key={room.id}>
            <a href={`/rooms/${room.id}`}>
              {room.name} ({room.subject})
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

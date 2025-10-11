'use client';
import { useState, useEffect } from 'react';

/**
 * Types for Room, RoomMember, and Message.
 */
type RoomMember = {
  id: string;
  name?: string | null;
  userId?: string | null;
};

type Room = {
  id: string;
  name: string;
  subject?: string | null;
  grade?: string | null;
  members: RoomMember[];
};

type Message = {
  id: string;
  sender?: string | null;
  senderId?: string | null;
  content: string;
};

/**
 * RoomPage component
 * - Displays details and chat messages for a specific study room.
 * - Shows room member list and invite friends UI.
 * - Handles dark/light mode consistency.
 * - Allows users to send messages to the room.
 */
export default function RoomPage({ params }: { params: { roomId: string } }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);

  // Fetch room details and messages when roomId changes
  useEffect(() => {
    fetch(`/api/rooms/${params.roomId}`)
      .then((res) => res.json())
      .then((data) => {
        setRoom(data.room);
        setMessages(data.messages);
      });
  }, [params.roomId]);

  // Sends a message to the room and refreshes the message list
  const sendMessage = async () => {
    await fetch('/api/rooms/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: params.roomId, content: input }),
    });
    setInput('');
    fetch(`/api/rooms/${params.roomId}`)
      .then((res) => res.json())
      .then((data) => setMessages(data.messages));
  };

  // Copies invite link to clipboard
  const handleCopyInvite = () => {
    const inviteLink = `${window.location.origin}/rooms/join?code=${room?.id}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h2 className="text-2xl font-bold mb-4 text-indigo-700 dark:text-yellow-300">
        {room?.name} {room?.subject && <span>({room.subject})</span>}
        {room?.grade && (
          <span className="ml-2 text-base text-gray-500 dark:text-gray-400">
            Grade: {room.grade}
          </span>
        )}
      </h2>

      {/* Room Members List */}
      {room?.members && (
        <div className="mb-6 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow">
          <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
            Members
          </h3>
          <ul>
            {room.members.map((member) => (
              <li key={member.id} className="mb-1 text-gray-700 dark:text-yellow-100">
                {member.name || member.userId}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Invite Friends UI */}
      <div className="mb-6">
        <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
          Invite Friends
        </h3>
        <div className="flex gap-2 items-center">
          <input
            readOnly
            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/rooms/join?code=${room?.id}`}
            style={{ width: '80%' }}
            className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-yellow-200"
          />
          <button
            onClick={handleCopyInvite}
            className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
          >
            {copied ? 'Copied!' : 'Copy Invite Link'}
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="mb-6 bg-white dark:bg-gray-900 p-4 rounded-lg shadow">
        <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
          Group Chat
        </h3>
        <div className="mb-4 max-h-64 overflow-y-auto">
          {messages.map((msg) => (
            <div key={msg.id} className="mb-2">
              <b className="text-indigo-700 dark:text-yellow-300">{msg.sender ?? msg.senderId}</b>:{' '}
              <span className="text-gray-800 dark:text-yellow-100">{msg.content}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-yellow-200"
          />
          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700 transition"
            disabled={!input}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

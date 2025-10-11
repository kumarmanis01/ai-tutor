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
 * Displays details and chat messages for a specific study room.
 * Shows room member list and invite friends UI.
 * Allows users to send messages to the room.
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
    <div>
      <h2>
        {room?.name} ({room?.subject})
      </h2>

      {/* Room Members List */}
      {room?.members && (
        <div>
          <h3>Members:</h3>
          <ul>
            {room.members.map((member) => (
              <li key={member.id}>{member.name || member.userId}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Invite Friends UI */}
      <div>
        <h3>Invite Friends</h3>
        <input
          readOnly
          value={`${typeof window !== 'undefined' ? window.location.origin : ''}/rooms/join?code=${room?.id}`}
          style={{ width: '80%' }}
        />
        <button onClick={handleCopyInvite}>{copied ? 'Copied!' : 'Copy Invite Link'}</button>
      </div>

      {/* Chat Messages */}
      <div>
        {messages.map((msg) => (
          <div key={msg.id}>
            <b>{msg.sender ?? msg.senderId}</b>: {msg.content}
          </div>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a message..."
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

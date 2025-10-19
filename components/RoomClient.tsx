'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RoomMember, Message, Room } from '@/types/rooms';

type Props = { roomId: string };

// Dummy data for badges, achievements, and leaderboard
const BADGES = [
  { id: 1, name: 'Active Participant', icon: '🏅' },
  { id: 2, name: 'Top Scorer', icon: '🥇' },
  { id: 3, name: 'Helper', icon: '🤝' },
];

const ACHIEVEMENTS = [
  { id: 1, title: 'First Message', desc: 'Sent your first message!' },
  { id: 2, title: 'Invite Master', desc: 'Invited 5 friends.' },
];

export default function RoomClient({ roomId }: Props) {
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [leaderboard, setLeaderboard] = useState<RoomMember[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/rooms/${roomId}`)
      .then((res) => res.json())
      .then((data) => {
        setRoom(data.room);
        setMessages(data.messages || []);
        setLeaderboard(
          (data.room?.members || [])
            .slice()
            .sort((a: RoomMember, b: RoomMember) => (b.score ?? 0) - (a.score ?? 0)),
        );
      });
  }, [roomId]);

  const sendMessage = async () => {
    if (!input) return;
    await fetch('/api/rooms/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, content: input }),
    });
    setInput('');
    fetch(`/api/rooms/${roomId}`)
      .then((res) => res.json())
      .then((data) => setMessages(data.messages || []));
  };

  const handleCopyInvite = () => {
    const inviteLink = `${window.location.origin}/rooms/join?code=${room?.id}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = async () => {
    if (!inviteEmail || !room) return;
    setInviteStatus('sending');
    try {
      await fetch('/api/rooms/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          email: inviteEmail,
          inviteLink: `${window.location.origin}/rooms/join?code=${room.id}`,
        }),
      });
      setInviteStatus('sent');
      setInviteEmail('');
      setTimeout(() => setInviteStatus('idle'), 2000);
    } catch {
      setInviteStatus('error');
      setTimeout(() => setInviteStatus('idle'), 2000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 flex gap-8">
      {/* Center Chat Section */}
      <div className="flex-1 flex flex-col items-center">
        <button
          onClick={() => router.push('/rooms')}
          className="mb-6 self-start flex items-center text-indigo-600 dark:text-yellow-300 hover:underline"
        >
          ← Back to Rooms
        </button>
        <h2 className="text-2xl font-bold mb-4 text-indigo-700 dark:text-yellow-300 text-center">
          {room?.name} {room?.subject && <span>({room.subject})</span>}
          {room?.grade && (
            <span className="ml-2 text-base text-gray-500 dark:text-gray-400">
              Grade: {room.grade}
            </span>
          )}
        </h2>
        <div className="w-full max-w-xl mb-6 bg-white dark:bg-gray-900 p-4 rounded-lg shadow flex flex-col">
          <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
            Group Chat
          </h3>
          <div className="mb-4 max-h-64 overflow-y-auto">
            {messages.map((msg) => (
              <div key={msg.id} className="mb-2">
                <b className="text-indigo-700 dark:text-yellow-300">{msg.sender ?? msg.senderId}</b>
                : <span className="text-gray-800 dark:text-yellow-100">{msg.content}</span>
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
        {/* Badges & Achievements */}
        <div className="w-full max-w-xl mb-6 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg shadow flex flex-col">
          <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
            Badges
          </h3>
          <div className="flex gap-3 mb-4 flex-wrap">
            {BADGES.map((badge) => (
              <span
                key={badge.id}
                className="flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-gray-700 rounded text-indigo-700 dark:text-yellow-200 font-medium"
              >
                <span>{badge.icon}</span> {badge.name}
              </span>
            ))}
          </div>
          <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
            Achievements
          </h3>
          <ul>
            {ACHIEVEMENTS.map((ach) => (
              <li key={ach.id} className="mb-1 text-gray-700 dark:text-yellow-100">
                <b>{ach.title}</b>: {ach.desc}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/* Right Side Panel */}
      <aside className="w-80 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow flex flex-col">
        <h3 className="font-semibold text-lg mb-4 text-indigo-700 dark:text-yellow-200">Members</h3>
        <ul className="mb-6">
          {room?.members?.map((member: RoomMember) => (
            <li key={member.id} className="mb-1 text-gray-700 dark:text-yellow-100">
              {member.name || member.userId}
            </li>
          ))}
        </ul>
        <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
          Leaderboard
        </h3>
        <ol className="mb-6 list-decimal pl-5">
          {leaderboard.map((member, idx) => (
            <li
              key={member.id}
              className="mb-1 text-gray-700 dark:text-yellow-100 flex justify-between"
            >
              <span>
                {idx === 0 && <span className="mr-1">🥇</span>}
                {idx === 1 && <span className="mr-1">🥈</span>}
                {idx === 2 && <span className="mr-1">🥉</span>}
                {member.name || member.userId}
              </span>
              <span className="font-bold">{member.score ?? 0}</span>
            </li>
          ))}
        </ol>
        <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
          Invite Friends
        </h3>
        <div className="flex gap-2 items-center mb-2">
          <input
            readOnly
            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/rooms/join?code=${room?.id}`}
            className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-yellow-200"
          />
          <button
            onClick={handleCopyInvite}
            className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {/* Invite by Email */}
        <div className="flex gap-2 items-center mt-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Enter email to invite"
            className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-yellow-200"
          />
          <button
            onClick={handleSendInvite}
            className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
            disabled={!inviteEmail || inviteStatus === 'sending'}
          >
            {inviteStatus === 'sending'
              ? 'Sending...'
              : inviteStatus === 'sent'
                ? 'Invited!'
                : inviteStatus === 'error'
                  ? 'Error!'
                  : 'Invite'}
          </button>
        </div>
      </aside>
    </div>
  );
}

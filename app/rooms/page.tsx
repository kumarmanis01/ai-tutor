'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { Room, UserRole, RoomMember } from '@/types/rooms';
import Leaderboard from '@/components/Leaderboard';
import WeeklyChallenge from '@/components/WeeklyChallenge';
import InviteButton from '@/components/InviteButton';
/**
 * RoomsPage component
 * - Honors dark/light mode for all UI elements.
 * - Shows links for admin actions and room navigation.
 * - Allows searching/filtering available rooms by subject, grade, or topic.
 * - Shows public rooms with direct join option.
 * - Shows private rooms with a request to join button.
 * - Shows admin panel for admins.
 * - Uses back button navigation for admin subpages.
 */
export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [requestingRoomId, setRequestingRoomId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rooms' | 'admin'>('rooms');
  const [userRole, setUserRole] = useState<UserRole>('member');
  const [adminAction, setAdminAction] = useState<
    '' | 'manage' | 'moderate' | 'requests' | 'edit' | 'archive' | 'create'
  >('');
  const [userId, setUserId] = useState<string | null>(null);
  const [requestingClassroom, setRequestingClassroom] = useState(false);

  // Fetch all rooms and user role on mount
  useEffect(() => {
    fetch('/api/rooms/list')
      .then((res) => res.json())
      .then(setRooms);

    // Fetch user profile to determine role and userId
    fetch('/api/user/profile')
      .then((res) => res.json())
      .then((data) => {
        setUserRole(data.role === 'admin' ? 'admin' : 'member');
        setUserId(data.id);
      });
  }, []);

  // Filter rooms by search, grade, subject, and topic
  const filteredRooms = rooms.filter((room) => {
    const matchesSearch =
      room.name.toLowerCase().includes(search.toLowerCase()) ||
      (room.subject && room.subject.toLowerCase().includes(search.toLowerCase()));
    const matchesGrade = grade ? room.grade === grade : true;
    const matchesSubject = subject ? room.subject === subject : true;
    const matchesTopic = topic ? room.topic?.toLowerCase().includes(topic.toLowerCase()) : true;
    return matchesSearch && matchesGrade && matchesSubject && matchesTopic;
  });

  // Check if current user is a member of the room
  const isMember = (room: Room) => {
    if (!userId || !room.members) return false;
    return room.members.some((member: RoomMember) => member.userId === userId);
  };

  // Handle request to join private room
  const handleRequestJoin = async (roomId: string) => {
    setRequestingRoomId(roomId);
    const res = await fetch('/api/rooms/request-join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    });
    setRequestingRoomId(null);
    if (res.ok) {
      toast('Request sent to room admin!');
    } else {
      toast('Unable to send request. Please try again.');
    }
  };

  // Extract unique grades, subjects, and topics for filters
  const grades = Array.from(new Set(rooms.map((room) => room.grade).filter(Boolean)));
  const subjects = Array.from(new Set(rooms.map((room) => room.subject).filter(Boolean)));
  const topics = Array.from(new Set(rooms.map((room) => room.topic).filter(Boolean)));

  // Handle request classroom
  const handleRequestClassroom = async () => {
    setRequestingClassroom(true);
    // Generate a consistent AI name based on filters
    const prompt = `Create a classroom for grade "${grade || 'any'}", subject "${subject || 'any'}", topic "${topic || search || 'general'}".`;
    const res = await fetch('/api/rooms/create-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    setRequestingClassroom(false);
    if (res.ok) {
      const data = await res.json();
      toast(`Classroom "${data.name}" created!`);
      setRooms((prev) => [...prev, data]);
    } else {
      toast('Unable to request classroom. Please try again.');
    }
  };

  // Admin subpage content with correct links
  const renderAdminContent = () => {
    switch (adminAction) {
      case 'manage':
        return (
          <div>
            <button
              onClick={() => setAdminAction('')}
              className="mb-4 flex items-center text-indigo-600 dark:text-yellow-300 hover:underline"
            >
              ← Back to Admin Panel
            </button>
            <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
              Manage My Rooms
            </h3>
            <Link
              href="/rooms/create"
              className="text-indigo-600 dark:text-yellow-300 hover:underline"
            >
              + Create New Room
            </Link>
            <ul className="mt-4">
              {rooms
                .filter((room) => room.members?.some((m) => m.userId === userId))
                .map((room) => (
                  <li key={room.id} className="mb-2">
                    <Link
                      href={`/rooms/${room.id}`}
                      className="text-indigo-600 dark:text-yellow-300 hover:underline"
                    >
                      {room.name}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        );
      case 'moderate':
        return (
          <div>
            <button
              onClick={() => setAdminAction('')}
              className="mb-4 flex items-center text-indigo-600 dark:text-yellow-300 hover:underline"
            >
              ← Back to Admin Panel
            </button>
            <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
              Moderate Members
            </h3>
            <ul className="mt-4">
              {rooms
                .filter((room) => room.members?.some((m) => m.userId === userId))
                .map((room) => (
                  <li key={room.id} className="mb-2">
                    <Link
                      href={`/rooms/${room.id}`}
                      className="text-indigo-600 dark:text-yellow-300 hover:underline"
                    >
                      {room.name}
                    </Link>
                  </li>
                ))}
            </ul>
            {/* Add moderate members UI here */}
          </div>
        );
      case 'requests':
        return (
          <div>
            <button
              onClick={() => setAdminAction('')}
              className="mb-4 flex items-center text-indigo-600 dark:text-yellow-300 hover:underline"
            >
              ← Back to Admin Panel
            </button>
            <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
              Pending Requests
            </h3>
            {/* Add pending requests UI here */}
          </div>
        );
      case 'edit':
        return (
          <div>
            <button
              onClick={() => setAdminAction('')}
              className="mb-4 flex items-center text-indigo-600 dark:text-yellow-300 hover:underline"
            >
              ← Back to Admin Panel
            </button>
            <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
              Edit Room
            </h3>
            <ul className="mt-4">
              {rooms
                .filter((room) => room.members?.some((m) => m.userId === userId))
                .map((room) => (
                  <li key={room.id} className="mb-2">
                    <Link
                      href={`/rooms/${room.id}`}
                      className="text-indigo-600 dark:text-yellow-300 hover:underline"
                    >
                      {room.name}
                    </Link>
                  </li>
                ))}
            </ul>
            {/* Add edit room UI here */}
          </div>
        );
      case 'archive':
        return (
          <div>
            <button
              onClick={() => setAdminAction('')}
              className="mb-4 flex items-center text-indigo-600 dark:text-yellow-300 hover:underline"
            >
              ← Back to Admin Panel
            </button>
            <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
              Delete/Archive Rooms
            </h3>
            <ul className="mt-4">
              {rooms
                .filter((room) => room.members?.some((m) => m.userId === userId))
                .map((room) => (
                  <li key={room.id} className="mb-2">
                    <Link
                      href={`/rooms/${room.id}`}
                      className="text-indigo-600 dark:text-yellow-300 hover:underline"
                    >
                      {room.name}
                    </Link>
                  </li>
                ))}
            </ul>
            {/* Add archive rooms UI here */}
          </div>
        );
      case 'create':
        return (
          <div>
            <button
              onClick={() => setAdminAction('')}
              className="mb-4 flex items-center text-indigo-600 dark:text-yellow-300 hover:underline"
            >
              ← Back to Admin Panel
            </button>
            <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
              Create Room
            </h3>
            <Link
              href="/rooms/create"
              className="text-indigo-600 dark:text-yellow-300 hover:underline"
            >
              Go to Create Room Page
            </Link>
          </div>
        );
      default:
        return (
          <div>
            <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
              Admin Panel
            </h3>
            <ul>
              <li className="mb-2">
                <button
                  onClick={() => setAdminAction('manage')}
                  className="text-indigo-600 dark:text-yellow-300 hover:underline"
                >
                  Manage My Rooms
                </button>
              </li>
              <li className="mb-2">
                <button
                  onClick={() => setAdminAction('moderate')}
                  className="text-indigo-600 dark:text-yellow-300 hover:underline"
                >
                  Moderate Members
                </button>
              </li>
              <li className="mb-2">
                <button
                  onClick={() => setAdminAction('requests')}
                  className="text-indigo-600 dark:text-yellow-300 hover:underline"
                >
                  Pending Requests
                </button>
              </li>
              <li className="mb-2">
                <button
                  onClick={() => setAdminAction('edit')}
                  className="text-indigo-600 dark:text-yellow-300 hover:underline"
                >
                  Edit Room
                </button>
              </li>
              <li className="mb-2">
                <button
                  onClick={() => setAdminAction('archive')}
                  className="text-indigo-600 dark:text-yellow-300 hover:underline"
                >
                  Delete/Archive Rooms
                </button>
              </li>
              <li className="mb-2">
                <Link
                  href="/rooms/create"
                  className="text-indigo-600 dark:text-yellow-300 hover:underline"
                >
                  + Create New Room
                </Link>
              </li>
            </ul>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen max-w-3xl mx-auto py-8 px-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <h2 className="text-2xl font-bold mb-6 text-indigo-700 dark:text-yellow-300">Rooms</h2>
      {/* ...existing rooms list / main content ... */}

      <aside className="w-80 space-y-4">
        {/* existing invite UI */}
        <InviteButton />

        {/* add leaderboard and weekly challenge */}
        <Leaderboard />
        <WeeklyChallenge />
      </aside>
      {/* Navigation Tabs */}
      <div className="mb-6 flex gap-4">
        <button
          className={`px-4 py-2 rounded font-semibold transition ${
            activeTab === 'rooms'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-yellow-200'
          }`}
          onClick={() => {
            setActiveTab('rooms');
            setAdminAction('');
          }}
        >
          Available Rooms
        </button>
        {userRole === 'admin' && (
          <button
            className={`px-4 py-2 rounded font-semibold transition ${
              activeTab === 'admin'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-yellow-200'
            }`}
            onClick={() => setActiveTab('admin')}
          >
            Admin Panel
          </button>
        )}
      </div>

      {/* Rooms Tab */}
      {activeTab === 'rooms' && (
        <>
          {/* Search and Filter */}
          <div className="mb-6 flex flex-col md:flex-row gap-4">
            <input
              className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-yellow-200"
              placeholder="Search by name or subject"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-yellow-200"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="">All Grades</option>
              {grades.map((g) => (
                <option key={g} value={g as string}>
                  {g}
                </option>
              ))}
            </select>
            <select
              className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-yellow-200"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s as string}>
                  {s}
                </option>
              ))}
            </select>
            <input
              className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-yellow-200"
              placeholder="Search by topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          {/* Topic Suggestions */}
          <div className="flex flex-wrap gap-2 mb-4">
            {topics.map((t) => (
              <button
                key={t}
                className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-yellow-200 rounded"
                onClick={() => setTopic(t as string)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Room List */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow">
            <h3 className="font-semibold text-lg mb-2 text-indigo-700 dark:text-yellow-200">
              Available Rooms
            </h3>
            <ul>
              {filteredRooms.length === 0 && (
                <li className="text-gray-500 dark:text-gray-400 flex items-center gap-4">
                  No rooms found.
                  <button
                    className="ml-4 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                    onClick={handleRequestClassroom}
                    disabled={requestingClassroom}
                  >
                    {requestingClassroom ? 'Requesting...' : 'Request Room'}
                  </button>
                </li>
              )}
              {filteredRooms.map((room) => (
                <li key={room.id} className="mb-3 flex items-center justify-between">
                  <div>
                    <Link
                      href={`/rooms/${room.id}`}
                      className="text-indigo-600 dark:text-yellow-300 font-medium hover:underline"
                    >
                      {room.name}
                    </Link>
                    {room.subject && (
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                        ({room.subject})
                      </span>
                    )}
                    {room.grade && (
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                        Grade: {room.grade}
                      </span>
                    )}
                    {room.topic && (
                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                        Topic: {room.topic}
                      </span>
                    )}
                    {room.isPrivate && (
                      <span className="ml-2 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded">
                        Private
                      </span>
                    )}
                  </div>
                  {isMember(room) ? (
                    <Link
                      href={`/rooms/${room.id}`}
                      className="ml-4 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                    >
                      Enter
                    </Link>
                  ) : room.isPrivate ? (
                    <button
                      className="ml-4 px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition"
                      onClick={() => handleRequestJoin(room.id)}
                      disabled={requestingRoomId === room.id}
                    >
                      {requestingRoomId === room.id ? 'Requesting...' : 'Request to Join'}
                    </button>
                  ) : (
                    <Link
                      href={`/rooms/${room.id}`}
                      className="ml-4 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                    >
                      Join
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Admin Panel Tab with Back Button Navigation and correct links */}
      {activeTab === 'admin' && userRole === 'admin' && (
        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow">
          {renderAdminContent()}
        </div>
      )}
    </div>
  );
}

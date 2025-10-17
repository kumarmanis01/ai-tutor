export type Room = {
  id: string;
  name: string;
  subject?: string | null;
  grade?: string | null;
  topic?: string | null; // <-- Type only
  isPrivate: boolean;
  createdByAI: boolean; // <-- Type only
  members?: RoomMember[];
};

export type RoomMember = {
  id: string;
  name?: string | null;
  userId?: string | null;
  role?: 'admin' | 'member' | 'guest';
  score?: number; // <-- Add this line
};

export type Message = {
  id: string;
  sender?: string | null;
  senderId?: string | null;
  content: string;
};

export type UserRole = 'admin' | 'member';

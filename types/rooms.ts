export type Room = {
  id: string;
  name: string;
  subject?: string | null;
  grade?: string | null;
  isPrivate: boolean;
  members?: RoomMember[];
};

export type RoomMember = {
  id: string;
  name?: string | null;
  userId?: string | null;
};

export type Message = {
  id: string;
  sender?: string | null;
  senderId?: string | null;
  content: string;
};

export type UserRole = 'admin' | 'member';

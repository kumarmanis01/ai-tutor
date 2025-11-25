'use client';

import { useEffect, useState, useRef } from 'react'; // Add useRef
import { useSession } from 'next-auth/react';
import MessageBubble from './MessageBubble';
import Controls from './Controls';
import SubscriptionModal from '../SubscriptionModal';
import AuthModal from '../AuthModal';
import ProfileRibbon from '@/components/UI/ProfileRibbon';
import { v4 as uuidv4 } from 'uuid'; // Import UUID library

// Helper to base64 encode keys for privacy
function encodeKey(str: string) {
  return btoa(unescape(encodeURIComponent(str)));
}

// ChatMessage type for chat history
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// Helper to get user id from session (supports custom SessionUser type)
function getUserId(user: { id?: string; email?: string | null }) {
  // Prefer id if present, else fallback to email
  return user && typeof user === 'object' ? (user.id ?? user.email ?? 'guest') : 'guest';
}

export default function ChatBot() {
  const { data: session } = useSession();
  const messagesEndRef = useRef<HTMLDivElement>(null); // Reference for scrolling

  // Profile completeness check
  const incompleteProfile =
    session && (!session.user?.parentEmail || !session.user?.name || !session.user?.country);

  // Use a persistent user identifier for localStorage key (base64 encoded for privacy)
  function getUserKey() {
    if (session?.user) {
      // Try to get id, else fallback to email, else guest
      const keySource = getUserId(session.user);
      return encodeKey(keySource);
    }
    return 'guest';
  }
  const userKey = getUserKey();
  const storageKey = `ai-tutor:chat:${userKey}`;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [subscription, setSubscription] = useState<{
    isPremium: boolean;
  }>({
    isPremium: false,
  });
  const [loading, setLoading] = useState(false);
  const [showSubscriptionSubModal, setShowSubscriptionSubModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [volume, setVolume] = useState(1); // 1 = max volume

  // Language state for written & spoken language
  const [lang, setLang] = useState('English');

  // Fetch subscription status from backend
  async function fetchStatus() {
    const res = await fetch('/api/subscription/status');
    const data = await res.json();
    setSubscription({
      isPremium: data.isPremium,
    });
  }

  useEffect(() => {
    fetchStatus();
    try {
      let raw = localStorage.getItem(storageKey);
      // Fallback: try old key if nothing found (for migration)
      if (!raw && session?.user?.email) {
        const oldKey = `ai-tutor:chat:${session.user.email}`;
        raw = localStorage.getItem(oldKey);
        if (raw) localStorage.setItem(storageKey, raw);
      }
      if (raw) {
        setMessages(JSON.parse(raw));
      }
    } catch {}
  }, [storageKey, session]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
  }, [messages, storageKey]);

  // Scroll to the bottom of the chat container
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom(); // Scroll whenever messages change
  }, [messages]);

  // Send message to backend, passing selected language
  async function handleSend(message: string) {
    if (!session) {
      setShowAuthModal(true);
      return;
    }

    setLoading(true);
    try {
      // Modify the detailedMessage to request structured responses
      const detailedMessage = `Explain in detail like a teacher to a student in class. Provide the answer in bullet points or numbered lists: ${message}`;

      // Log the raw response from OpenAI to the console
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Pass selected language to backend for correct written language
        body: JSON.stringify({ message: detailedMessage, lang }),
      });
      const data = await res.json();

      // Log the raw response for debugging
      console.log('Raw OpenAI Response:', data);

      if (data.error) {
        if (data.error === 'free_limit_reached') {
          setShowSubscriptionSubModal(true);
        } else if (data.error === 'profanity_detected') {
          alert(
            data.message ||
              "I understand that you're frustrated, and I want to help. However, I must ask that we keep the conversation respectful and avoid using inappropriate language for me to assist you effectively",
          );
        } else {
          alert(data.message || 'Error asking question.');
        }
      } else {
        const userMsg: ChatMessage = {
          id: `${uuidv4()}-user`,
          role: 'user',
          content: message,
        };

        // Use the response from OpenAI as-is without additional formatting
        const aiMsg: ChatMessage = {
          id: `${uuidv4()}-ai`,
          role: 'assistant',
          content: data.reply, // Render the response exactly as returned by OpenAI
        };

        setMessages((prev) => [...prev, userMsg, aiMsg]);
        scrollToBottom(); // Ensure scrolling after adding messages
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Ribbon overlay if profile is incomplete */}
      <ProfileRibbon show={!!incompleteProfile} />
      <div className="flex-1 overflow-y-auto p-4 space-y-2 border-2 border-blue-500 shadow-lg rounded-lg bg-white dark:bg-gray-900 dark:border-blue-300">
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 && (
            <div className="text-gray-400 text-center mt-10">
              Ask your first question to get started
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              volume={volume}
              lang={lang} // Pass lang prop for spoken language
            />
          ))}
          <div ref={messagesEndRef} /> {/* Scroll target */}
        </div>

        {/* Controls with quota info and language selection */}
        <Controls
          onSend={handleSend}
          loading={loading}
          isPremium={subscription.isPremium}
          isValidSession={!!session}
          volume={volume}
          setVolume={setVolume}
          lang={lang}
          setLang={setLang}
        />

        {/* Login Modal for unauthenticated users */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          message="Please login to ask questions."
        />

        {/* Subscription Modal */}
        <SubscriptionModal
          open={showSubscriptionSubModal}
          onClose={() => setShowSubscriptionSubModal(false)}
        />
      </div>
    </div>
  );
}

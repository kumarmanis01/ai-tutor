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
      // First, attempt to decrement the user's free-question quota (server-side)
      try {
        const decRes = await fetch('/api/free-questions', { method: 'POST' });
        if (!decRes.ok) {
          const err = await decRes.json().catch(() => ({}));
          if (err?.error === 'free_limit_reached') {
            setShowSubscriptionSubModal(true);
            return;
          }
          // Non-specific error — show a friendly message and abort
          alert('Unable to decrement free question quota. Please try again later.');
          return;
        }

        const decData = await decRes.json();
        // Notify any listeners (Controls) about updated remaining count
        try {
          window.dispatchEvent(
            new CustomEvent('freeQuestionsUpdated', { detail: { remaining: decData.remaining } }),
          );
        } catch {}
      } catch (err) {
        console.error('Error decrementing free-questions quota', err);
        alert('Unable to verify question quota. Please try again later.');
        return;
      }

      // Modify the detailedMessage to request structured responses
      const detailedMessage = `You are a patient, encouraging teacher answering a student's question. Use clear, age-appropriate language and an inviting tone. Structure your response as follows:

    1) Short answer summary (1-2 sentences): give the direct answer or main idea.
    2) Step-by-step explanation: break down the reasoning or solution into numbered steps and explain why each step works.
    3) Key concepts and definitions: list and briefly define any important terms the student should know.
    4) Helpful analogy or real-world example: give one simple analogy to build intuition.
    5) Common mistakes to avoid: list 2–3 likely pitfalls and how to avoid them.
    6) Worked example (if applicable): show a solved example with each step annotated.
    7) Practice problems: provide 1–2 short practice questions with brief hints (not full solutions).
    8) Quick recap and next steps: a 1–2 sentence summary and a suggestion for what to study next.

    Keep sentences short, avoid unnecessary jargon (or define it), use bullet points and numbered lists for clarity, and end by inviting the student to ask for clarification or more practice. Now answer the student's question exactly as requested: ${message}`; 

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

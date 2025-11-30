 'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import analyticsClient from '@/lib/analyticsClient';
import { useSession } from 'next-auth/react';
import ChatMessagesContainer from './ChatMessagesContainer';
import StickyControls from './StickyControls';
import SubscriptionModal from '../SubscriptionModal';
import AuthModal from '../AuthModal';
import ProfileRibbon from '@/components/UI/ProfileRibbon';
import { v4 as uuidv4 } from 'uuid'; // Import UUID library
import SubjectSidebar from './SubjectSidebar';

// Helper to base64 encode keys for privacy
function encodeKey(str: string) {
  return btoa(unescape(encodeURIComponent(str)));
}

// ChatMessage type for chat history
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
}

// Helper to get user id from session (supports custom SessionUser type)
function getUserId(user: { id?: string; email?: string | null }) {
  // Prefer id if present, else fallback to email
  return user && typeof user === 'object' ? (user.id ?? user.email ?? 'guest') : 'guest';
}

export default function ChatBot() {
  const { data: session } = useSession();
  const [mobileSubjectsOpen, setMobileSubjectsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

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

  // per-subject messages stored client-side
  const [messagesBySubject, setMessagesBySubject] = useState<Record<string, ChatMessage[]>>({});
  const [subject, setSubject] = useState<string>('general');
  const [subscription, setSubscription] = useState<{
    isPremium: boolean;
  }>({
    isPremium: false,
  });
  const [loading, setLoading] = useState(false);
  const [showSubscriptionSubModal, setShowSubscriptionSubModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [volume, setVolume] = useState(1); // 1 = max volume

  // Language state: 'auto' means follow browser locale; explicit values are saved
  const [lang, setLang] = useState('auto');

  // map browser locale to supported language names
  function browserToSupported(tag?: string) {
    if (!tag) return 'English';
    const t = tag.toLowerCase();
    if (t.startsWith('hi')) return 'Hindi';
    if (t.startsWith('ta')) return 'Tamil';
    if (t.startsWith('bn')) return 'Bengali';
    if (t.startsWith('fr')) return 'French';
    if (t.startsWith('es')) return 'Spanish';
    return 'English';
  }

  // Initialize language: prefer server-stored (when logged in), else localStorage, else browser mapping
  useEffect(() => {
    async function initLang() {
      try {
        // If user is signed in, prefer server-stored language
        if (session?.user?.id) {
          try {
            const res = await fetch('/api/user/language');
            if (res.ok) {
              const data = await res.json();
              if (data?.language) {
                setLang(data.language);
                try {
                  localStorage.setItem('ai-tutor:preferredLang', data.language);
                } catch {}
                return;
              }
            }
          } catch {}
        }

        // Fallback to localStorage or browser mapping
        try {
          const pref = localStorage.getItem('ai-tutor:preferredLang');
          if (pref) {
            setLang(pref);
            return;
          }
        } catch {}

        setLang(
          browserToSupported(typeof navigator !== 'undefined' ? navigator.language : undefined),
        );
      } catch {}
    }

    initLang();
  }, [session]);

  // Resolved language for components that need a concrete language (TTS, rendering)
  const resolvedLang =
    typeof window !== 'undefined' && lang === 'auto'
      ? browserToSupported(navigator.language)
      : lang;

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
      const subjects = ['general', 'math', 'science', 'coding'];
      const map: Record<string, ChatMessage[]> = {};
      for (const s of subjects) {
        const key = `${storageKey}:subject:${s}`;
        const raw = localStorage.getItem(key);
        if (raw) map[s] = JSON.parse(raw);
      }
      // migrate old single storage into general if present
      const oldRaw = localStorage.getItem(storageKey);
      if (oldRaw && (!map['general'] || map['general'].length === 0)) {
        try {
          const parsed = JSON.parse(oldRaw) as ChatMessage[];
          if (Array.isArray(parsed)) map['general'] = parsed;
        } catch {}
      }
      setMessagesBySubject(map);
    } catch {}
  }, [storageKey, session]);

  // persist per-subject messages
  useEffect(() => {
    try {
      for (const [s, msgs] of Object.entries(messagesBySubject)) {
        localStorage.setItem(`${storageKey}:subject:${s}`, JSON.stringify(msgs));
      }
    } catch {}
  }, [messagesBySubject, storageKey]);

  // Scroll to the bottom of the chat container
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const currentMessages = useMemo(
    () => messagesBySubject[subject] ?? [],
    [messagesBySubject, subject],
  );
  useEffect(() => {
    scrollToBottom(); // Scroll whenever messages for current subject change
  }, [currentMessages]);

  // Controls placement and safe-bottom-padding are now handled inside
  // the `StickyControls` component. Keep this component focused on state and
  // orchestration.

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

        Short Answer Summary:
        Provide a direct answer or main idea in 1-2 sentences.

        Step-by-Step Explanation:
        Break down the reasoning or solution into numbered steps and explain why each step works.

        Key Concepts and Definitions:
        List and briefly define any important terms the student should know.

        Helpful Analogy or Real-World Example:
        Provide one simple analogy or real-world example to build intuition.

        Common Mistakes to Avoid:
        List 2–3 likely pitfalls and how to avoid them.

        Worked Example (if applicable):
        Show a solved example with each step annotated.

        Practice Problems:
        Provide 1–2 short practice questions with brief hints (not full solutions).

        Quick Recap and Next Steps:
        Summarize the key points in 1–2 sentences and suggest what to study next.

        Keep sentences short, avoid unnecessary jargon (or define it), use bullet points and numbered lists for clarity, and end by inviting the student to ask for clarification or more practice. Now answer the student's question exactly as requested: ${message}`;

      // Log the raw response from OpenAI to the console
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Pass selected language and subject to backend for correct context
        body: JSON.stringify({ message: detailedMessage, lang, subject }),
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
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : undefined,
        };

        setMessagesBySubject((prev) => {
          const existing = prev[subject] ?? [];
          return { ...prev, [subject]: [...existing, userMsg, aiMsg] };
        });
        scrollToBottom(); // Ensure scrolling after adding messages
      }
    } finally {
      setLoading(false);
    }
  }

  // Keep a ref to the latest handleSend to avoid useEffect dependency churn
  const handleSendRef = useRef<typeof handleSend>(() => Promise.resolve());
  // update ref directly so we don't need a useEffect dependency on handleSend
  handleSendRef.current = handleSend;

  // Handle suggestion pick events emitted by MessageBubble (do not auto-submit)
  useEffect(() => {
    function onSuggestionPicked(e: Event) {
      try {
        const detail = (e as CustomEvent).detail as { messageId?: string; suggestion: string } | undefined;
        if (!detail) return;
        const { messageId, suggestion } = detail;
        // Remove suggestions from the message (ephemeral)
        setMessagesBySubject((prev) => {
          const existing = prev[subject] ?? [];
          const newMsgs = existing.map((m) => {
            if (m.id === messageId) return { ...m, suggestions: undefined } as ChatMessage;
            return m;
          });
          return { ...prev, [subject]: newMsgs };
        });
        // Track dismissed reason 'picked'
        try {
          analyticsClient.trackEvent('suggestion.dismissed', { messageId, reason: 'picked', suggestion });
        } catch {}
        // Do NOT auto-submit. QuickInputBox will listen for the same event to populate the input.
      } catch (err) {
        console.error('suggestion handler error', err);
      }
    }

    function onUserTyped() {
      try {
        // When user types, dismiss any visible suggestions and record dismissal
        setMessagesBySubject((prev) => {
          const existing = prev[subject] ?? [];
          let anyCleared = false;
          const newMsgs = existing.map((m) => {
            if (m.suggestions && m.suggestions.length > 0) {
              anyCleared = true;
              return { ...m, suggestions: undefined } as ChatMessage;
            }
            return m;
          });
            if (anyCleared) {
              try {
                analyticsClient.trackEvent('suggestion.dismissed', { reason: 'typed' });
              } catch {}
            }
          return { ...prev, [subject]: newMsgs };
        });
      } catch (err) {
        console.error('onUserTyped handler error', err);
      }
    }

    window.addEventListener('chatSuggestionPicked', onSuggestionPicked as EventListener);
    window.addEventListener('chatUserTyped', onUserTyped as EventListener);
    return () => {
      window.removeEventListener('chatSuggestionPicked', onSuggestionPicked as EventListener);
      window.removeEventListener('chatUserTyped', onUserTyped as EventListener);
    };
  }, [subject]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Ribbon overlay if profile is incomplete */}
      <ProfileRibbon show={!!incompleteProfile} />
      <div className="flex-1 flex gap-4 min-h-0">
        <SubjectSidebar subject={subject} setSubject={setSubject} />

        <div id="chat-area-container" className="flex-1 flex flex-col min-h-0 relative">
          <div id="chat-container" className="flex-1 flex flex-col min-h-0 px-0 md:px-0">
            {/* mobile hamburger for subjects */}
            <div className="md:hidden mb-2">
              <button
                type="button"
                aria-label="Open subjects"
                className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => setMobileSubjectsOpen(true)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>

            <ChatMessagesContainer
              currentMessages={currentMessages}
              messagesEndRef={messagesEndRef}
              containerRef={messagesContainerRef}
              volume={volume}
              lang={resolvedLang}
            />

            <StickyControls
              onSend={handleSend}
              loading={loading}
              isPremium={subscription.isPremium}
              isValidSession={!!session}
              volume={volume}
              setVolume={setVolume}
              lang={lang}
              setLang={setLang}
              subject={subject}
              setSubject={setSubject}
              messagesContainerRef={messagesContainerRef}
              messagesCount={currentMessages.length}
            />
          </div>

          {/* Mobile subjects drawer */}
          {mobileSubjectsOpen && (
            <div className="fixed inset-0 z-50">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setMobileSubjectsOpen(false)}
              />
              <div className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4">
                <SubjectSidebar
                  subject={subject}
                  setSubject={setSubject}
                  compact={false}
                  onSelect={() => setMobileSubjectsOpen(false)}
                />
              </div>
            </div>
          )}
        </div>

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

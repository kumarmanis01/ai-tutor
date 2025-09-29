"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import MessageBubble from "./MessageBubble";
import Controls from "./Controls";
import SubscriptionModal from "../SubscriptionModal";
import LoginModal from "../LoginModal";

// Helper to base64 encode keys for privacy
function encodeKey(str: string) {
  return btoa(unescape(encodeURIComponent(str)));
}

// ChatMessage type for chat history
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatBot() {
  const { data: session } = useSession();

  // Use a persistent user identifier for localStorage key (base64 encoded for privacy)
  function getUserKey() {
    if (session?.user?.id) return encodeKey(session.user.id);
    if (session?.user?.email) return encodeKey(session.user.email);
    return "guest";
  }
  const userKey = getUserKey();
  const storageKey = `ai-tutor:chat:${userKey}`;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [subscription, setSubscription] = useState<{
    isPremium: boolean;
    todaysCount: number;
  }>({
    isPremium: false,
    todaysCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [showSubscriptionSubModal, setShowSubscriptionSubModal] =
    useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [volume, setVolume] = useState(1); // 1 = max volume

  // Language state for written & spoken language
  const [lang, setLang] = useState("English");

  // Fetch subscription status from backend
  async function fetchStatus() {
    const res = await fetch("/api/subscription/status");
    const data = await res.json();
    setSubscription({
      isPremium: data.isPremium,
      todaysCount: data.todaysCount,
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
    // eslint-disable-next-line
  }, [storageKey, session]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
  }, [messages, storageKey]);

  // Send message to backend, passing selected language
  async function handleSend(message: string) {
    if (!session) {
      setShowLoginModal(true);
      return;
    }

    if (!subscription.isPremium && subscription.todaysCount >= 3) {
      setShowSubscriptionSubModal(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Pass selected language to backend for correct written language
        body: JSON.stringify({ message, lang }),
      });
      const data = await res.json();
      if (data.error) {
        if (data.error === "free_limit_reached") {
          setShowSubscriptionSubModal(true);
        } else if (data.error === "profanity_detected") {
          alert(
            data.message ||
              "I understand that you're frustrated, and I want to help. However, I must ask that we keep the conversation respectful and avoid using inappropriate language for me to assist you effectively",
          );
        } else {
          alert(data.message || "Error asking question.");
        }
      } else {
        const userMsg: ChatMessage = {
          id: `${Date.now()}-user`,
          role: "user",
          content: message,
        };
        const aiMsg: ChatMessage = {
          id: `${Date.now()}-ai`,
          role: "assistant",
          content: data.reply,
        };
        setMessages((prev) => [...prev, userMsg, aiMsg]);
        fetchStatus();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
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
      </div>

      {/* Controls with quota info and language selection */}
      <Controls
        onSend={handleSend}
        loading={loading}
        isPremium={subscription.isPremium}
        isValidSession={!!session}
        todaysCount={subscription.todaysCount}
        volume={volume}
        setVolume={setVolume}
        lang={lang}
        setLang={setLang}
      />

      {/* Login Modal for unauthenticated users */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        message="Please login to ask questions."
      />

      {/* Subscription Modal */}
      <SubscriptionModal
        open={showSubscriptionSubModal}
        onClose={() => setShowSubscriptionSubModal(false)}
      />
    </div>
  );
}

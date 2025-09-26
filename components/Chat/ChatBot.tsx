// components/Chat/ChatBot.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import MessageBubble from "./MessageBubble";
import Controls from "./Controls";
import SubscriptionModal from "../SubscriptionModal";
import LoginModal from "../LoginModal";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatBot() {
  const { data: session } = useSession();
  // Use session id or fallback to 'guest' for localStorage key
  const sessionId = session?.user?.email || "guest";
  const storageKey = `ai-tutor:chat:${sessionId}`;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [subscription, setSubscription] = useState<{ isPremium: boolean; todaysCount: number }>({
    isPremium: false,
    todaysCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [showSubscriptionSubModal, setShowSubscriptionSubModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [volume, setVolume] = useState(1); // 1 = max volume

  // fetch subscription status
  async function fetchStatus() {
    const res = await fetch("/api/subscription/status");
    const data = await res.json();
    setSubscription({ isPremium: data.isPremium, todaysCount: data.todaysCount });
  }

  useEffect(() => {
    fetchStatus();
    // Load chat history from localStorage for this session
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setMessages(JSON.parse(raw));
      }
    } catch {}
  }, [sessionId]);

  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
  }, [messages, storageKey]);

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
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      console.log("Chat response:", data);
      if (data.error) {
        if (data.error === "free_limit_reached") {
          setShowSubscriptionSubModal(true);
        } if (data.error === "profanity_detected") {
           alert(data.message || "I understand that you're frustrated, and I want to help. However, I must ask that we keep the conversation respectful and avoid using inappropriate language for me to assist you effectively");
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
          <div className="text-gray-400 text-center mt-10">Ask your first question to get started</div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} volume={volume} />
        ))}
      </div>

      {/* Controls with quota info */}
      <Controls
        onSend={handleSend}
        loading={loading}
        isPremium={subscription.isPremium}
        isValidSession={!!session}
        todaysCount={subscription.todaysCount}
        volume={volume}
        setVolume={setVolume}
      />

      {/* Login Modal for unauthenticated users */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        message="Please login to ask questions."
      />

      {/* Subscription Modal */}
      <SubscriptionModal open={showSubscriptionSubModal} onClose={() => setShowSubscriptionSubModal(false)} />
    </div>
  );
}

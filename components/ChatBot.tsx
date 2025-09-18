// components/ChatBot.tsx
"use client";

import { useEffect, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

// List of supported Indian languages (ISO-ish code => English name)
const LANGS: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "bn", name: "Bengali" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "gu", name: "Gujarati" },
  { code: "mr", name: "Marathi" },
  { code: "kn", name: "Kannada" },
  { code: "ml", name: "Malayalam" },
  { code: "pa", name: "Punjabi" },
  { code: "ur", name: "Urdu" },
  { code: "or", name: "Odia" },
  { code: "as", name: "Assamese" },
  { code: "ks", name: "Kashmiri" },
  { code: "kok", name: "Konkani" },
  { code: "mai", name: "Maithili" },
  { code: "ne", name: "Nepali" },
  { code: "sa", name: "Sanskrit" },
  { code: "sd", name: "Sindhi" },
  { code: "doi", name: "Dogri" },
  { code: "mni", name: "Manipuri" },
  { code: "sat", name: "Santali" }
];

// Static welcome messages (local fallback) — key by code
const WELCOME: Record<string, string> = {
  en: "Hi — I'm your AI tutor! Ask me anything.",
  hi: "नमस्ते — मैं आपका AI शिक्षक हूँ! मुझसे कुछ पूछिए।",
  bn: "হ্যালো — আমি আপনার AI শিক্ষক! আমাকে কিছু জিজ্ঞাসা করুন।",
  ta: "வணக்கம் — நான் உங்கள் AI ஆசிரியர்! என்னிடமிருந்து கேள்வி கேளுங்கள்.",
  te: "హలో — నేను మీ AI ఉపాధ్యాయిని! నాకు ఒక ప్రశ్న అడగండి.",
  gu: "હેલ્લો — હું તમારો AI શિક્ષક છું! મને કેટલાક પ્રશ્નો પૂછો.",
  mr: "हॅलो — मी तुमचा AI शिक्षक आहे! मला एक प्रश्न विचारा.",
  kn: "ಹೇಲೋ — ನಾನು ನಿಮ್ಮ AI ಶಿಕ್ಷಕ! ನನ್ನನ್ನು ಪ್ರಶ್ನಿಸಿ.",
  ml: "ഹലോ — ഞാൻ നിങ്ങളുടെ AI അധ്യാപകര്‍! എന്നോട് ഒരു ചോദ്യം ചോദിക്കുക.",
  pa: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ — ਮੈਂ ਤੁਹਾਡਾ AI ਅਧਿਆਪਕ ਹਾਂ! ਮੈਨੂੰ ਇੱਕ ਸਵਾਲ ਪੁੱਛੋ.",
  ur: "ہیلو — میں آپ کا AI استاد ہوں! مجھ سے کوئی سوال پوچھیں.",
  or: "ନମସ୍କାର — ମୁଁ ଆପଣଙ୍କର AI ଶିକ୍ଷକ! ମୋତେ ଏକ ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ.",
  as: "নমস্কাৰ — মই আপোনাৰ AI শিক্ষক। মোক এখন প্ৰশ্ন কৰক।"
};

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [langCode, setLangCode] = useState("en"); // default english
  const [loading, setLoading] = useState(false);

  // Auto-detect browser language on load and set dropdown (fallback to English)
  useEffect(() => {
    const raw = (navigator.language || "en").split("-")[0].toLowerCase();
    const found = LANGS.find((l) => l.code === raw);
    setLangCode(found ? found.code : "en");

    // show static welcome message in that language (NO API call)
    const welcome = WELCOME[found ? found.code : "en"] || WELCOME["en"];
    setMessages([{ role: "assistant", content: welcome }]);
    // no auto API call
  }, []);

  // helper: get language name (English) for system prompt
  const languageName = (code: string) => {
    const found = LANGS.find((l) => l.code === code);
    return found ? found.name : "English";
  };

  async function sendMessage() {
    const text = input.trim();
    if (!text) return;

    // push user message locally immediately
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, language: languageName(langCode) })
      });

      const data = await res.json();

      if (data?.error) {
        // show localized error if possible
        const errMsg =
          (data.error === "openai_key_missing" && "Server not configured (no API key).") ||
          "⚠️ Error: could not get a reply";
        setMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
      } else {
        const reply = data.reply || "⚠️ AI returned no content.";
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      }
    } catch (err) {
      console.error("chat fetch error", err);
      // localized fallback
      const fallback = WELCOME[langCode] ? "⚠️ कुछ समस्या हुई। कृपया पुनः प्रयास करें।" : "⚠️ Something went wrong. Try again.";
      const localized = ((): string => {
        if (langCode === "hi") return "⚠️ कुछ समस्या हुई। कृपया पुनः प्रयास करें।";
        if (langCode === "bn") return "⚠️ কিছু ভুল হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।";
        if (langCode === "ta") return "⚠️ ஏதோ பிழை நிகழ்ந்தது. தயவுசெய்து மறுபடியும் முயற்சிக்கவும்.";
        // fallback to English if not mapped above
        return "⚠️ Something went wrong. Please try again.";
      })();
      setMessages((prev) => [...prev, { role: "assistant", content: localized }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Language</label>
          <select
            value={langCode}
            onChange={(e) => setLangCode(e.target.value)}
            className="border rounded px-2 py-1"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-gray-500">AI Tutor • Multilingual</div>
      </div>

      <div className="h-72 overflow-y-auto border p-3 rounded bg-gray-50 mb-3">
        {messages.map((m, i) => (
          <div key={i} className={`mb-2 ${m.role === "user" ? "text-right" : "text-left"}`}>
            <div
              className={`inline-block px-3 py-2 rounded-lg ${
                m.role === "user" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-900"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && <div className="text-gray-500 mt-2">⏳ AI is typing...</div>}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder={`Type your question (will be answered in ${languageName(langCode)})`}
          className="flex-1 border px-3 py-2 rounded-l-md"
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-r-md disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </div>
  );
}

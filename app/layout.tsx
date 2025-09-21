// app/layout.tsx
import "./globals.css";
import React from "react";

export const metadata = {
  title: "AI Tutor",
  description: "AI Tutor — multilingual, accessible MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Theme handling can be moved to a provider later
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
// app/api/chat/route.ts
// app/layout.tsx
import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "AI Tutor",
  description: "Multilingual AI Tutor (English & Hindi)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

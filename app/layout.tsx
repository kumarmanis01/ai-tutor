// ...existing code...
import './globals.css';
import { Inter } from 'next/font/google';
import Providers from './providers';
import AuthRedeemOnSignIn from '@/components/AuthRedeemOnSignIn';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Spinzy Academy',
  description: 'Your Personal AI Tutor — Learn Anything, Anytime.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-screen h-full`}>
        <div className="min-h-screen h-full bg-gray-50 dark:bg-gray-900 flex flex-col">
          <Providers>
            {/* Mount global client handler to consume referral cookie/query after sign-in */}
            <AuthRedeemOnSignIn />
            {children}
          </Providers>
        </div>
      </body>
    </html>
  );
}

import './globals.css';
import { Inter } from 'next/font/google';
import Providers from './providers';

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
            {children}
            <footer className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-center text-gray-500 border-t">
              &copy; {new Date().getFullYear()} Spinzy Academy. All rights reserved.
            </footer>
          </Providers>
        </div>
      </body>
    </html>
  );
}

'use client';

import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'pwa-install-dismissed';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function dismiss(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed as standalone -- never show
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Previously dismissed within 7 days
    if (isDismissed()) return;

    // Android / Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
      // Small delay so the slide-up animation is visible
      setTimeout(() => setVisible(true), 50);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari detection (no beforeinstallprompt)
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      setShowIOSGuide(true);
      setTimeout(() => setVisible(true), 50);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function handleDismiss() {
    dismiss();
    setVisible(false);
    setTimeout(() => {
      setShowBanner(false);
      setShowIOSGuide(false);
    }, 300);
    // Ask for push permission 3s after dismissing the install banner
    setTimeout(() => void requestNotificationPermission(), 3000);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
      setVisible(false);
      // Ask for push permission 3s after install accepted
      setTimeout(() => void requestNotificationPermission(), 3000);
    } else {
      handleDismiss();
    }
    setDeferredPrompt(null);
  }

  async function requestNotificationPermission(): Promise<void> {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (Notification.permission === 'granted') {
      await subscribeUserToPush();
      return;
    }
    if (Notification.permission === 'denied') return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await subscribeUserToPush();
    }
  }

  async function subscribeUserToPush(): Promise<void> {
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });
    } catch {
      // Best-effort -- never affect UX
    }
  }

  if (!showBanner && !showIOSGuide) return null;

  return (
    <div
      role="banner"
      aria-label="Install app"
      className="fixed bottom-16 left-0 right-0 z-40 px-3 transition-transform duration-300"
      style={{ transform: visible ? 'translateY(0)' : 'translateY(100%)' }}
    >
      <div
        className="mx-auto flex max-w-md items-center gap-3 rounded-2xl p-4 shadow-xl"
        style={{ backgroundColor: '#534AB7', color: '#ffffff' }}
      >
        {/* Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl font-bold" style={{ color: '#534AB7' }}>
          S
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          {showIOSGuide ? (
            <>
              <p className="text-sm font-semibold leading-tight">Install Spinzy</p>
              <p className="mt-0.5 text-xs opacity-90 leading-snug">
                Tap the Share button{' '}
                <span aria-label="share icon">&#xFFFD;&#x2191;</span>{' '}
                then &ldquo;Add to Home Screen&rdquo;
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold leading-tight">Add Spinzy to your home screen</p>
              <p className="mt-0.5 text-xs opacity-90">Learn offline, faster access</p>
            </>
          )}
        </div>

        {/* Actions */}
        {showIOSGuide ? (
          <button
            onClick={handleDismiss}
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold"
            style={{ color: '#534AB7' }}
          >
            Got it
          </button>
        ) : (
          <div className="flex shrink-0 flex-col gap-1.5">
            <button
              onClick={handleInstall}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold"
              style={{ color: '#534AB7' }}
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg border border-white/40 px-3 py-1.5 text-xs font-medium text-white/90"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

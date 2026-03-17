'use client';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      {/* Logo */}
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl text-4xl font-bold text-white"
        style={{ backgroundColor: '#534AB7' }}
      >
        S
      </div>

      <h1 className="mb-3 text-2xl font-bold" style={{ color: '#534AB7' }}>
        You&apos;re offline
      </h1>

      <p className="mb-8 max-w-xs text-base text-gray-500">
        Connect to the internet to continue learning with Teacher Vidya.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="rounded-xl px-8 py-3 text-base font-semibold text-white transition-opacity active:opacity-80"
        style={{ backgroundColor: '#534AB7' }}
      >
        Try again
      </button>
    </div>
  );
}

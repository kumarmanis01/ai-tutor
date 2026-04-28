/**
 * FILE OBJECTIVE:
 * - Accessible video modal for LP demo video. Opens a YouTube/Vimeo iframe in a
 *   full-screen overlay, dismissible via close button, backdrop click, or Escape key.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/VideoModal.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created for v3 landing page hero Watch Demo CTA
 */
'use client';

import { useEffect, useRef } from 'react';
import Icon from '@/components/UI/AppIcon';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** YouTube or Vimeo embed URL. Defaults to Spinzy product demo video. */
  embedUrl?: string;
}

// Demo video embed URL -- replace with actual video once produced
const DEFAULT_EMBED_URL =
  'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&modestbranding=1';

const VideoModal = ({ isOpen, onClose, embedUrl = DEFAULT_EMBED_URL }: VideoModalProps) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Trap focus to modal and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Focus close button when modal opens for keyboard accessibility
    closeButtonRef.current?.focus();
    // Prevent body scroll while open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if the backdrop itself (not the modal content) was clicked
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Product demo video"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-3xl aspect-video rounded-xl overflow-hidden shadow-2xl bg-black">
        {/* Close button -- positioned outside the iframe for reliable click handling */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close video"
          className="absolute -top-10 right-0 inline-flex items-center gap-1.5 text-white/90 hover:text-white font-semibold text-sm transition-colors min-h-[44px] min-w-[44px] justify-center"
        >
          <Icon name="XMarkIcon" size={22} variant="solid" />
          <span>Close</span>
        </button>

        <iframe
          src={embedUrl}
          title="Spinzy Academy product demo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0"
          loading="lazy"
        />
      </div>
    </div>
  );
};

export default VideoModal;

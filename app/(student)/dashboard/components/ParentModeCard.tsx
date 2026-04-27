'use client';
/**
 * FILE OBJECTIVE:
 * - Mobile-optimized parent mode link card.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/ParentModeCard.spec.ts
 *
 * EDIT LOG:
 * - 2025-01-22 | copilot | simplified for mobile with compact design
 */
import React from 'react';
import { logger } from '@/lib/logger';
import { useParentMode } from '@/hooks/useParentMode';

const ParentModeCard: React.FC = () => {
  const { data, loading } = useParentMode();
  const isConnected = data.status === 'connected';
  
  const handleClick = () => {
    logger.add('Parent Mode clicked', { className: 'ParentModeCard' });
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg p-3 border border-amber-500/20 active:scale-[0.98] transition-transform"
    >
      <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center text-lg">
        👨‍👩‍👧
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-foreground">Parent Dashboard</p>
        <p className="text-xs text-muted-foreground">
          {loading ? 'Checking...' : isConnected ? '✅ Connected' : 'Link parent account'}
        </p>
      </div>
      <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
};

export default ParentModeCard;
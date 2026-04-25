'use client';
/**
 * FILE OBJECTIVE:
 * - Client control to manage per-subject teaching language. Fetches availability
 *   and current value from `/api/student/subject-language` and persists changes
 *   via PATCH to the same endpoint.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/SubjectLanguageControl.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 */

import React, { useEffect, useState } from 'react';
import LanguageSelector from '@/components/LanguageSelector';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';

export default function SubjectLanguageControl({ subjectId }: { subjectId: string }) {
  const [availableCodes, setAvailableCodes] = useState<string[] | undefined>(undefined);
  const [current, setCurrent] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/student/subject-language`);
        if (!res.ok) return;
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        const avail = Array.isArray(j?.availableLanguages) ? j.availableLanguages : undefined;
        setAvailableCodes(avail);
        const subjLangs = j?.subjectLanguages ?? {};
        const currentFor = subjLangs?.[subjectId];
        if (currentFor && typeof currentFor === 'string') setCurrent(currentFor);
      } catch (err) {
        logger.warn('Failed to load subject language info', {
          className: 'SubjectLanguageControl',
          methodName: 'mount',
          subjectId,
          error: String(err),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  const nameToShort = (name: string) => {
    try {
      const n = String(name || '').toLowerCase();
      if (n === 'auto') return 'auto';
      if (n.startsWith('hin') || n.startsWith('hi')) return 'hi';
      if (n.startsWith('tam') || n.startsWith('ta')) return 'ta';
      if (n.startsWith('ben') || n.startsWith('bn')) return 'bn';
      if (n.startsWith('fre') || n.startsWith('fr')) return 'fr';
      if (n.startsWith('spa') || n.startsWith('es')) return 'es';
      if (n.startsWith('eng') || n.startsWith('en')) return 'en';
    } catch {}
    return 'en';
  };

  return (
    <div className="flex items-center gap-3" aria-busy={loading}>
      <div className="text-sm">
        <div className="font-medium">Teaching language</div>
        <div className="text-xs text-muted-foreground">
          Used by the tutor for this subject. Change applies from the next session.
        </div>
      </div>
      <div>
        <LanguageSelector
          lang={current ?? 'en'}
          availableCodes={availableCodes}
          setLang={async (name: string) => {
            try {
              const short = nameToShort(name);
              if (short !== 'auto') {
                // Guard availability if provided
                if (availableCodes && !availableCodes.includes(short)) {
                  try {
                    toast('Language not available for this subject yet.');
                  } catch {}
                  return;
                }
              }
              const res = await fetch('/api/student/subject-language', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subjectId, language: short }),
              });
              if (!res.ok) {
                try {
                  toast('Failed to update subject language.');
                } catch {}
                return;
              }
              setCurrent(short);
              try {
                toast('Teaching language updated');
              } catch {}
            } catch (err) {
              logger.warn('Failed to persist subject language', {
                className: 'SubjectLanguageControl',
                methodName: 'setLang',
                subjectId,
                error: String(err),
              });
              try {
                toast('Failed to update subject language.');
              } catch {}
            }
          }}
        />
      </div>
    </div>
  );
}

/**
 * FILE OBJECTIVE:
 * - Resolve content language from subject name for curriculum generation.
 * - Powers the three-layer language enforcement stack (prompt + code + validator).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/content/language-config.spec.ts
 */

export interface ContentLanguageConfig {
  readonly code: string;
  readonly name: string;
  readonly script: string;
}

export const CONTENT_LANGUAGE_MAP: Record<string, ContentLanguageConfig> = {
  hindi:     { code: 'hi', name: 'Hindi',     script: 'Devanagari' },
  marathi:   { code: 'mr', name: 'Marathi',   script: 'Devanagari' },
  gujarati:  { code: 'gu', name: 'Gujarati',  script: 'Gujarati'   },
  sanskrit:  { code: 'sa', name: 'Sanskrit',  script: 'Devanagari' },
  urdu:      { code: 'ur', name: 'Urdu',      script: 'Nastaliq'   },
  tamil:     { code: 'ta', name: 'Tamil',     script: 'Tamil'      },
  telugu:    { code: 'te', name: 'Telugu',    script: 'Telugu'     },
  kannada:   { code: 'kn', name: 'Kannada',   script: 'Kannada'    },
  malayalam: { code: 'ml', name: 'Malayalam', script: 'Malayalam'  },
  bengali:   { code: 'bn', name: 'Bengali',   script: 'Bengali'    },
  punjabi:   { code: 'pa', name: 'Punjabi',   script: 'Gurmukhi'  },
  english:   { code: 'en', name: 'English',   script: 'Latin'      },
};

/**
 * Resolve content language from a subject name.
 * Tries exact match first, then partial match (e.g. "Hindi Literature" matches "hindi").
 * Returns English config when no language subject is detected.
 */
export function resolveContentLanguage(subjectName: string): ContentLanguageConfig {
  const key = subjectName.toLowerCase().trim();

  if (CONTENT_LANGUAGE_MAP[key]) return CONTENT_LANGUAGE_MAP[key];

  for (const [lang, config] of Object.entries(CONTENT_LANGUAGE_MAP)) {
    if (key.includes(lang)) return config;
  }

  return CONTENT_LANGUAGE_MAP['english'];
}

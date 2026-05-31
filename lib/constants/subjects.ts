export const SUBJECTS = {
  math:    { id: 'math',    name: 'Mathematics',    short: 'Math',    cssColor: 'var(--subj-math)',    hue: 272 },
  science: { id: 'science', name: 'Science',        short: 'Science', cssColor: 'var(--subj-science)', hue: 150 },
  social:  { id: 'social',  name: 'Social Science', short: 'Social',  cssColor: 'var(--subj-social)',  hue: 45 },
  english: { id: 'english', name: 'English',        short: 'English', cssColor: 'var(--subj-english)', hue: 320 },
  hindi:   { id: 'hindi',   name: 'Hindi',          short: 'Hindi',   cssColor: 'var(--subj-hindi)',   hue: 20 },
} as const

export type SubjectKey = keyof typeof SUBJECTS

// Small helper utilities to detect missing syllabus and enforce UI guardrails.
export function needsSyllabus(subjectId: string | undefined, topicsListLength: number) {
  return Boolean(subjectId) && topicsListLength === 0;
}

export function syllabusCTAProps(subjectId: string | undefined, topicsListLength: number) {
  return {
    showCTA: needsSyllabus(subjectId, topicsListLength),
    ctaMessage: 'No topics found for this subject. Generate syllabus (chapters & topics) first.',
  };
}

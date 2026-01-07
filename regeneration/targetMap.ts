// Mapping from RegenerationTargetType -> candidate DB table names (canonical per-project)
// Add or adjust entries here to match your project's canonical content tables.
export const targetTableCandidates: Record<string, string[]> = {
  LESSON: ['"Lesson"', '"lesson"', '"lessons"', '"TopicNote"', '"topic_note"'],
  QUIZ: ['"Quiz"', '"quiz"', '"quizzes"', '"GeneratedTest"', '"generated_test"'],
  PROJECT: ['"Project"', '"project"'],
  MODULE: ['"Module"', '"module"', '"course_module"'],
}

export function getCandidatesFor(targetType: string) {
  return targetTableCandidates[targetType] ?? []
}

export const syllabusPrompt = ({ board, grade, subject }: { board: string; grade: string; subject: string }) => `
Generate syllabus for ${board} Class ${grade} ${subject}.
Return JSON only:
{
  "chapters": [
    {
      "title": "",
      "topics": ["", ""]
    }
  ]
}
`;

export const notesPrompt = ({ board, grade, subject, topic, language }: { board: string; grade: string; subject: string; topic: string; language: string }) => `
Explain "${topic}" for ${board} Class ${grade} ${subject}
Language: ${language}
JSON only:
{ "title": "", "content": "" }
`;

export const questionsPrompt = ({ board, grade, subject, topic, difficulty }: { board: string; grade: string; subject: string; topic: string; difficulty: string }) => `
// Silence unused var warning for subject if not used
void subject;
Generate 5 ${difficulty} questions for "${topic}"
Board: ${board}, Class ${grade}
JSON only:
{
  "questions": [
    { "prompt": "", "answer": "" }
  ]
}
`;

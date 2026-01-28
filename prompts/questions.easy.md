Context: Include the contents of `prompts/base_context.md` with placeholders filled.
Chapter: {chapter_title}
Topic: {topic_title}
Difficulty: Easy

Task: Generate 10 easy-level questions with examples for "{topic_title}" for Grade {grade} students.

Requirements:
- Focus on recall, recognition, and basic understanding of fundamental concepts
- Use simple, clear language appropriate for Grade {grade}
- Questions should be answerable with straightforward knowledge from the notes

Distribution:
- MCQs: 5
- Fill in the Blanks: 3
- True/False: 2

Output Format (JSON):
{
  "difficulty": "easy",
  "topic": "{topic_title}",
  "total_questions": 10,
  "questions": [ /* question objects as specified */ ]
}

Answer JSON Schema Examples (GENERAL / Guidance):

General answer object (for short answer / mcq):
{
  "type": "mcq" | "short_answer" | "numeric",
  "question": "string",
  "options": ["string"] (for MCQ),
  "answer": {
    "final_answer": "string",          // final concise answer
    "explanation": "string",          // short conceptual explanation
    "step_by_step": ["string"]        // optional steps to reach the answer
  }
}

Math-specific example:
{
  "type": "numeric",
  "question": "Solve for x: 2x + 3 = 11",
  "answer": {
    "final_answer": "4",
    "explanation": "Subtract 3 from both sides then divide by 2.",
    "step_by_step": ["2x + 3 = 11","2x = 8","x = 4"]
  }
}

Science-specific example:
{
  "type": "short_answer",
  "question": "Why does ice float on water?",
  "answer": {
    "final_answer": "Because ice is less dense than liquid water.",
    "explanation": "The molecular arrangement in solid water creates more space, lowering density; hence ice displaces less mass per volume.",
    "connections": "Related to density and hydrogen bonding concepts."
  }
}

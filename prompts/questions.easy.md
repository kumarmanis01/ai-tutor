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

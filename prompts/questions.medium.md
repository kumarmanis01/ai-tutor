Context: Include the contents of `prompts/base_context.md` with placeholders filled.
Chapter: {chapter_title}
Topic: {topic_title}
Difficulty: Medium

Task: Generate 8 medium-level questions with examples for "{topic_title}" for Grade {grade} students.

Requirements:
- Test application, comprehension, and analysis skills
- Require 2-3 steps of reasoning or calculation
- Questions should require students to apply concepts to new situations

Distribution:
- MCQs: 3
- Short Answer: 3
- Numerical/Problem-solving: 2

Output Format (JSON):
{
  "difficulty": "medium",
  "topic": "{topic_title}",
  "total_questions": 8,
  "questions": [ /* question objects as specified */ ]
}

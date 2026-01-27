Context: Include the contents of `prompts/base_context.md` with placeholders filled.
Chapter: {chapter_title}
Topic: {topic_title}
Difficulty: Hard

Task: Generate 5 hard-level questions with detailed examples for "{topic_title}" for Grade {grade} students.

Requirements:
- Test analysis, synthesis, evaluation, and critical thinking skills
- Require multi-step reasoning, integration of multiple concepts, or creative application

Distribution:
- Long Answer: 2
- Case Study/Application: 2
- Higher Order Thinking (HOTS): 1

Output Format (JSON):
{
  "difficulty": "hard",
  "topic": "{topic_title}",
  "total_questions": 5,
  "questions": [ /* question objects as specified */ ]
}

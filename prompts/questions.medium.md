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

Answer JSON Schema Examples (GENERAL / Guidance):

General answer object (for medium difficulty):
{
  "type": "short_answer" | "numeric" | "mcq",
  "question": "string",
  "options": ["string"] (for MCQ),
  "answer": {
    "final_answer": "string",
    "explanation": "string",
    "step_by_step": ["string"]
  }
}

Math-specific example (multi-step):
{
  "type": "numeric",
  "question": "Find the area of a triangle with base 10 cm and height 6 cm.",
  "answer": {
    "final_answer": "30 cm^2",
    "explanation": "Area = 1/2 * base * height",
    "step_by_step": ["1/2 * 10 * 6 = 30"]
  }
}

Science-specific example (explain & connect):
{
  "type": "short_answer",
  "question": "Explain how photosynthesis supports food chains.",
  "answer": {
    "final_answer": "Photosynthesis converts light energy into chemical energy stored in plants, forming the basis of most food chains.",
    "explanation": "Plants produce glucose which herbivores consume; energy flows up trophic levels.",
    "connections": "Connects to concepts of energy transfer and ecosystems."
  }
}

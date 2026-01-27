Context: Include the contents of `prompts/base_context.md` with placeholders filled.
Topic: {topic_title}
Current Content: [Existing notes or question]

Task: Generate 3 additional high-quality examples for the topic "{topic_title}" for Grade {grade} students.

Requirements:
- Generate examples of these types:
  1. Real-world application example
  2. Worked problem example
  3. Comparative example
- For each example provide: Title, Context, Example Content, Explanation, Student Application

Output Format (JSON):
{
  "topic": "{topic_title}",
  "examples": [ /* example objects as specified */ ]
}

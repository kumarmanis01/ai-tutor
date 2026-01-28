Context: Include the contents of `prompts/base_context.md` with placeholders filled.
Chapter: {chapter_title}

Task: Generate detailed topics/subtopics for the chapter "{chapter_title}" in {subject} for Grade {grade}.

Requirements:
- Break down the chapter into 6-10 specific topics
- Topics should progress from foundational to advanced concepts
- Each topic should be teachable in 1-3 class periods
- Include both conceptual understanding and application-based topics
- Align with {board} learning outcomes for this chapter
- Use student-friendly topic names

Output Format (JSON):
{
  "chapter": "{chapter_title}",
  "topics": [
    {
      "topic_number": 1,
      "topic_title": "Topic Name",
      "learning_objectives": ["Objective 1", "Objective 2"],
      "prerequisite_topics": ["Previous topic if any"],
      "key_concepts": ["Concept 1", "Concept 2"]
    }
  ]
}

Notes:
- Prefer explicit brief learning objectives per topic (1–3 items).
- Include `estimated_periods` optionally for pacing.

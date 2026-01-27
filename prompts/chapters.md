Context: Include the contents of `prompts/base_context.md` with placeholders filled.

Task: Generate a comprehensive list of chapters for {subject} for Grade {grade} following the {board} curriculum.

Requirements:
- List 8-12 major chapters that cover the entire academic year
- Each chapter should be a core topic from the official {board} syllabus
- Arrange chapters in logical teaching sequence (prerequisite concepts first)
- Use clear, concise chapter titles appropriate for {grade} level students
- Ensure coverage aligns with standard {board} learning objectives for Grade {grade}

Output Format (JSON):
{
  "chapters": [
    {
      "chapter_number": 1,
      "chapter_title": "Chapter Title",
      "brief_description": "One sentence overview",
      "estimated_weeks": 2
    }
  ]
}

Notes:
- Use deterministic sampling (low temperature). See `prompts/prompt_config.json` for recommended temperature.

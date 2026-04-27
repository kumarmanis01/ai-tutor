Context: Include the contents of `prompts/base_context.md` with placeholders filled.
Content Type: {content_type} (e.g., notes, questions, chapter, topic)
Topic: {topic_title}

Task: Review the following generated content and suggest improvements.

Checklist:
1. Example Quality:
   - Are there 3-5 examples where required?
   - Are examples age-appropriate?
   - Are examples factually accurate and curriculum-aligned?
   - Are examples diverse and inclusive?
2. Example Integration:
   - Are examples clearly labeled and formatted?
   - Do worked examples show complete step-by-step solutions?
   - Are examples connected to the concept being taught?
3. Educational Value:
   - Do examples progress from simple to complex?
   - Are real-world applications clear?
   - Will students understand how to apply the concept from these examples?
4. Accuracy Check:
   - Verify calculations, facts, and alignment with {board} curriculum
   - Check for cultural bias and insensitivity

Output:
- `issues_found`: list of short issues
- `suggested_improvements`: brief actionable items
- `enhanced_content` (optional): improved content when major fixes are needed

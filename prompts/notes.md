Context: Include the contents of `prompts/base_context.md` with placeholders filled.
Chapter: {chapter_title}
Topic: {topic_title}

Task: Create comprehensive, example-rich study notes for the topic "{topic_title}" suitable for Grade {grade} students.

Requirements:
- Write in {language} using age-appropriate vocabulary for Grade {grade}
- Structure: Introduction → Key Concepts → Detailed Explanations with Examples → Worked Examples → Practice Scenarios → Summary

Content Guidelines:
- Length: 400-800 words for elementary (K-5), 600-1200 words for middle school (6-8), 800-1500 words for high school (9-12)
- Include MINIMUM 3-5 examples throughout the notes:
  * Conceptual Examples: Real-world analogies to explain abstract concepts
  * Worked Examples: Step-by-step solutions showing the process (for Math, Science, etc.)
  * Practical Examples: How the concept applies in daily life
  * Visual Examples: Descriptions that help students visualize (mention diagrams, charts)
  * Comparative Examples: Show differences between similar concepts

Example Integration rules:
- For Math/Science: Include 2-3 fully solved problems with step-by-step working
- For Languages: Provide sentence examples, grammar usage examples, literature excerpts
- For Social Studies: Historical examples, case studies, timeline examples
- For younger grades (K-5): Use relatable situations (toys, family, school, playground)
- For older grades (9-12): Use relevant scenarios (technology, careers, global issues)

Formatting (Markdown):
# {topic_title}

## Introduction
[Engaging 2-3 sentence introduction with a relatable hook or question]

## Key Concepts
**[Concept Name]**: [Clear definition]

## Detailed Explanation

### [Sub-concept 1]
[Explanation paragraph]

**Example 1: [Example Title]**
[Detailed example with context and explanation]

**Worked Example: [Problem Statement]**
Step 1: [First step with explanation]
Step 2: [Second step with explanation]
Answer: [Clear answer]

## Practice Scenarios
[2-3 relatable scenarios where students can apply the concept]

## Summary
• [Key point 1 with brief example]
• [Key point 2 with brief example]

## Key Terms to Remember
GUARDRAILS (MANDATORY):

- You MUST return a single valid JSON object only. Do NOT include any markdown, headings, code fences, bullet lists, or explanatory text outside the JSON.
- Use double-quotes for all strings and valid JSON syntax. Do NOT include trailing commas.
- The JSON MUST strictly follow the schema below. Extra fields are allowed but avoid deeply nested arbitrary structures.
- If you cannot fulfil the schema, return an object with `"error": "<short explanation>"` and no other fields.

REQUIRED JSON SCHEMA (example types):

{
  "title": "string",
  "grade": number,
  "board": "string",
  "subject": "string",
  "topic": "string",
  "language": "string",
  "notes": "string",                         // Human-readable notes; may contain simple markdown like **bold** or _italic_
  "worked_examples": [                       // Array of solved problems
    {
      "problem": "string",
      "steps": ["string"],
      "answer": "string"
    }
  ],
  "practice_questions": [                     // Array of practice Q/A pairs
    {"question": "string", "answer": "string"}
  ],
  "key_terms": [{"term": "string", "definition": "string"}],
  "summary": "string"
}

Example valid minimal response:

{"title":"Introduction to Fractions","grade":6,"board":"CBSE","subject":"Mathematics","topic":"Introduction to Fractions","language":"en","notes":"Fractions represent parts of a whole...","worked_examples":[{"problem":"What is 1/2 of 10?","steps":["Interpret 1/2 as half","Compute 10 * 1/2 = 5"],"answer":"5"}],"practice_questions":[{"question":"What is 1/4 of 8?","answer":"2"}],"key_terms":[{"term":"numerator","definition":"Top part of a fraction"}],"summary":"Fractions represent parts of a whole and can be added, subtracted..."}

---

Context: Include the contents of `prompts/base_context.md` with placeholders filled.
Chapter: {chapter_title}
Topic: {topic_title}

Task: Create comprehensive, example-rich study notes for the topic "{topic_title}" suitable for Grade {grade} students.

Requirements:
- Write in {language} using age-appropriate vocabulary for Grade {grade}
- Structure: Introduction → Key Concepts → Detailed Explanations with Examples → Worked Examples → Practice Scenarios → Summary

Content Guidelines:
- Length: 400-800 words for elementary (K-5), 600-1200 words for middle school (6-8), 800-1500 words for high school (9-12)
- Include MINIMUM 3-5 examples throughout the notes:
  * Conceptual Examples: Real-world analogies to explain abstract concepts
  * Worked Examples: Step-by-step solutions showing the process (for Math, Science, etc.)
  * Practical Examples: How the concept applies in daily life
  * Visual Examples: Descriptions that help students visualize (mention diagrams, charts)
  * Comparative Examples: Show differences between similar concepts

Example Integration rules:
- For Math/Science: Include 2-3 fully solved problems with step-by-step working
- For Languages: Provide sentence examples, grammar usage examples, literature excerpts
- For Social Studies: Historical examples, case studies, timeline examples
- For younger grades (K-5): Use relatable situations (toys, family, school, playground)
- For older grades (9-12): Use relevant scenarios (technology, careers, global issues)

Formatting (Markdown is allowed inside the `notes` field only):
# {topic_title}

## Introduction
[Engaging 2-3 sentence introduction with a relatable hook or question]

## Key Concepts
**[Concept Name]**: [Clear definition]

## Detailed Explanation

### [Sub-concept 1]
[Explanation paragraph]

**Example 1: [Example Title]**
[Detailed example with context and explanation]

**Worked Example: [Problem Statement]**
Step 1: [First step with explanation]
Step 2: [Second step with explanation]
Answer: [Clear answer]

## Practice Scenarios
[2-3 relatable scenarios where students can apply the concept]

## Summary
• [Key point 1 with brief example]
• [Key point 2 with brief example]

## Key Terms to Remember
- **[Term]**: [Definition]

## Real-World Applications
[1-2 sentences on where this topic is used in real life with examples]

Quality Standards:
- Examples must be factually accurate and curriculum-aligned
- Use diverse, inclusive examples
- Avoid stereotypes or culturally insensitive content

Notes:
- Use moderate creativity (temperature suggested in `prompts/prompt_config.json`).

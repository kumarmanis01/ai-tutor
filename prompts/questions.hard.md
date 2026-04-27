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

Answer JSON Schema Examples (HARD / Guidance):

General advanced answer object:
{
  "type": "long_answer" | "case_study",
  "question": "string",
  "answer": {
    "final_answer": "string",
    "explanation": "string",
    "step_by_step": ["string"],
    "extensions": "string" // suggestions for deeper exploration or variations
  }
}

Math advanced example (derivation/proof style):
{
  "type": "long_answer",
  "question": "Prove that the sum of interior angles of a triangle is 180 degrees.",
  "answer": {
    "final_answer": "180 degrees",
    "explanation": "Detailed geometric proof using parallel lines and alternate interior angles.",
    "step_by_step": ["Draw a line parallel to one side...","Use alternate interior angles...","Conclude sum is 180°"],
    "extensions": "Ask students to generalize to polygons."
  }
}

Science advanced example (mechanism + evidence):
{
  "type": "case_study",
  "question": "Analyze the evidence for plate tectonics in the Indian Ocean region.",
  "answer": {
    "final_answer": "Plate tectonics explains observed seafloor spreading and matching fossil records.",
    "explanation": "Present seismic, magnetic striping, and fossil distribution evidence.",
    "step_by_step": ["Describe magnetic anomalies","Explain seafloor age progression","Link to continental drift"],
    "extensions": "Suggest field-data based activities or simulation experiments."
  }
}

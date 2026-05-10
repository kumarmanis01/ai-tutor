Yes — images/diagrams are critical for classroom fidelity. And yes, Claude via the API can generate and execute these prompts **completely autonomously** — no involvement from me at runtime.

Let me give you the full production-grade architecture:Now let me build the full architecture diagram and the production prompt structure:Yes — Claude via API operates **fully autonomously** at runtime. You build the prompt once; Claude generates everything — prose, SVGs, image generation prompts, formulas — no human in the loop.

Here's the complete production-grade architecture:
docs\v2\notes_generation_pipeline.svg
docs\v2\Screenshot 2026-05-10 112011.png



## 1. System Prompt

```
You are Vidya, a master Indian classroom teacher (CBSE/ICSE).
You generate structured notes that feel, sound, and render identically
to a real teacher explaining a topic live in class.

You ALWAYS respond with a single valid JSON object.
No markdown fences. No preamble. No trailing text. JSON only.

You generate:
- Conversational teacher prose (never textbook tone)
- Inline SVG diagrams (self-contained, dark-mode safe, 680px viewBox)
- Image generation prompts (for DALL-E/Imagen downstream)
- LaTeX formulas
- Blackboard summary lines
- Concept checks with answers
```

---

## 2. Full JSON Output Schema

```typescript
interface GeneratedNotes {
  metadata: NoteMetadata;
  sections: NoteSection[];
  keyConcepts: KeyConcept[];
  examTips: string[];
  memoryAids: MemoryAid[];
  bridgeToNext: string;
  qualitySignals: QualitySignals;
}

// ─── Metadata ───────────────────────────────────────────────
interface NoteMetadata {
  board: 'CBSE' | 'ICSE';
  grade: number;
  subject: string;
  chapter: string;
  topic: string;
  subtopic?: string;
  estimatedReadMinutes: number;
  difficultyLevel: 'foundation' | 'standard' | 'advanced';
  conceptsIntroduced: string[];
  prerequisiteTopics: string[];
  generatedAt: string; // ISO timestamp
}

// ─── Section (the core unit) ─────────────────────────────────
type SectionType =
  | 'hook'            // real-world story anchor
  | 'concept'         // main theory explanation
  | 'worked_example'  // solved problem with commentary
  | 'visual'          // diagram or image (standalone)
  | 'analogy'         // teacher's creative comparison
  | 'concept_check'   // embedded formative question
  | 'common_mistake'  // explicit wrong → right correction
  | 'memory_aid'      // mnemonic, rhyme, trick
  | 'summary';        // end-of-class recap

interface NoteSection {
  id: string;               // uuid
  type: SectionType;
  order: number;
  title: string;

  // Teacher voice prose — written as if speaking live
  content: string;

  // Key points exactly as a teacher writes on a blackboard
  blackboardLines: string[];

  // ── Visual block (present in 'visual' type OR alongside any section) ──
  visuals: Visual[];

  // ── For 'worked_example' type ──
  exampleMeta?: ExampleMeta;
  steps?: ExampleStep[];

  // ── For 'concept_check' type ──
  conceptCheck?: ConceptCheck;

  // ── For 'common_mistake' type ──
  commonMistake?: CommonMistake;

  // ── Formula (any section that introduces one) ──
  formulaLatex?: string;    // KaTeX-compatible
  formulaExplained?: string; // plain english breakdown of each symbol
}

// ─── Visual ─────────────────────────────────────────────────
type VisualType =
  | 'svg_diagram'       // Claude generates full inline SVG
  | 'image_prompt'      // Claude writes DALL-E prompt; you call DALL-E
  | 'table'             // structured data as JSON rows/cols
  | 'number_line'       // special case for math
  | 'graph_description'; // Claude describes axes; you render with recharts/d3

interface Visual {
  id: string;
  type: VisualType;
  title: string;
  teacherIntro: string;     // "Look at this diagram — notice how..."
  teacherExplain: string;   // spoken walkthrough of what student should observe

  // For svg_diagram: complete self-contained SVG string
  // 680px viewBox, dark-mode safe CSS vars, no external deps
  svgContent?: string;

  // For image_prompt: detailed DALL-E prompt
  imagePrompt?: string;
  imageStyle?: 'diagram' | 'realistic' | 'illustration' | 'infographic';
  imageAltText?: string;    // accessibility

  // For table
  tableHeaders?: string[];
  tableRows?: string[][];

  // For graph_description
  graphSpec?: {
    type: 'line' | 'bar' | 'scatter' | 'pie';
    xAxis: string;
    yAxis: string;
    datasets: { label: string; points: [number, number][] }[];
  };

  // Placement hint for renderer
  placement: 'inline' | 'full_width' | 'sidebar';
}

// ─── Worked Example ──────────────────────────────────────────
interface ExampleMeta {
  difficulty: 'easy' | 'medium' | 'exam_style';
  label: string;          // "Example 1 (Easy)"
  problem: string;        // the question text
  problemLatex?: string;
}

interface ExampleStep {
  stepNumber: number;
  expression: string;         // what's written on board at this step
  expressionLatex?: string;
  teacherComment: string;     // "See what we did? We isolated x here..."
  isCommonMistakePoint: boolean;
  mistakeWarning?: string;    // shown if isCommonMistakePoint = true
}

// ─── Concept Check ───────────────────────────────────────────
interface ConceptCheck {
  question: string;
  questionLatex?: string;
  hint: string;
  answer: string;
  answerLatex?: string;
}

// ─── Common Mistake ──────────────────────────────────────────
interface CommonMistake {
  wrongApproach: string;
  wrongResult: string;
  whyItsFailed: string;
  correctApproach: string;
  correctResult: string;
}

// ─── Supporting Types ────────────────────────────────────────
interface KeyConcept {
  term: string;
  definitionFormal: string;
  definitionSimple: string;  // "basically, what this means is..."
  formulaLatex?: string;
  visualId?: string;         // reference to a Visual by id
}

interface MemoryAid {
  type: 'mnemonic' | 'rhyme' | 'acronym' | 'story' | 'trick';
  content: string;
  appliesTo: string;         // which concept/formula this helps remember
}

interface QualitySignals {
  workedExampleCount: number;
  visualCount: number;
  conceptCheckCount: number;
  commonMistakeCount: number;
  estimatedWordCount: number;
  sectionTypes: SectionType[];
}
```

---

## 3. User Prompt Template

```typescript
function buildNotesPrompt(ctx: NotesContext): string {
  return `
Generate complete classroom-style teaching notes as a single JSON object
matching the schema you were given.

=== CONTEXT ===
Board: ${ctx.board} | Grade: ${ctx.grade} | Subject: ${ctx.subject}
Chapter: ${ctx.chapter} | Topic: ${ctx.topic}
Difficulty: ${ctx.difficulty} | Age range: ${ctx.ageRange}
Prior knowledge confirmed: ${ctx.priorTopics.join(', ')}
Exam pattern: ${ctx.board === 'CBSE' ? 'NCERT + 3/5 mark board questions' : 'ICSE structured answer'}

=== MANDATORY SECTION SEQUENCE ===
1. hook          — Real-world Indian story (cricket, chai, mobile data, auto fare)
2. concept       — Core theory. Teacher voice. Build from intuition → formal definition.
3. visual        — SVG diagram OR image_prompt that makes the concept visible.
                   For EVERY diagram: include teacherIntro and teacherExplain
                   as the teacher would say while pointing at it on screen.
4. analogy       — One creative comparison the student will never forget.
5. worked_example (easy)    — Full step-by-step. Every step has a teacherComment.
6. worked_example (medium)  — Slightly harder. Flag common mistake points.
7. concept_check — "Before we move on..." quick oral question with answer.
8. common_mistake — Show WRONG approach first, then correct it with reasoning.
9. worked_example (exam_style) — Board-exam format. Show marking scheme logic.
10. memory_aid   — Mnemonic, acronym, or rhyme for the key formula/rule.
11. summary      — Bullet recap. "What you MUST remember." Bridge to next topic.

=== VISUAL GENERATION RULES ===
SVG diagrams (type: svg_diagram):
- Self-contained SVG string. viewBox="0 0 680 H". No external deps.
- Use CSS vars: --color-text-primary, --color-background-secondary etc.
- Dark-mode safe. 14px labels (class="th"), 12px subtitles (class="ts").
- Include arrow marker in <defs>. rx=8 for boxes.
- Teacher draws this on a projector — make it clean and instructive.
- Add onclick="sendPrompt('...')" on key elements for student interactivity.

Image prompts (type: image_prompt):
- Write for DALL-E-3 quality: specific, detailed, style-directed.
- Format: "Educational diagram style, clean white background, [description].
  Labeled, suitable for a Grade ${ctx.grade} ${ctx.subject} textbook."
- Use for: real-world objects, biological structures, physical apparatus,
  geographic features, historical scenes — anything SVG cannot convey well.

=== TEACHER VOICE RULES ===
- Always "we", "you", "let's" — never third-person academic.
- Think aloud: "Hmm, so what do we know so far?"
- Rhetorical questions mid-explanation: "But wait — what if x were negative here?"
- Flag key moments: "This is the part that always comes in the board exam."
- Celebrate correct steps: "Excellent! See how that simplified cleanly?"
- Warn before tricky parts: "Now here's where students usually slip up..."

=== FORMULA RULES ===
- Every formula: formulaLatex (KaTeX) + formulaExplained (plain English per symbol).
- Example: formulaExplained: "v = final velocity, u = initial velocity, 
  a = acceleration (how fast speed is changing), t = time elapsed"

=== QUALITY MINIMUMS ===
workedExampleCount >= 3
visualCount >= 2            (at least 1 svg_diagram + 1 image_prompt)
conceptCheckCount >= 1
commonMistakeCount >= 1
Every worked example step must have a non-empty teacherComment.
summary.blackboardLines >= 5

Generate now. JSON only.
`.trim();
}
```

---

## 4. Autonomous Runtime — No Claude Involvement

```typescript
// services/notes-generator.service.ts
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const client = new Anthropic(); // uses ANTHROPIC_API_KEY from env

export class NotesGeneratorService {

  async generate(ctx: NotesContext): Promise<GeneratedNotes> {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',        // or sonnet-4-5 for cost/speed tradeoff
      max_tokens: 8192,
      system: SYSTEM_PROMPT,           // your system prompt string
      messages: [
        { role: 'user', content: buildNotesPrompt(ctx) }
      ]
    });

    const raw = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const parsed = this.parseAndValidate(raw);
    await this.generateImages(parsed);   // fire DALL-E for image_prompts
    await this.persist(parsed, ctx);     // Prisma upsert

    return parsed;
  }

  private parseAndValidate(raw: string): GeneratedNotes {
    const clean = raw.replace(/```json|```/g, '').trim();
    const json = JSON.parse(clean);
    return GeneratedNotesSchema.parse(json); // Zod throws if contract broken
  }

  private async generateImages(notes: GeneratedNotes): Promise<void> {
    const imageVisuals = notes.sections
      .flatMap(s => s.visuals)
      .filter(v => v.type === 'image_prompt' && v.imagePrompt);

    await Promise.all(imageVisuals.map(async (visual) => {
      const img = await openai.images.generate({
        model: 'dall-e-3',
        prompt: visual.imagePrompt!,
        size: '1024x768',
        quality: 'standard'
      });
      visual.generatedImageUrl = img.data[0].url;
    }));
  }

  private async persist(notes: GeneratedNotes, ctx: NotesContext) {
    await prisma.topicNotes.upsert({
      where: { board_grade_subject_topic: ctx },
      create: { ...ctx, content: notes, generatedAt: new Date() },
      update: { content: notes, updatedAt: new Date() }
    });
  }
}
```

---

## 5. Key Design Decisions

| Decision | Rationale |
|---|---|
| `svg_diagram` vs `image_prompt` split | SVG for abstract/math/flow; DALL-E for real-world objects. Claude generates both. |
| `teacherIntro` + `teacherExplain` on every visual | Renderer speaks these as captions — visuals never sit mute |
| `formulaExplained` alongside LaTeX | Students read English, not LaTeX. Both are required. |
| `isCommonMistakePoint` on each step | Frontend can auto-highlight danger zones without parsing prose |
| `QualitySignals` block | Your BullMQ worker validates this before persisting — auto-retry if gates fail |
| `graphSpec` for recharts/d3 | Claude provides data structure; your renderer owns the charting library |
| Separate `imagePrompt` type | Keeps Claude's token budget on prose/SVG; DALL-E handles photorealism |

Claude is **completely autonomous** here — you call the API, it returns fully formed notes with embedded SVGs, DALL-E prompts, LaTeX, and all metadata. You validate, persist, and render. Zero human involvement at runtime.


/**
 * FILE OBJECTIVE:
 * - Day-1 Task Generator logic.
 * - Generate VERY EASY tasks for Day-1.
 * - Difficulty = grade - 2 (MANDATORY).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/day1/taskGenerator.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | copilot | created Day-1 task generator
 */

import {
  Day1Task,
  Day1Example,
  Day1Question,
  Day1ParentMessage,
  DAY1_RULES,
  PARENT_MESSAGE_TEMPLATE_HI,
  PARENT_MESSAGE_TEMPLATE_EN,
} from '../../components/Day1/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Subject type for Day-1 tasks
 */
export type Day1Subject = 'math' | 'hindi' | 'english';

/**
 * Task generation options
 */
export interface Day1TaskOptions {
  readonly studentId: string;
  readonly studentName: string;
  readonly grade: number;
  readonly subject: Day1Subject;
  readonly language: 'en' | 'hi';
}

// ============================================================================
// DIFFICULTY CALCULATION (CRITICAL)
// ============================================================================

/**
 * Calculate Day-1 effective difficulty
 * 
 * RULE: Difficulty MUST be at least 2 levels below grade
 * Example: Grade 5 student → Difficulty level 3 or lower
 */
export function calculateDay1Difficulty(grade: number): number {
  const effectiveDifficulty = grade + DAY1_RULES.DIFFICULTY_OFFSET;
  // Never go below grade 1
  return Math.max(1, effectiveDifficulty);
}

/**
 * Validate that task difficulty follows Day-1 rules
 */
export function validateDay1Difficulty(grade: number, taskDifficulty: number): boolean {
  const maxAllowedDifficulty = grade + DAY1_RULES.DIFFICULTY_OFFSET;
  return taskDifficulty <= maxAllowedDifficulty;
}

// ============================================================================
// EXAMPLE GENERATORS (Subject-specific)
// ============================================================================

/**
 * Math examples by difficulty level
 */
const MATH_EXAMPLES: Record<number, Day1Example[]> = {
  1: [
    {
      problem: '2 + 3 = ?',
      solution: '5',
      explanation: 'Do ungliyaan aur teen ungliyaan milaao = paanch',
    },
  ],
  2: [
    {
      problem: '5 + 7 = ?',
      solution: '12',
      explanation: 'Paanch mein saat jodo = baarah',
    },
  ],
  3: [
    {
      problem: '1/2 + 1/2 = ?',
      solution: '1',
      explanation: 'Aadha aur aadha milaao = ek poora',
    },
  ],
  4: [
    {
      problem: '1/4 + 1/4 = ?',
      solution: '1/2 (aadha)',
      explanation: 'Chauthai aur chauthai = aadha',
    },
  ],
  5: [
    {
      problem: '0.5 + 0.5 = ?',
      solution: '1.0',
      explanation: 'Point paanch aur point paanch = ek',
    },
  ],
};

/**
 * Get example for given difficulty and subject
 */
function getExample(subject: Day1Subject, difficulty: number): Day1Example {
  if (subject === 'math') {
    const examples = MATH_EXAMPLES[difficulty] || MATH_EXAMPLES[1];
    return examples[0];
  }
  
  // Fallback example
  return {
    problem: 'Simple example',
    solution: 'Simple answer',
    explanation: 'Easy explanation',
  };
}

// ============================================================================
// QUESTION GENERATORS (Subject-specific)
// ============================================================================

/**
 * Math questions by difficulty level (VERY EASY)
 */
const MATH_QUESTIONS: Record<number, Day1Question[]> = {
  1: [
    {
      questionId: 'math-d1-q1',
      text: '1 + 1 = ?',
      options: ['1', '2', '3', '4'],
      correctIndex: 1,
      hint: 'Ek ungli aur ek ungli = ?',
    },
    {
      questionId: 'math-d1-q2',
      text: '2 + 2 = ?',
      options: ['2', '3', '4', '5'],
      correctIndex: 2,
      hint: 'Do aur do = ?',
    },
  ],
  2: [
    {
      questionId: 'math-d2-q1',
      text: '3 + 4 = ?',
      options: ['6', '7', '8', '9'],
      correctIndex: 1,
      hint: 'Teen aur chaar = ?',
    },
    {
      questionId: 'math-d2-q2',
      text: '5 + 5 = ?',
      options: ['8', '9', '10', '11'],
      correctIndex: 2,
      hint: 'Paanch aur paanch = ?',
    },
  ],
  3: [
    {
      questionId: 'math-d3-q1',
      text: '1/2 ka matlab kya hai?',
      options: ['Poora', 'Aadha', 'Chauthai', 'Do guna'],
      correctIndex: 1,
      hint: 'Aadha = half',
    },
    {
      questionId: 'math-d3-q2',
      text: '10 + 10 = ?',
      options: ['10', '15', '20', '25'],
      correctIndex: 2,
      hint: 'Das aur das = ?',
    },
  ],
  4: [
    {
      questionId: 'math-d4-q1',
      text: '1/4 + 1/4 = ?',
      options: ['1/4', '1/2', '3/4', '1'],
      correctIndex: 1,
      hint: 'Do chauthai milaao',
    },
    {
      questionId: 'math-d4-q2',
      text: '25 + 25 = ?',
      options: ['40', '45', '50', '55'],
      correctIndex: 2,
      hint: 'Pachees aur pachees = ?',
    },
  ],
  5: [
    {
      questionId: 'math-d5-q1',
      text: '0.1 + 0.1 = ?',
      options: ['0.1', '0.2', '0.3', '1.0'],
      correctIndex: 1,
      hint: 'Point ek aur point ek = ?',
    },
    {
      questionId: 'math-d5-q2',
      text: '100 - 50 = ?',
      options: ['25', '50', '75', '100'],
      correctIndex: 1,
      hint: 'Sau mein se pachaas ghataao',
    },
  ],
};

/**
 * Get questions for given difficulty
 */
function getQuestions(subject: Day1Subject, difficulty: number, count: number): Day1Question[] {
  if (subject === 'math') {
    const questions = MATH_QUESTIONS[difficulty] || MATH_QUESTIONS[1];
    return questions.slice(0, Math.min(count, DAY1_RULES.MAX_QUESTIONS));
  }
  
  // Fallback questions
  return [{
    questionId: 'fallback-q1',
    text: 'Simple question',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    hint: 'Think simple',
  }];
}

// ============================================================================
// MAIN TASK GENERATOR
// ============================================================================

/**
 * Generate Day-1 task for student
 * 
 * Rules (FROZEN):
 * - Difficulty MUST be at least 2 levels below grade
 * - Task MUST be solvable in <15 minutes
 * - Show example BEFORE asking question
 * - No trick questions
 */
export function generateDay1Task(options: Day1TaskOptions): Day1Task {
  const { studentName: _studentName, grade, subject, language } = options;
  
  // Calculate difficulty (MUST be grade - 2 or lower)
  const difficulty = calculateDay1Difficulty(grade);
  
  // Get example (shown before questions)
  const example = getExample(subject, difficulty);
  
  // Get very easy questions (max 3)
  const questions = getQuestions(subject, difficulty, 2);
  
  // Generate task title based on subject
  const taskTitle = language === 'hi'
    ? getTaskTitleHindi(subject)
    : getTaskTitleEnglish(subject);
  
  return {
    taskId: `day1-${options.studentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: taskTitle,
    estimatedMinutes: 10,
    example,
    questions,
  };
}

/**
 * Get task title in Hindi
 */
function getTaskTitleHindi(subject: Day1Subject): string {
  switch (subject) {
    case 'math':
      return 'Ek simple math sawaal aur 2 chhote questions';
    case 'hindi':
      return 'Ek aasan Hindi padhan aur 2 chhote sawaal';
    case 'english':
      return 'Ek simple English reading aur 2 small questions';
    default:
      return 'Aaj ka chhota sa kaam';
  }
}

/**
 * Get task title in English
 */
function getTaskTitleEnglish(subject: Day1Subject): string {
  switch (subject) {
    case 'math':
      return 'One simple math example and 2 small questions';
    case 'hindi':
      return 'One easy Hindi reading and 2 small questions';
    case 'english':
      return 'One simple English reading and 2 small questions';
    default:
      return 'Today\'s small task';
  }
}

// ============================================================================
// PARENT MESSAGE GENERATOR
// ============================================================================

/**
 * Generate Day-1 parent message
 * 
 * Rules (FROZEN):
 * - Do not promise results
 * - Do not compare with others
 * - Reassure, don't excite
 * - Length: <60 words
 */
export function generateDay1ParentMessage(
  childName: string,
  language: 'en' | 'hi'
): Day1ParentMessage {
  const message = language === 'hi'
    ? PARENT_MESSAGE_TEMPLATE_HI(childName)
    : PARENT_MESSAGE_TEMPLATE_EN(childName);
  
  return {
    childName,
    message,
    language,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate parent message follows Day-1 rules
 */
export function validateParentMessage(message: string): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  
  // Check for banned words/phrases
  const bannedPhrases = [
    'topper', 'first rank', 'best', 'competition',
    'other students', 'compare', 'performance', 'score',
    'percentage', 'marks', '100%', 'perfect'
  ];
  
  const lowerMessage = message.toLowerCase();
  bannedPhrases.forEach(phrase => {
    if (lowerMessage.includes(phrase)) {
      violations.push(`Contains banned phrase: "${phrase}"`);
    }
  });
  
  // Check word count (<60 words)
  const wordCount = message.split(/\s+/).length;
  if (wordCount > 60) {
    violations.push(`Message too long: ${wordCount} words (max 60)`);
  }
  
  return {
    valid: violations.length === 0,
    violations,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const Day1TaskGenerator = {
  generateTask: generateDay1Task,
  generateParentMessage: generateDay1ParentMessage,
  calculateDifficulty: calculateDay1Difficulty,
  validateDifficulty: validateDay1Difficulty,
  validateParentMessage,
};

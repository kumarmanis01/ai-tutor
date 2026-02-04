/**
 * FILE OBJECTIVE:
 * - Adaptive question flow engine for diagnostic.
 * - Stops early if confidence is clear.
 * - Never uses test-like language.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/diagnostic/engine.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created diagnostic engine
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DiagnosticDifficulty,
  DiagnosticQuestionType,
  CognitiveSkill,
  getDiagnosticConfig,
  type DiagnosticQuestion,
  type DiagnosticResponse,
  type DiagnosticSession,
  type DiagnosticOutput,
  type DiagnosticConfig,
} from './schemas';

// ============================================================================
// QUESTION BANK INTERFACE
// ============================================================================

/**
 * Interface for question bank (to be implemented with real data).
 */
export interface QuestionBank {
  getQuestion(params: {
    grade: number;
    subject: string;
    difficulty: DiagnosticDifficulty;
    skill?: CognitiveSkill;
    excludeIds?: string[];
  }): DiagnosticQuestion | null;
  
  getQuestionsByTopic(params: {
    grade: number;
    subject: string;
    topic: string;
    difficulty: DiagnosticDifficulty;
    excludeIds?: string[];
  }): DiagnosticQuestion[];
}

// ============================================================================
// ADAPTIVE ENGINE STATE
// ============================================================================

interface AdaptiveState {
  /** Current difficulty level */
  currentDifficulty: DiagnosticDifficulty;
  /** Consecutive correct answers */
  consecutiveCorrect: number;
  /** Consecutive incorrect answers */
  consecutiveIncorrect: number;
  /** Total correct */
  totalCorrect: number;
  /** Total attempted */
  totalAttempted: number;
  /** Questions asked */
  questionsAsked: DiagnosticQuestion[];
  /** Responses received */
  responses: DiagnosticResponse[];
  /** Confidence in student level (0-1) */
  confidenceLevel: number;
  /** Skill scores */
  skillScores: Record<CognitiveSkill, { correct: number; total: number }>;
  /** Topic scores */
  topicScores: Record<string, { correct: number; total: number }>;
}

// ============================================================================
// DIAGNOSTIC SESSION CLASS
// ============================================================================

/**
 * Manages an adaptive diagnostic session.
 */
export class DiagnosticEngine {
  private sessionId: string;
  private grade: number;
  private subject: string;
  private config: DiagnosticConfig;
  private state: AdaptiveState;
  private questionBank: QuestionBank;
  private startTime: Date;
  
  constructor(
    grade: number,
    subject: string,
    questionBank: QuestionBank,
    board?: string
  ) {
    this.sessionId = uuidv4();
    this.grade = grade;
    this.subject = subject;
    this.config = getDiagnosticConfig(grade);
    this.questionBank = questionBank;
    this.startTime = new Date();
    
    this.state = {
      currentDifficulty: this.config.startDifficulty,
      consecutiveCorrect: 0,
      consecutiveIncorrect: 0,
      totalCorrect: 0,
      totalAttempted: 0,
      questionsAsked: [],
      responses: [],
      confidenceLevel: 0,
      skillScores: {
        [CognitiveSkill.RECALL]: { correct: 0, total: 0 },
        [CognitiveSkill.COMPREHENSION]: { correct: 0, total: 0 },
        [CognitiveSkill.APPLICATION]: { correct: 0, total: 0 },
        [CognitiveSkill.ANALYSIS]: { correct: 0, total: 0 },
      },
      topicScores: {},
    };
  }
  
  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================
  
  /**
   * Get the next question to ask.
   * Returns null if diagnostic should end.
   */
  getNextQuestion(): DiagnosticQuestion | null {
    // Check termination conditions
    if (this.shouldTerminate()) {
      return null;
    }
    
    // Get question at current difficulty
    const excludeIds = this.state.questionsAsked.map(q => q.id);
    const question = this.questionBank.getQuestion({
      grade: this.grade,
      subject: this.subject,
      difficulty: this.state.currentDifficulty,
      excludeIds,
    });
    
    if (question) {
      this.state.questionsAsked.push(question);
    }
    
    return question;
  }
  
  /**
   * Process a student's response.
   */
  processResponse(response: DiagnosticResponse): {
    isCorrect: boolean;
    shouldContinue: boolean;
    feedback?: string;
  } {
    const question = this.state.questionsAsked.find(q => q.id === response.questionId);
    if (!question) {
      throw new Error(`Question ${response.questionId} not found in session`);
    }
    
    this.state.responses.push(response);
    
    // Handle skipped questions
    if (response.skipped) {
      this.state.consecutiveCorrect = 0;
      this.adjustDifficultyDown();
      return {
        isCorrect: false,
        shouldContinue: !this.shouldTerminate(),
        feedback: this.getEncouragingFeedback(false, true),
      };
    }
    
    // Check answer
    const isCorrect = this.checkAnswer(question, response);
    
    // Update state
    this.state.totalAttempted++;
    if (isCorrect) {
      this.state.totalCorrect++;
      this.state.consecutiveCorrect++;
      this.state.consecutiveIncorrect = 0;
    } else {
      this.state.consecutiveIncorrect++;
      this.state.consecutiveCorrect = 0;
    }
    
    // Update skill and topic scores
    this.updateScores(question, isCorrect);
    
    // Adapt difficulty
    this.adaptDifficulty(isCorrect, response.hintRequested);
    
    // Update confidence
    this.updateConfidence();
    
    return {
      isCorrect,
      shouldContinue: !this.shouldTerminate(),
      feedback: this.getEncouragingFeedback(isCorrect, false),
    };
  }
  
  /**
   * Complete the diagnostic and get results.
   */
  complete(): DiagnosticOutput {
    const session = this.getSession();
    return this.calculateOutput(session);
  }
  
  /**
   * Get current session state.
   */
  getSession(): DiagnosticSession {
    const now = new Date();
    return {
      sessionId: this.sessionId,
      grade: this.grade,
      subject: this.subject,
      questions: this.state.questionsAsked,
      responses: this.state.responses,
      startedAt: this.startTime.toISOString(),
      completedAt: now.toISOString(),
      terminatedEarly: this.shouldTerminateEarly(),
      terminationReason: this.getTerminationReason(),
    };
  }
  
  /**
   * Get framing text (NO test language!).
   */
  getFramingText(): string {
    return this.config.framingText;
  }
  
  /**
   * Get current progress for UI.
   */
  getProgress(): {
    questionsAnswered: number;
    totalQuestions: number;
    progressPercent: number;
  } {
    return {
      questionsAnswered: this.state.responses.length,
      totalQuestions: this.config.maxQuestions,
      progressPercent: (this.state.responses.length / this.config.maxQuestions) * 100,
    };
  }
  
  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================
  
  private checkAnswer(question: DiagnosticQuestion, response: DiagnosticResponse): boolean {
    if (question.type === DiagnosticQuestionType.MCQ || 
        question.type === DiagnosticQuestionType.TRUE_FALSE) {
      const correctOption = question.options?.find(o => o.isCorrect);
      return response.selectedOptionId === correctOption?.id;
    }
    
    if (question.type === DiagnosticQuestionType.FILL_BLANK ||
        question.type === DiagnosticQuestionType.NUMERIC) {
      const answer = response.textAnswer?.trim().toLowerCase();
      const correct = question.correctAnswer?.toLowerCase();
      const acceptable = question.acceptableAnswers?.map(a => a.toLowerCase());
      
      return answer === correct || (acceptable?.includes(answer || '') ?? false);
    }
    
    return false;
  }
  
  private updateScores(question: DiagnosticQuestion, isCorrect: boolean): void {
    // Update skill scores
    const skill = question.skill;
    this.state.skillScores[skill].total++;
    if (isCorrect) {
      this.state.skillScores[skill].correct++;
    }
    
    // Update topic scores
    const topic = question.topic;
    if (!this.state.topicScores[topic]) {
      this.state.topicScores[topic] = { correct: 0, total: 0 };
    }
    this.state.topicScores[topic].total++;
    if (isCorrect) {
      this.state.topicScores[topic].correct++;
    }
  }
  
  private adaptDifficulty(isCorrect: boolean, hintUsed: boolean): void {
    // Increase difficulty if doing well
    if (this.state.consecutiveCorrect >= 2 && !hintUsed) {
      this.adjustDifficultyUp();
    }
    
    // Decrease difficulty if struggling
    if (this.state.consecutiveIncorrect >= 2 || (this.state.consecutiveIncorrect >= 1 && hintUsed)) {
      this.adjustDifficultyDown();
    }
  }
  
  private adjustDifficultyUp(): void {
    const order = [
      DiagnosticDifficulty.FOUNDATION,
      DiagnosticDifficulty.BASIC,
      DiagnosticDifficulty.INTERMEDIATE,
      DiagnosticDifficulty.ADVANCED,
      DiagnosticDifficulty.CHALLENGE,
    ];
    
    const currentIndex = order.indexOf(this.state.currentDifficulty);
    if (currentIndex < order.length - 1) {
      this.state.currentDifficulty = order[currentIndex + 1];
    }
  }
  
  private adjustDifficultyDown(): void {
    const order = [
      DiagnosticDifficulty.FOUNDATION,
      DiagnosticDifficulty.BASIC,
      DiagnosticDifficulty.INTERMEDIATE,
      DiagnosticDifficulty.ADVANCED,
      DiagnosticDifficulty.CHALLENGE,
    ];
    
    const currentIndex = order.indexOf(this.state.currentDifficulty);
    if (currentIndex > 0) {
      this.state.currentDifficulty = order[currentIndex - 1];
    }
  }
  
  private updateConfidence(): void {
    // Confidence increases when we can clearly categorize student level
    const accuracy = this.state.totalCorrect / Math.max(this.state.totalAttempted, 1);
    const questionsAnswered = this.state.totalAttempted;
    
    // High accuracy with many questions = confident they're advanced
    // Low accuracy with many questions = confident they need basics
    // Mixed results = less confident
    
    const extremeAccuracy = accuracy > 0.85 || accuracy < 0.35;
    const consistentPerformance = this.state.consecutiveCorrect >= 3 || this.state.consecutiveIncorrect >= 3;
    
    if (questionsAnswered >= 3) {
      if (extremeAccuracy || consistentPerformance) {
        this.state.confidenceLevel = Math.min(this.state.confidenceLevel + 0.2, 1);
      } else {
        this.state.confidenceLevel = Math.min(this.state.confidenceLevel + 0.1, 0.8);
      }
    }
  }
  
  private shouldTerminate(): boolean {
    // Min questions not met
    if (this.state.totalAttempted < this.config.minQuestions) {
      return false;
    }
    
    // Max questions reached
    if (this.state.totalAttempted >= this.config.maxQuestions) {
      return true;
    }
    
    // High confidence in level
    if (this.state.confidenceLevel >= 0.85) {
      return true;
    }
    
    return false;
  }
  
  private shouldTerminateEarly(): boolean {
    return this.state.totalAttempted < this.config.maxQuestions && 
           this.state.confidenceLevel >= 0.85;
  }
  
  private getTerminationReason(): DiagnosticSession['terminationReason'] {
    if (this.state.confidenceLevel >= 0.85 && this.state.totalAttempted < this.config.maxQuestions) {
      return 'CONFIDENCE_CLEAR';
    }
    return undefined;
  }
  
  private getEncouragingFeedback(isCorrect: boolean, skipped: boolean): string {
    // Always encouraging, never critical
    if (skipped) {
      const skipMessages = [
        "No worries! Let's try another one.",
        "That's okay, let's move on!",
        "Let's see a different question.",
      ];
      return skipMessages[Math.floor(Math.random() * skipMessages.length)];
    }
    
    if (isCorrect) {
      const correctMessages = [
        "Great job! 🌟",
        "You got it! 👍",
        "Nice work!",
        "Exactly right!",
      ];
      return correctMessages[Math.floor(Math.random() * correctMessages.length)];
    }
    
    const incorrectMessages = [
      "Good try! Let's keep going.",
      "That's okay, you're doing great!",
      "Nice effort! Let's try another.",
      "Keep going, you're learning!",
    ];
    return incorrectMessages[Math.floor(Math.random() * incorrectMessages.length)];
  }
  
  private calculateOutput(session: DiagnosticSession): DiagnosticOutput {
    const accuracy = this.state.totalCorrect / Math.max(this.state.totalAttempted, 1);
    
    // Determine recommended difficulty
    let recommendedDifficulty: 'EASY' | 'MEDIUM' | 'HARD';
    if (accuracy >= 0.75 && this.state.currentDifficulty !== DiagnosticDifficulty.FOUNDATION) {
      recommendedDifficulty = 'HARD';
    } else if (accuracy >= 0.5) {
      recommendedDifficulty = 'MEDIUM';
    } else {
      recommendedDifficulty = 'EASY';
    }
    
    // Calculate skill breakdown
    const skillBreakdown = {
      recall: this.calculateSkillScore(CognitiveSkill.RECALL),
      comprehension: this.calculateSkillScore(CognitiveSkill.COMPREHENSION),
      application: this.calculateSkillScore(CognitiveSkill.APPLICATION),
      analysis: this.calculateSkillScore(CognitiveSkill.ANALYSIS),
    };
    
    // Calculate topic scores
    const topicScores = Object.entries(this.state.topicScores).map(([topic, score]) => ({
      topic,
      score: score.total > 0 ? score.correct / score.total : 0,
      questionsAnswered: score.total,
    }));
    
    // Identify gaps and strengths
    const knowledgeGaps = topicScores
      .filter(t => t.score < 0.5 && t.questionsAnswered >= 1)
      .map(t => t.topic);
    
    const strengths = topicScores
      .filter(t => t.score >= 0.75 && t.questionsAnswered >= 1)
      .map(t => t.topic);
    
    // Generate encouraging message
    const studentMessage = this.generateStudentMessage(accuracy, strengths, knowledgeGaps);
    
    // Calculate average time
    const totalTime = session.responses.reduce((sum, r) => sum + r.timeTakenSeconds, 0);
    const avgTime = totalTime / Math.max(session.responses.length, 1);
    
    // Calculate hints used
    const hintsUsed = session.responses.filter(r => r.hintRequested).length;
    
    return {
      sessionId: this.sessionId,
      recommendedDifficulty,
      recommendationConfidence: this.state.confidenceLevel,
      baselineConfidence: accuracy, // Use accuracy as initial confidence baseline
      skillBreakdown,
      topicScores,
      knowledgeGaps,
      strengths,
      studentMessage,
      metadata: {
        totalQuestions: session.responses.length,
        correctAnswers: this.state.totalCorrect,
        averageTimeSeconds: avgTime,
        hintsUsed,
        diagnosticDuration: Math.round(
          (new Date(session.completedAt!).getTime() - new Date(session.startedAt).getTime()) / 1000
        ),
      },
    };
  }
  
  private calculateSkillScore(skill: CognitiveSkill): number {
    const skillData = this.state.skillScores[skill];
    if (skillData.total === 0) return 0.5; // Default to medium if not tested
    return skillData.correct / skillData.total;
  }
  
  private generateStudentMessage(
    accuracy: number,
    strengths: string[],
    gaps: string[]
  ): string {
    // Always encouraging, never discouraging!
    if (accuracy >= 0.75) {
      if (strengths.length > 0) {
        return `Great work! You're doing really well, especially in ${strengths[0]}. Let's build on that! 🌟`;
      }
      return "Excellent! You have a strong foundation. Let's explore some interesting challenges!";
    }
    
    if (accuracy >= 0.5) {
      return "Good effort! You have a solid start. I'll help you strengthen a few areas as we learn together.";
    }
    
    // Low accuracy - extra encouraging
    return "Thanks for trying! I now know exactly how to help you. We'll start with the basics and build up from there. You've got this! 💪";
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new diagnostic session.
 */
export function createDiagnosticSession(
  grade: number,
  subject: string,
  questionBank: QuestionBank,
  board?: string
): DiagnosticEngine {
  return new DiagnosticEngine(grade, subject, questionBank, board);
}

/**
 * FILE: HydrateAll Trigger Form Component
 *
 * OBJECTIVE:
 * Form for submitting new HydrateAll jobs with configuration options.
 *
 * FEATURES:
 * - Board/Grade/Subject selection
 * - Language selection (en/hi)
 * - Options (notes, questions, difficulties)
 * - Real-time cost estimation
 * - Dry-run mode for testing
 */

'use client';

import { useState, useEffect } from 'react';
import { LanguageCode, DifficultyLevel } from '@prisma/client';
import SubjectSelect from '@/components/SubjectSelect';

interface TriggerFormProps {
  onJobCreated: (jobId: string) => void;
}

interface FormData {
  language: LanguageCode;
  boardCode: string;
  grade: string;
  subjectCode: string;
  options: {
    generateNotes: boolean;
    generateQuestions: boolean;
    difficulties: DifficultyLevel[];
    questionsPerDifficulty: number;
    skipValidation: boolean;
    dryRun: boolean;
  };
}

interface Estimates {
  totalChapters: number;
  estimatedTopics: number;
  estimatedNotes: number;
  estimatedQuestions: number;
  estimatedCostUsd: number;
  estimatedDurationMins: number;
}

export default function TriggerForm({ onJobCreated }: TriggerFormProps) {
  const [formData, setFormData] = useState<FormData>({
    language: 'en',
    boardCode: 'CBSE',
    grade: '10',
    subjectCode: 'MATH',
    options: {
      generateNotes: true,
      generateQuestions: true,
      difficulties: ['easy', 'medium', 'hard'],
      questionsPerDifficulty: 10,
      skipValidation: false,
      dryRun: false,
    },
  });

  const [estimates, setEstimates] = useState<Estimates | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset subject when board or grade changes (subjects depend on both)
  useEffect(() => {
    setFormData((prev) => ({ ...prev, subjectCode: '' }));
  }, [formData.boardCode, formData.grade]);

  // Update estimates when form changes
  useEffect(() => {
    updateEstimates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  const updateEstimates = () => {
    const { options } = formData;
    const avgChapters = 12;
    const avgTopics = avgChapters * 5;
    const notes = options.generateNotes ? avgTopics : 0;
    const questions = options.generateQuestions
      ? avgTopics * options.difficulties.length * options.questionsPerDifficulty
      : 0;

    const costPerChapter = 0.05;
    const costPerTopic = 0.02;
    const costPerNote = 0.15;
    const costPerQuestion = 0.03;

    const estimatedCost =
      avgChapters * costPerChapter +
      avgTopics * costPerTopic +
      notes * costPerNote +
      questions * costPerQuestion;

    const timePerChapter = 2;
    const timePerTopic = 1;
    const timePerNote = 5;
    const timePerQuestion = 2;

    const estimatedDuration =
      avgChapters * timePerChapter +
      avgTopics * timePerTopic +
      notes * timePerNote +
      questions * timePerQuestion;

    setEstimates({
      totalChapters: avgChapters,
      estimatedTopics: avgTopics,
      estimatedNotes: notes,
      estimatedQuestions: questions,
      estimatedCostUsd: Math.round(estimatedCost * 100) / 100,
      estimatedDurationMins: Math.ceil(estimatedDuration),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/hydrateAll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit job');
      }

      if (formData.options.dryRun) {
        alert(`Dry Run Complete!\n\nEstimates:\n${JSON.stringify(data.estimates, null, 2)}`);
      } else {
        onJobCreated(data.rootJobId);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Basic Configuration */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Language</label>
          <select
            value={formData.language}
            onChange={(e) => setFormData({ ...formData, language: e.target.value as LanguageCode })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </select>
        </div>

        {/* Board */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Board</label>
          <select
            value={formData.boardCode}
            onChange={(e) => setFormData({ ...formData, boardCode: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="CBSE">CBSE</option>
            <option value="ICSE">ICSE</option>
            <option value="STATE">State Board</option>
          </select>
        </div>

        {/* Grade */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Grade</label>
          <select
            value={formData.grade}
            onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
              <option key={grade} value={grade}>
                Grade {grade}
              </option>
            ))}
          </select>
        </div>

        {/* Subject (DB-driven) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Subject</label>
          <SubjectSelect
            boardSlug={formData.boardCode}
            gradeNum={formData.grade}
            value={formData.subjectCode}
            onChange={(slug) => setFormData({ ...formData, subjectCode: slug })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Content Options */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-lg font-medium text-gray-900">Content Options</h3>

        {/* Generate Notes */}
        <div className="flex items-center">
          <input
            id="generateNotes"
            type="checkbox"
            checked={formData.options.generateNotes}
            onChange={(e) =>
              setFormData({
                ...formData,
                options: { ...formData.options, generateNotes: e.target.checked },
              })
            }
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="generateNotes" className="ml-3 text-sm font-medium text-gray-700">
            Generate Notes
          </label>
        </div>

        {/* Generate Questions */}
        <div className="flex items-center">
          <input
            id="generateQuestions"
            type="checkbox"
            checked={formData.options.generateQuestions}
            onChange={(e) =>
              setFormData({
                ...formData,
                options: { ...formData.options, generateQuestions: e.target.checked },
              })
            }
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="generateQuestions" className="ml-3 text-sm font-medium text-gray-700">
            Generate Questions
          </label>
        </div>

        {/* Difficulty Levels (if questions enabled) */}
        {formData.options.generateQuestions && (
          <div className="ml-7 space-y-2">
            <label className="block text-sm font-medium text-gray-700">Difficulty Levels</label>
            {['easy', 'medium', 'hard'].map((diff) => (
              <div key={diff} className="flex items-center">
                <input
                  id={`diff-${diff}`}
                  type="checkbox"
                  checked={formData.options.difficulties.includes(diff as DifficultyLevel)}
                  onChange={(e) => {
                    const difficulties = e.target.checked
                      ? [...formData.options.difficulties, diff as DifficultyLevel]
                      : formData.options.difficulties.filter((d) => d !== diff);
                    setFormData({
                      ...formData,
                      options: { ...formData.options, difficulties },
                    });
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor={`diff-${diff}`} className="ml-2 text-sm text-gray-600 capitalize">
                  {diff}
                </label>
              </div>
            ))}

            {/* Questions per difficulty */}
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700">
                Questions per Difficulty
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.options.questionsPerDifficulty}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    options: {
                      ...formData.options,
                      questionsPerDifficulty: parseInt(e.target.value, 10),
                    },
                  })
                }
                className="mt-1 block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Advanced Options */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-lg font-medium text-gray-900">Advanced Options</h3>

        <div className="flex items-center">
          <input
            id="dryRun"
            type="checkbox"
            checked={formData.options.dryRun}
            onChange={(e) =>
              setFormData({
                ...formData,
                options: { ...formData.options, dryRun: e.target.checked },
              })
            }
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="dryRun" className="ml-3 text-sm font-medium text-gray-700">
            Dry Run (estimate only, don't create job)
          </label>
        </div>
      </div>

      {/* Estimates */}
      {estimates && (
        <div className="rounded-lg bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">Estimated Output</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-700">
                Chapters: <span className="font-semibold">{estimates.totalChapters}</span>
              </p>
              <p className="text-blue-700">
                Topics: <span className="font-semibold">{estimates.estimatedTopics}</span>
              </p>
              <p className="text-blue-700">
                Notes: <span className="font-semibold">{estimates.estimatedNotes}</span>
              </p>
              <p className="text-blue-700">
                Questions: <span className="font-semibold">{estimates.estimatedQuestions}</span>
              </p>
            </div>
            <div>
              <p className="text-blue-700">
                Cost: <span className="font-semibold">${estimates.estimatedCostUsd}</span>
              </p>
              <p className="text-blue-700">
                Duration:{' '}
                <span className="font-semibold">{estimates.estimatedDurationMins} mins</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className={`
            px-6 py-3 border border-transparent text-base font-medium rounded-md text-white
            ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          `}
        >
          {isSubmitting ? 'Submitting...' : formData.options.dryRun ? 'Run Estimate' : 'Submit Job'}
        </button>
      </div>
    </form>
  );
}

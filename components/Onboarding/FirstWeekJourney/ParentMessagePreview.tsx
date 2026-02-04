/**
 * FILE OBJECTIVE:
 * - Parent message preview component showing scheduled/sent WhatsApp updates.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Onboarding/FirstWeekJourney/ParentMessagePreview.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-05T00:00:00Z | copilot | created parent message preview component
 */

'use client';

import React from 'react';
import type { ParentMessagePreviewProps } from './types';
import { FIRST_WEEK_STRINGS } from './types';

/**
 * WhatsApp icon
 */
function WhatsAppIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/**
 * Clock icon for scheduled messages
 */
function ClockIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

/**
 * Check icon for sent messages
 */
function CheckIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

/**
 * Parent message templates by day and language
 */
const PARENT_MESSAGE_PREVIEWS: Record<'en' | 'hi', Record<1 | 4 | 7, string>> = {
  en: {
    1: "🎉 Great news! {studentName} just completed their first day of learning on Spinzy Academy! They're off to a wonderful start.",
    4: "📈 Update: {studentName} has been learning consistently for 4 days! They've been working hard on {subject}. Keep encouraging them!",
    7: "🏆 Milestone Alert! {studentName} completed one full week of learning! This is a huge achievement. They're building great study habits.",
  },
  hi: {
    1: '🎉 बधाई हो! {studentName} ने Spinzy Academy पर अपना पहला दिन पूरा किया! शानदार शुरुआत!',
    4: '📈 अपडेट: {studentName} लगातार 4 दिनों से पढ़ाई कर रहे हैं! {subject} में मेहनत कर रहे हैं। उन्हें प्रोत्साहित करते रहें!',
    7: '🏆 बड़ी उपलब्धि! {studentName} ने पूरे एक हफ्ते की पढ़ाई पूरी की! यह गर्व की बात है। अच्छी आदतें बन रही हैं।',
  },
};

/**
 * Format the parent message with student details
 */
function formatMessage(
  template: string,
  studentName: string,
  subject?: string
): string {
  let message = template.replace('{studentName}', studentName);
  if (subject) {
    message = message.replace('{subject}', subject);
  } else {
    message = message.replace(' on {subject}', '');
    message = message.replace('{subject} में', 'पढ़ाई में');
  }
  return message;
}

/**
 * Format date for display
 */
function formatScheduledTime(date: Date, language: 'en' | 'hi'): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  const locale = language === 'hi' ? 'hi-IN' : 'en-US';
  return date.toLocaleString(locale, options);
}

/**
 * ParentMessagePreview - Shows scheduled or sent parent WhatsApp messages
 * 
 * @example
 * ```tsx
 * <ParentMessagePreview
 *   dayNumber={1}
 *   studentName="Rahul"
 *   subject="Mathematics"
 *   sent={false}
 *   scheduledTime={new Date()}
 *   language="en"
 * />
 * ```
 */
export function ParentMessagePreview({
  dayNumber,
  studentName,
  subject,
  sent,
  scheduledTime,
  language = 'en',
}: ParentMessagePreviewProps): React.JSX.Element {
  const strings = FIRST_WEEK_STRINGS[language];
  const messageTemplate = PARENT_MESSAGE_PREVIEWS[language][dayNumber];
  const formattedMessage = formatMessage(messageTemplate, studentName, subject);

  return (
    <div
      className={`
        rounded-lg border p-4
        ${sent ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}
      `}
      role="article"
      aria-label={`${strings.parentMessageTitle} - Day ${dayNumber}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <WhatsAppIcon className="w-5 h-5 text-green-500" />
          <h4 className="font-medium text-sm text-gray-800">
            {strings.parentMessageTitle}
          </h4>
          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
            Day {dayNumber}
          </span>
        </div>
        
        {/* Status badge */}
        <div
          className={`
            flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full
            ${sent ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}
          `}
        >
          {sent ? (
            <>
              <CheckIcon className="w-3 h-3" />
              {strings.parentMessageSent}
            </>
          ) : (
            <>
              <ClockIcon className="w-3 h-3" />
              {strings.parentMessageScheduled}
            </>
          )}
        </div>
      </div>

      {/* Message preview (WhatsApp-style bubble) */}
      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
        <p className="text-sm text-gray-700 leading-relaxed">{formattedMessage}</p>
      </div>

      {/* Scheduled time */}
      {!sent && scheduledTime && (
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
          <ClockIcon className="w-3 h-3" />
          <span>
            {strings.parentMessageScheduled}: {formatScheduledTime(scheduledTime, language)}
          </span>
        </div>
      )}

      {/* Sent confirmation */}
      {sent && (
        <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
          <CheckIcon className="w-3 h-3" />
          <span>{strings.parentMessageSent}</span>
        </div>
      )}
    </div>
  );
}

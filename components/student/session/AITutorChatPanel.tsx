/* eslint-disable @next/next/no-img-element */
'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { stripTag } from '@/lib/ai/tutor/tagParser'

type MessageRole = 'student' | 'ai'

interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  isStreaming?: boolean
}

interface AITutorChatPanelProps {
  sessionId: string
  conceptName: string
  subjectName: string
  initialStage: string // TutorStage from session start
  isAITutorEnabled: boolean
  onSessionComplete: (summary: { tag: string; stage: string; turnNumber: number }) => void
}

type TutorTurnCompleteEvent = {
  tag: string
  stage: string
  hintsRemaining: number
  turnNumber: number
  sessionComplete: boolean
}

type TutorErrorEvent = {
  code: string
  message: string
  retryable: boolean
}

type SseEventType = 'token' | 'complete' | 'error'

interface ParsedSseEvent<T = any> {
  event: SseEventType
  data: T
}

const STAGE_LABELS: Record<string, string> = {
  HOOK: 'Hook',
  PREREQ_BRIDGE: 'Prerequisite Bridge',
  CORE_EXPLANATION: 'Core Explanation',
  WORKED_EXAMPLE: 'Worked Example',
  GUIDED_PRACTICE: 'Guided Practice',
  INDEPENDENT_PRACTICE: 'Independent Practice',
  CONSOLIDATION: 'Consolidation',
}

const INACTIVITY_MS = 90_000
const MAX_RECONNECT_ATTEMPTS = 3

function mapStage(stage: string): string {
  return STAGE_LABELS[stage] || stage || 'Tutor Session'
}

function parseSseChunk(raw: string): ParsedSseEvent[] {
  const events: ParsedSseEvent[] = []
  const blocks = raw.split('\n\n')
  for (const block of blocks) {
    if (!block.trim()) continue
    const lines = block.split('\n')
    let event: SseEventType | null = null
    let data: any = null
    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.replace('event:', '').trim() as SseEventType
      } else if (line.startsWith('data:')) {
        const payload = line.replace('data:', '').trim()
        try {
          data = JSON.parse(payload)
        } catch {
          data = payload
        }
      }
    }
    if (event) {
      events.push({ event, data })
    }
  }
  return events
}

export const AITutorChatPanel: React.FC<AITutorChatPanelProps> = ({
  sessionId,
  conceptName,
  subjectName,
  initialStage,
  isAITutorEnabled,
  onSessionComplete,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [hintsRemaining, setHintsRemaining] = useState(3)
  const [currentStage, setCurrentStage] = useState(initialStage)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const lastAiMessageIdRef = useRef<string | null>(null)

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const stageLabel = useMemo(() => mapStage(currentStage), [currentStage])

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearInactivityTimer()
    }
  }, [clearInactivityTimer])

  const scheduleInactivityHint = useCallback(() => {
    clearInactivityTimer()
    inactivityTimerRef.current = setTimeout(() => {
      // Auto-submit a hint request
      if (!isStreaming) {
        void sendMessageInternal('__HINT_REQUEST__', true)
      }
    }, INACTIVITY_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sendMessageInternal is stable; omit to avoid resetting timer on every turn
  }, [clearInactivityTimer, isStreaming])

  const addStudentMessage = useCallback((content: string) => {
    const msg: ChatMessage = {
      id: `student-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: 'student',
      content,
    }
    setMessages((prev) => [...prev, msg])
  }, [])

  const startAiMessage = useCallback(() => {
    const id = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    lastAiMessageIdRef.current = id
    const msg: ChatMessage = {
      id,
      role: 'ai',
      content: '',
      isStreaming: true,
    }
    setMessages((prev) => [...prev, msg])
  }, [])

  const appendAiChunk = useCallback((chunk: string) => {
    const id = lastAiMessageIdRef.current
    if (!id) return
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              content: (m.content || '') + chunk,
            }
          : m,
      ),
    )
  }, [])

  const finalizeAiMessage = useCallback(() => {
    const id = lastAiMessageIdRef.current
    if (!id) return
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              isStreaming: false,
            }
          : m,
      ),
    )
    lastAiMessageIdRef.current = null
  }, [])

  const handleCompleteEvent = useCallback(
    (payload: TutorTurnCompleteEvent) => {
      setHintsRemaining(payload.hintsRemaining)
      setCurrentStage(payload.stage)
      if (payload.sessionComplete) {
        onSessionComplete({ tag: payload.tag, stage: payload.stage, turnNumber: payload.turnNumber })
      }
      scheduleInactivityHint()
    },
    [onSessionComplete, scheduleInactivityHint],
  )

  const handleErrorEvent = useCallback((payload: TutorErrorEvent) => {
    if (payload.code === 'JAILBREAK_DETECTED') {
      setConnectionError('Your message could not be processed safely. Please rephrase your question.')
    } else {
      setConnectionError('Something went wrong. Please try again.')
    }
    setIsStreaming(false)
    finalizeAiMessage()
  }, [finalizeAiMessage])

  async function streamTutorTurn(message: string) {
    setIsStreaming(true)
    setConnectionError(null)
    setIsReconnecting(false)

    let response: Response
    try {
      response = await fetch('/api/tutor/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, studentMessage: message, turnNumber: Date.now() }),
      })
    } catch {
      setConnectionError('Connection lost. Reconnecting…')
      setIsStreaming(false)
      return
    }

    if (!response.ok || !response.body) {
      setConnectionError('Connection lost. Reconnecting…')
      setIsStreaming(false)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunkStr = decoder.decode(value, { stream: true })
        const events = parseSseChunk(chunkStr)
        for (const evt of events) {
          if (evt.event === 'token') {
            const text = typeof evt.data?.chunk === 'string' ? stripTag(evt.data.chunk) : ''
            if (text) appendAiChunk(text)
          } else if (evt.event === 'complete') {
            finalizeAiMessage()
            handleCompleteEvent(evt.data as TutorTurnCompleteEvent)
          } else if (evt.event === 'error') {
            handleErrorEvent(evt.data as TutorErrorEvent)
          }
        }
      }
    } catch {
      setConnectionError('Connection lost. Reconnecting…')
    } finally {
      setIsStreaming(false)
    }
  }

  async function sendMessageInternal(message: string, isAutoHint: boolean) {
    if (!message.trim()) return
    if (!isAutoHint) {
      addStudentMessage(message)
    }
    startAiMessage()
    clearInactivityTimer()
    await streamTutorTurn(message)
  }

  const handleSend = useCallback(() => {
    if (isStreaming || !inputValue.trim()) return
    const msg = inputValue.trim()
    setInputValue('')
    void sendMessageInternal(msg, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sendMessageInternal is stable; omit to avoid recreating handleSend every turn
  }, [inputValue, isStreaming])

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    setInputValue(e.target.value)
    clearInactivityTimer()
  }

  // Reconnect banner logic (simplified: we expose the banner, actual reconnect orchestration
  // can be layered on with a parent hook if desired).
  useEffect(() => {
    if (!connectionError) {
      setReconnectAttempts(0)
      setIsReconnecting(false)
      return
    }

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return

    setIsReconnecting(true)
    const timer = setTimeout(() => {
      setReconnectAttempts((c) => c + 1)
      // Trigger a lightweight no-op tutor call to re-establish connection; we don't change messages,
      // but on success the next real turn will work.
      void streamTutorTurn('__PING__')
    }, 3000)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- streamTutorTurn is stable; omit to avoid re-running reconnect on every turn
  }, [connectionError, reconnectAttempts])

  const header = (
    <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase text-gray-500">{subjectName}</span>
          <span className="text-sm font-semibold text-gray-900">{conceptName}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
            {stageLabel}
          </span>
          <span className="mt-1 text-xs text-gray-500">Hints remaining: {hintsRemaining}</span>
        </div>
      </div>
      {connectionError && (
        <div className="mt-2 rounded-md bg-amber-50 px-3 py-1 text-xs text-amber-800">
          {connectionError}{' '}
          {isReconnecting && reconnectAttempts < MAX_RECONNECT_ATTEMPTS && (
            <span className="ml-1 italic">Reconnecting…</span>
          )}
          {reconnectAttempts >= MAX_RECONNECT_ATTEMPTS && (
            <span className="ml-1 font-semibold">Unable to reconnect. Please refresh.</span>
          )}
        </div>
      )}
    </div>
  )

  const renderMessage = (m: ChatMessage) => {
    const isStudent = m.role === 'student'
    const align = isStudent ? 'items-end' : 'items-start'
    const bubbleBase =
      'inline-block max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words'
    const bubbleClasses = isStudent
      ? `${bubbleBase} bg-indigo-600 text-white rounded-br-none`
      : `${bubbleBase} bg-white text-gray-900 border border-gray-200 rounded-bl-none`

    return (
      <div key={m.id} className={`flex ${align} mb-2`}>
        <div className={bubbleClasses}>
          {m.content}
          {m.isStreaming && (
            <span className="ml-1 inline-block animate-pulse text-lg leading-none text-gray-400">…</span>
          )}
        </div>
      </div>
    )
  }

  if (!isAITutorEnabled) return null

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-gray-50">
      {header}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="mb-4 text-xs text-gray-500">
            Vidya will guide you through this concept with questions and hints. Type your answer or question below to
            begin.
          </div>
        )}
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>
      <div className="sticky bottom-0 border-t border-gray-200 bg-white px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            className="min-h-[44px] max-h-32 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Type your answer or question…"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isStreaming || !inputValue.trim()}
            className="flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-full bg-indigo-600 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            ➤
          </button>
        </div>
        {isStreaming && (
          <div className="mt-1 text-[11px] text-gray-400">Vidya is thinking…</div>
        )}
      </div>
    </div>
  )
}


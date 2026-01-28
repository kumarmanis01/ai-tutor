/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 */

"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import useSWR from "swr";

// Lightweight fetcher used across hierarchy components
const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type Selection = {
  boardId?: string;
  classId?: string;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  language?: string;
};

type HierarchyData = any; // Keep flexible; shaped by /api/hierarchy

type ContextShape = {
  hierarchy: HierarchyData | null;
  selection: Selection;
  setSelection: (s: Selection | ((prev: Selection) => Selection)) => void;
  loading: boolean;
  error?: any;
  languages: string[];
};

const HierarchyContext = createContext<ContextShape | null>(null);

export const HierarchyProvider: React.FC<React.PropsWithChildren<unknown>> = ({ children }) => {
  // Fetch canonical hierarchy once — include chapters and topics so selector shows generated content
  const { data, error, isLoading } = useSWR<HierarchyData>("/api/hierarchy?include=subjects,chapters,topics", fetcher);

  const [selection, setSelection] = useState<Selection>({});

  // If needed, we could seed selection from URL or last-used state here
  useEffect(() => {
    // noop for now
  }, []);

  const languages = (data && (data.languages || data.availableLanguages)) ?? ["English", "Hindi"];

  return (
    <HierarchyContext.Provider
      value={{ hierarchy: data ?? null, selection, setSelection, loading: !!isLoading, error, languages }}
    >
      {children}
    </HierarchyContext.Provider>
  );
};

export function useHierarchy() {
  const ctx = useContext(HierarchyContext);
  if (!ctx) throw new Error("useHierarchy must be used inside a HierarchyProvider");
  return ctx;
}

export default HierarchyProvider;

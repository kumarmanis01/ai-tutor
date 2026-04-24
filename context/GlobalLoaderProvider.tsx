/**
 * FILE OBJECTIVE:
 * - Compatibility wrapper around the canonical global loader provider.
 * - Preserves the legacy `useGlobalLoader()` API (`startLoading`,
 *   `stopLoading`, `resetLoading`, `loading`, `label`) while delegating
 *   rendering and canonical behaviour to `components/UI/loaders`.
 *
 * LINKED UNIT TEST:
 * - tests/unit/context/GlobalLoaderProvider.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-22T00:00:00Z | copilot | implement compatibility wrapper preserving ref-counting semantics
 */

'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { GlobalLoaderProvider as CanonicalProvider, useGlobalLoader as useCanonicalGlobalLoader } from '@/components/UI/loaders';

type LegacyLoaderContextType = {
	startLoading: (label?: string) => void;
	stopLoading: () => void;
	resetLoading: () => void;
	loading: boolean;
	label?: string | null;
};

const LegacyGlobalLoaderContext = createContext<LegacyLoaderContextType | null>(null);

function LegacyInnerProvider({ children }: { children: ReactNode }) {
	const canonical = useCanonicalGlobalLoader();
	const { showLoader, hideLoader } = canonical;

	const [count, setCount] = useState(0);
	const [label, setLabel] = useState<string | undefined>(undefined);

	// Drive canonical provider visibility from `count` via an effect so we avoid
	// render-phase side-effects (setState during render). This preserves
	// ref-counting semantics while delegating rendering to the canonical provider.
	useEffect(() => {
		if (count > 0) {
			showLoader(label);
		} else {
			hideLoader();
		}
	}, [count, label, showLoader, hideLoader]);

	const startLoading = useCallback((lbl?: string) => {
		if (lbl) setLabel(lbl);
		setCount(prev => prev + 1);
	}, []);

	const stopLoading = useCallback(() => {
		setCount(prev => Math.max(0, prev - 1));
	}, []);

	const resetLoading = useCallback(() => {
		setCount(0);
		setLabel(undefined);
	}, []);

	const value = useMemo(() => ({
		startLoading,
		stopLoading,
		resetLoading,
		loading: count > 0,
		label,
	}), [startLoading, stopLoading, resetLoading, count, label]);

	return (
		<LegacyGlobalLoaderContext.Provider value={value}>
			{children}
		</LegacyGlobalLoaderContext.Provider>
	);
}

export function GlobalLoaderProvider({ children }: { children: ReactNode }) {
	return (
		<CanonicalProvider>
			<LegacyInnerProvider>{children}</LegacyInnerProvider>
		</CanonicalProvider>
	);
}

export function useGlobalLoader(): LegacyLoaderContextType {
	const ctx = useContext(LegacyGlobalLoaderContext);
	if (!ctx) {
		if (typeof window === 'undefined') {
			return {
				startLoading: () => {},
				stopLoading: () => {},
				resetLoading: () => {},
				loading: false,
				label: undefined,
			};
		}
		throw new Error('useGlobalLoader must be used within GlobalLoaderProvider');
	}
	return ctx;
}

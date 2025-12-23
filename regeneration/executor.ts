/**
 * Regeneration executor interface and related types.
 *
 * Requirements enforced by design:
 * - Interface only (no implementations here)
 * - No side effects in implementations' contract
 * - No DB access inside the interface
 */

export type InstructionJson = Record<string, unknown>;

/**
 * A light-weight alias for job type. Implementations may narrow this
 * to a union of known types elsewhere in the codebase.
 */
export type RegenerationJobType = string;

export type ExecutionResultSuccess = {
  success: true;
  /** Deterministic, immutable reference to stored output (e.g. path or URL) */
  outputRef: string;
  /** Optional metadata produced by the executor (readonly)
   *  Must be JSON-serializable and contain no DB references. */
  metadata?: Record<string, unknown>;
};

export type ExecutionResultFailure = {
  success: false;
  /** Error summary; implementations should avoid leaking secrets */
  error: {
    message: string;
    code?: string;
    details?: Record<string, unknown>;
  };
};

export type ExecutionResult = ExecutionResultSuccess | ExecutionResultFailure;

/**
 * RegenerationExecutor
 * - Pure contract: receives `InstructionJson` and returns an `ExecutionResult`.
 * - Implementations MUST NOT perform DB writes as part of `run` (they may
 *   produce an output that the worker persists externally).
 * - No side-effect guarantees are enforced by the type system; rely on
 *   code review and tests to ensure executors are deterministic and pure
 *   with respect to DB state.
 */
export interface RegenerationExecutor {
  readonly type: RegenerationJobType;
  run(input: InstructionJson): Promise<ExecutionResult>;
}

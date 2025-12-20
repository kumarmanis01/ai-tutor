export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // failures to open
  successThreshold?: number; // successes to close from half-open
  timeoutMs?: number; // open timeout
}

export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private state: CircuitState = 'CLOSED';
  private nextAttempt = 0;

  constructor(private opts: CircuitBreakerOptions = {}) {
    this.opts.failureThreshold = this.opts.failureThreshold ?? 5;
    this.opts.successThreshold = this.opts.successThreshold ?? 2;
    this.opts.timeoutMs = this.opts.timeoutMs ?? 30_000;
  }

  canRequest(): boolean {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
        return true;
      }
      return false;
    }
    return true;
  }

  onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successes += 1;
      if (this.successes >= (this.opts.successThreshold ?? 1)) {
        this.reset();
      }
    } else {
      this.reset();
    }
  }

  onFailure(): void {
    this.failures += 1;
    if (this.failures >= (this.opts.failureThreshold ?? 5)) {
      this.trip();
    }
  }

  private trip() {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + (this.opts.timeoutMs ?? 30_000);
    this.failures = 0;
    this.successes = 0;
  }

  private reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
  }

  getState(): CircuitState {
    return this.state;
  }
}

export default CircuitBreaker;

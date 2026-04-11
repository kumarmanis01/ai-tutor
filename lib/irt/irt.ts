/**
 * Minimal IRT utilities (3PL) used for later adaptive selection.
 * - p3pl: probability function
 * - fisherInfo: item information at given theta
 * - eapEstimate: grid-based EAP posterior estimate for small item sets
 */

export function p3pl(theta: number, a: number, b: number, c: number, D = 1.702) {
  const expTerm = Math.exp(-D * a * (theta - b));
  return c + (1 - c) / (1 + expTerm);
}

export function fisherInfo(theta: number, a: number, b: number, c: number, D = 1.702) {
  const p = p3pl(theta, a, b, c, D);
  const expTerm = Math.exp(-D * a * (theta - b));
  const derivative = D * a * (1 - c) * (expTerm / Math.pow(1 + expTerm, 2));
  const denom = p * (1 - p);
  if (denom <= 0) return 0;
  return (derivative * derivative) / denom;
}

export type IRTItem = { a: number; b: number; c: number };

export function eapEstimate(items: IRTItem[], responses: number[]) {
  // Discretize theta grid -4..+4 step 0.1
  const grid: number[] = [];
  for (let t = -40; t <= 40; t++) grid.push(t / 10);

  const prior = (theta: number) => Math.exp(-0.5 * theta * theta) / Math.sqrt(2 * Math.PI);

  const liks = grid.map((theta) => {
    let like = prior(theta);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const p = p3pl(theta, it.a, it.b, it.c);
      const r = responses[i] === 1 ? p : 1 - p;
      like *= Math.max(r, 1e-12);
    }
    return like;
  });

  const total = liks.reduce((s, v) => s + v, 0);
  if (total <= 0) return { theta: 0, se: 1 };

  const posterior = liks.map((v) => v / total);
  const mean = grid.reduce((s, th, i) => s + th * posterior[i], 0);
  const variance = grid.reduce((s, th, i) => s + (th - mean) * (th - mean) * posterior[i], 0);
  const se = Math.sqrt(variance);
  return { theta: mean, se };
}

/**
 * Map a theta estimate to a grade-level placement band (AC-05).
 * Thresholds: below < -0.5, -0.5 <= at <= 0.5, above > 0.5
 */
export type GradePlacement = 'below' | 'at' | 'above';

export function thetaToPlacement(theta: number): GradePlacement {
  if (theta < -0.5) return 'below';
  if (theta > 0.5) return 'above';
  return 'at';
}

const IRT = { p3pl, fisherInfo, eapEstimate, thetaToPlacement };
export default IRT;

export function assertNoStringFilters(req: Request) {
  const { searchParams } = new URL(req.url);

  // Forbidden query keys that represent free-form string filters
  const forbidden = ["board", "subject", "grade", "class"];

  const present = forbidden.filter((k) => searchParams.has(k));
  if (present.length > 0) {
    throw new Error(
      `String-based filters are disallowed: ${present.join(", ")}. Use canonical IDs (boardId, classId, subjectId) instead.`
    );
  }
}

export function isStringFilterPresent(req: Request) {
  const { searchParams } = new URL(req.url);
  const forbidden = ["board", "subject", "grade", "class"];
  return forbidden.some((k) => searchParams.has(k));
}

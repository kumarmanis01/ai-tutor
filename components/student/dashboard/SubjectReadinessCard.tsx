interface Props {
  subjectName: string;
  score: number;
  subjectId: string;
}

export default function SubjectReadinessCard({ subjectName, score }: Props) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70 ? 'text-success' : pct >= 40 ? 'text-warning' : 'text-error';

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 gap-3">
      <span className="font-body text-sm text-foreground truncate">{subjectName}</span>
      <span className={`font-headline font-bold text-sm ${color} shrink-0`}>{pct}%</span>
    </div>
  );
}

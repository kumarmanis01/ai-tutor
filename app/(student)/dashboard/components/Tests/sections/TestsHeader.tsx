import React from 'react';

export function TestsHeader({ subject: _subject, grade: _grade, board: _board }: { subject?: string; grade?: string; board?: string }) {
  void _subject; void _grade; void _board;
  return (
    <div className="space-y-1">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Tests</h1>
        <p className="text-sm text-muted-foreground">Practice and evaluate your learning</p>
      </div>
    </div>
  );
}

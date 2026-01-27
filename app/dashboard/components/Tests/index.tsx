"use client";

import React from 'react';
import { TestsHeader } from './sections/TestsHeader';
import { TestsHome } from './sections/TestsHome';
import { TestsProvider, useTests } from './context/TestsProvider';

function TestsContent({ subject, grade, board }: { subject: string; grade?: string; board?: string }) {
  const { refresh } = useTests();
  React.useEffect(() => { refresh(subject, grade, board); }, [refresh, subject, grade, board]);
  return (
    <div className="space-y-6 px-3 sm:px-4 py-4">
      <TestsHeader subject={subject} grade={grade} board={board} />
      <TestsHome subject={subject} grade={grade} board={board} />
    </div>
  );
}

export default function TestsTab({ subject, grade, board }: { subject: string; grade?: string; board?: string }) {
  return (
    <TestsProvider>
      <TestsContent subject={subject} grade={grade} board={board} />
    </TestsProvider>
  );
}

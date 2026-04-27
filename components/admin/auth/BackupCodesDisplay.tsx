/**
 * FILE OBJECTIVE:
 * - Display/download backup codes and explicit save acknowledgement controls.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/admin/auth/BackupCodesDisplay.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:11:00Z | copilot | created backup-codes display component for setup step 3
 */

'use client';

import React from 'react';

interface BackupCodesDisplayProps {
  backupCodes: string[];
  acknowledged: boolean;
  onAcknowledgeChange: (checked: boolean) => void;
}

export function BackupCodesDisplay({
  backupCodes,
  acknowledged,
  onAcknowledgeChange,
}: BackupCodesDisplayProps): React.ReactElement {
  const downloadTxt = () => {
    const content = `Spinzy Academy Admin Backup Codes\n\n${backupCodes.join('\n')}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'spinzy-admin-backup-codes.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#E24B4A] font-medium">Save these codes. You won't see them again.</p>
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3 bg-gray-50">
        {backupCodes.map((code) => (
          <div key={code} className="font-mono text-sm tracking-wider">
            {code}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={downloadTxt}
        className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold"
      >
        Download as TXT
      </button>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => onAcknowledgeChange(event.target.checked)}
        />
        I have saved my backup codes
      </label>
    </div>
  );
}

export default BackupCodesDisplay;

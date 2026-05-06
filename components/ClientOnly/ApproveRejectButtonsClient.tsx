'use client';

interface Props {
  candidate: {
    id?: string;
    studentId?: string;
    [key: string]: unknown;
  };
}

export default function ApproveRejectButtonsClient({ candidate }: Props) {
  const id = candidate?.id ?? candidate?.studentId ?? '';

  const handleAction = async (action: 'approve' | 'reject') => {
    await fetch(`/api/admin/promotions/${id}/${action}`, { method: 'POST' });
    window.location.reload();
  };

  return (
    <div className="flex gap-3 mt-4">
      <button
        onClick={() => handleAction('approve')}
        className="flex-1 py-2 rounded-lg bg-brand-success text-white font-cta font-semibold min-h-[44px] hover:opacity-90 transition-opacity"
      >
        Approve
      </button>
      <button
        onClick={() => handleAction('reject')}
        className="flex-1 py-2 rounded-lg bg-brand-danger text-white font-cta font-semibold min-h-[44px] hover:opacity-90 transition-opacity"
      >
        Reject
      </button>
    </div>
  );
}

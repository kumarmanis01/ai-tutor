"use client";
import React from 'react';

type Props = {
  open: boolean;
  values: {
    name: string;
    class_grade: string | null;
    board: string | null;
    preferred_language: string | null;
    subjects: string[] | undefined;
  };
  errors?: Record<string, string>;
  loading?: boolean;
  saving?: boolean;
  onChange: (field: keyof Props['values'], value: any) => void;
  onClose: () => void;
  onSave: () => void;
};

export default function OnboardingModal({ open, values, errors = {}, saving, onChange, onClose, onSave }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form onSubmit={(e) => { e.preventDefault(); onSave(); }} className="relative bg-white rounded-lg shadow-lg w-full max-w-full sm:max-w-md md:max-w-lg lg:max-w-xl mx-auto" style={{ maxHeight: '90vh' }}>
        <div className="sticky top-0 z-10 bg-white px-5 pt-5 pb-3 border-b">
          <h2 className="text-lg font-semibold">Complete your profile</h2>
          <p className="text-sm text-muted-foreground">We need a few details to personalize learning.</p>
        </div>
        <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 112px)' }}>
          <label className="block text-sm mb-1">
            Name <span className="text-red-600">*</span>
          </label>
          <input aria-invalid={!!errors.name} className={`w-full px-3 py-2 border rounded mb-1 ${errors.name ? 'border-red-500' : ''}`} placeholder="Your name" value={values.name} onChange={(e) => onChange('name', e.target.value)} />
          {errors.name && <div className="text-xs text-red-600 mb-2">{errors.name}</div>}
          <div className="mb-3">
            <label className="block text-sm mb-1">Class <span className="text-red-600">*</span></label>
            <select aria-invalid={!!errors.class_grade} value={values.class_grade ?? ''} onChange={(e) => onChange('class_grade', e.target.value || null)} className={`w-full px-3 py-2 border rounded ${errors.class_grade ? 'border-red-500' : ''}`}>
              <option value="">Select class</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={String(i + 1)}>{String(i + 1)}</option>
              ))}
            </select>
            {errors.class_grade && <div className="text-xs text-red-600 mt-1">{errors.class_grade}</div>}
          </div>
          <div className="mb-3">
            <label className="block text-sm mb-1">Board <span className="text-red-600">*</span></label>
            <select aria-invalid={!!errors.board} value={values.board ?? ''} onChange={(e) => onChange('board', e.target.value || null)} className={`w-full px-3 py-2 border rounded ${errors.board ? 'border-red-500' : ''}`}>
              <option value="">Select board</option>
              <option>CBSE</option>
              <option>ICSE</option>
              <option>State Board</option>
              <option>Other</option>
            </select>
            {errors.board && <div className="text-xs text-red-600 mt-1">{errors.board}</div>}
          </div>
          <div className="mb-3">
            <label className="block text-sm mb-1">Preferred language <span className="text-red-600">*</span></label>
            <select aria-invalid={!!errors.preferred_language} value={values.preferred_language ?? ''} onChange={(e) => onChange('preferred_language', e.target.value || null)} className={`w-full px-3 py-2 border rounded ${errors.preferred_language ? 'border-red-500' : ''}`}>
              <option value="">Choose language</option>
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
            </select>
            {errors.preferred_language && <div className="text-xs text-red-600 mt-1">{errors.preferred_language}</div>}
          </div>
          <div className="mb-3">
            <label className="block text-sm mb-1">Subjects (optional)</label>
            <div className="grid grid-cols-2 gap-2">
              {['Mathematics','Science','English','Hindi','Physics','Chemistry','Biology'].map((s) => (
                <button type="button" key={s} onClick={() => {
                  const prev = values.subjects ?? [];
                  const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s];
                  onChange('subjects', next.length ? next : undefined);
                }} className={`px-3 py-2 border rounded text-left ${values.subjects?.includes(s) ? 'bg-primary/10 border-primary' : ''}`}>
                  {values.subjects?.includes(s) ? '☑︎ ' : '◻︎ '} {s}
                </button>
              ))}
            </div>
          </div>
          {errors._root && <div className="text-sm text-red-600 mb-2">{errors._root}</div>}
        </div>
        <div className="sticky bottom-0 z-10 bg-white px-5 py-3 border-t flex justify-end gap-3">
          <button type="button" className="px-4 py-2 border rounded" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={!!saving} className="px-4 py-2 bg-primary text-white rounded">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

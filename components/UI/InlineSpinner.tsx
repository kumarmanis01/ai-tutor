import React from 'react';

const InlineSpinner: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => {
  const s = size;
  return (
    <svg
      className={`animate-spin inline-block ${className ?? ''}`}
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.08)" strokeWidth="4" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
};

export default InlineSpinner;

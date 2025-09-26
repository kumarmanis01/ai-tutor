// components/UI/Avatar.tsx
'use client';

import React, { useState } from 'react';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: number; // px
  fallback?: string; // initials or icon
  className?: string;
}

export default function Avatar({ src, alt = 'User avatar', size = 32, fallback, className = '' }: AvatarProps) {
  const [loaded, setLoaded] = useState(false);
  const blankAvatar = (
    <div
      className={`bg-gray-200 rounded-full flex items-center justify-center border ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Optionally show fallback initials or icon */}
      {fallback ? (
        <span className="text-gray-500 font-bold text-lg">{fallback}</span>
      ) : null}
    </div>
  );

  return src ? (
    <>
      {!loaded && blankAvatar}
      <img
        src={src}
        alt={alt}
        className={`rounded-full object-cover border ${loaded ? '' : 'hidden'} ${className}`}
        style={{ width: size, height: size }}
        onLoad={() => setLoaded(true)}
        loading="lazy"
      />
    </>
  ) : (
    blankAvatar
  );
}

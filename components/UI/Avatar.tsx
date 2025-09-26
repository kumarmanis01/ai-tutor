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
  const [error, setError] = useState(false);

  // Spinner SVG
  const spinner = (
    <svg className="animate-spin absolute inset-0 m-auto" width={size/2} height={size/2} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="gray" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="gray" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );

  // Always show initials until image is loaded, or if no image is provided
  return (
    <div
      className={`bg-gray-200 rounded-full flex items-center justify-center border relative overflow-hidden ${!loaded && src ? 'border-blue-500' : 'border'} ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Initials fallback always visible until image loads or error */}
      {((!src || !loaded || error) && fallback) ? (
        <span className="text-gray-500 font-bold text-lg absolute inset-0 flex items-center justify-center">{fallback}</span>
      ) : null}
      {/* Spinner while loading image */}
      {src && !loaded && !error && spinner}
      {src && !error && (
        <img
          src={src}
          alt={alt}
          className={`rounded-full object-cover border absolute inset-0 w-full h-full ${loaded ? '' : 'hidden'}`}
          style={{ width: size, height: size }}
          onLoad={() => {
            setLoaded(true);
            console.log('Avatar image loaded:', src);
          }}
          onError={() => {
            setError(true);
            console.warn('Avatar image failed to load:', src);
          }}
          loading="lazy"
        />
      )}
    </div>
  );
}

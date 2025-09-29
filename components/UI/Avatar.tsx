'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: number; // px
  fallback?: string; // initials or icon
  className?: string;
}

export default function Avatar({
  src,
  alt = 'User avatar',
  size = 32,
  fallback,
  className = '',
}: AvatarProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Spinner SVG
  const spinner = (
    <svg className="animate-spin" width={size / 2} height={size / 2} viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="gray"
        strokeWidth="4"
        fill="none"
      />
      <path className="opacity-75" fill="gray" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );

  return (
    <div
      className={`bg-gray-200 rounded-full flex items-center justify-center border relative overflow-hidden ${!loaded && src ? 'border-blue-500' : 'border'} ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Optimized Image */}
      {src && !error && (
        <Image
          src={src}
          alt={alt}
          className="rounded-full object-cover w-full h-full absolute inset-0"
          width={size}
          height={size}
          style={{
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.2s',
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          loading="lazy"
        />
      )}
      {/* Spinner while loading */}
      {src && !loaded && !error && (
        <span className="absolute inset-0 flex items-center justify-center">{spinner}</span>
      )}
      {/* Fallback if no src or error */}
      {(!src || error) && (
        <span
          className="text-gray-500 font-bold text-lg flex items-center justify-center w-full h-full absolute inset-0"
          style={{ lineHeight: `${size}px` }}
        >
          {fallback}
        </span>
      )}
    </div>
  );
}

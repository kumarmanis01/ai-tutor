'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface AppImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  fill?: boolean;
  sizes?: string;
  onClick?: () => void;
  fallbackSrc?: string;
  [key: string]: any;
}

function AppImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 75,
  placeholder = 'empty',
  blurDataURL,
  fill = false,
  sizes,
  onClick,
  fallbackSrc = '/assets/images/no_image.png',
  ...props
}: AppImageProps) {
  // Capture and remove any legacy onLoadingComplete prop from forwarded props
  const { onLoadingComplete, ...restProps } = props as Record<string, any>;
  const [imageSrc, setImageSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // More reliable external URL detection
  const isExternal = imageSrc.startsWith('http://') || imageSrc.startsWith('https://');
  const isLocal =
    imageSrc.startsWith('/') || imageSrc.startsWith('./') || imageSrc.startsWith('data:');

  const handleError = () => {
    if (!hasError && imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc);
      setHasError(true);
    }
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const commonClassName = `${className} ${isLoading ? 'animate-pulse bg-gray-200' : ''} ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`;

  // For external URLs or when in doubt, use regular img tag
  if (isExternal && !isLocal) {
    const imgStyle: React.CSSProperties = {};

    if (width) imgStyle.width = width;
    if (height) imgStyle.height = height;

    if (fill) {
      return (
        <div
          className={`relative ${className}`}
          style={{ width: width || '100%', height: height || '100%' }}
        >
          {/* Using next/image for external URLs but mapping onLoad handler (replaces deprecated onLoadingComplete) */}
          <Image
            src={imageSrc}
            alt={alt || ''}
            className={`${commonClassName} absolute inset-0 w-full h-full object-cover`}
            onError={handleError}
            onLoad={(e) => {
              // next/image provides a SyntheticEvent; call our handler
              handleLoad();
              if (typeof onLoadingComplete === 'function') {
                try {
                  onLoadingComplete(e.currentTarget as HTMLImageElement);
                } catch {
                  // swallow legacy handler errors
                }
              }
            }}
            onClick={onClick}
            fill
            sizes={sizes || '100vw'}
            style={imgStyle}
            {...restProps}
          />
        </div>
      );
    }

    return (
      <Image
        src={imageSrc}
        alt={alt || ''}
        className={commonClassName}
        onError={handleError}
        onLoad={(e) => {
          handleLoad();
          if (typeof onLoadingComplete === 'function') {
            try {
              onLoadingComplete(e.currentTarget as HTMLImageElement);
            } catch {
              /* ignore */
            }
          }
        }}
        onClick={onClick}
        unoptimized
        width={width || 400}
        height={height || 300}
        {...restProps}
      />
    );
  }

  // For local images and data URLs, use Next.js Image component
  const imageProps = {
    src: imageSrc,
    alt,
    className: commonClassName,
    priority,
    quality,
    placeholder,
    blurDataURL,
    unoptimized: true,
    onError: handleError,
    onLoad: (e: any) => {
      handleLoad();
      if (typeof onLoadingComplete === 'function') {
        try {
          onLoadingComplete(e.currentTarget as HTMLImageElement);
        } catch {
          /* ignore */
        }
      }
    },
    onClick,
    ...restProps,
  };

  // Avoid duplicate `alt` prop when spreading imageProps — create a copy without alt
  const imagePropsNoAlt = { ...imageProps } as Record<string, any>;
  delete imagePropsNoAlt.alt;

  if (fill) {
    return (
      <div className={`relative ${className}`}>
        <Image
          src={imageSrc}
          alt={alt || ''}
          {...imagePropsNoAlt}
          fill
          sizes={sizes || '100vw'}
          style={{ objectFit: 'cover' }}
        />
      </div>
    );
  }

  return (
    <Image
      src={imageSrc}
      alt={alt || ''}
      {...imagePropsNoAlt}
      width={width || 400}
      height={height || 300}
    />
  );
}

export default AppImage;

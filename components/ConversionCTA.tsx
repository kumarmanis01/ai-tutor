'use client';

import { useState } from 'react';
import Icon from '@/components/UI/AppIcon';

interface ConversionCTAProps {
  variant?: 'header' | 'hero' | 'pricing' | 'final';
  className?: string;
  onClick?: () => void;
}

const ConversionCTA = ({ variant = 'hero', className = '', onClick }: ConversionCTAProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const variantStyles = {
    header: 'px-4 py-2 text-sm md:px-6 md:py-2.5',
    hero: 'px-6 py-3 text-base md:px-8 md:py-4 md:text-lg',
    pricing: 'px-6 py-3 text-base md:px-8 md:py-3.5',
    final: 'px-8 py-4 text-lg md:px-10 md:py-5 md:text-xl',
  };

  const variantText = {
    header: { en: 'Start Free', hi: 'मुफ्त शुरू करें' },
    hero: { en: 'Start Free Learning', hi: 'मुफ्त सीखना शुरू करें' },
    pricing: { en: 'Start Free Trial', hi: 'मुफ्त परीक्षण शुरू करें' },
    final: { en: 'Start Free Learning Now', hi: 'अभी मुफ्त सीखना शुरू करें' },
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      const element = document.querySelector('#signup-form-widget');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        inline-flex items-center justify-center gap-2
        bg-primary hover:bg-accent text-primary-foreground
        font-cta font-semibold rounded-lg
        shadow-cta hover:shadow-lg
        transition-all duration-250 ease-in-out
        transform hover:scale-105 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
        ${variantStyles[variant]}
        ${className}
      `}
      aria-label={variantText[variant].en}
    >
      <span className="font-body">{variantText[variant].en}</span>
      <Icon
        name="ArrowRightIcon"
        size={variant === 'header' ? 18 : variant === 'final' ? 24 : 20}
        variant="outline"
        className={`transition-transform duration-250 ${isHovered ? 'translate-x-1' : ''}`}
      />
    </button>
  );
};

export default ConversionCTA;

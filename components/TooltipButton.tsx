// TooltipButton.tsx
"use client";
import React, { useState, useRef, useEffect, FC, ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipButtonProps extends React.HTMLAttributes<HTMLElement> {
  label: string;
  iconSrc?: string;
  badge?: number | string;
  size?: number;
  children?: ReactNode;
  fullWidth?: boolean;
  as?: "div" | "button"; // allow rendering as button
  disabled?: boolean;
  // onClick is provided by React.HTMLAttributes, but you can still declare it explicitly if you prefer:
  onClick?: React.MouseEventHandler<HTMLElement>;
}

const TooltipButton: FC<TooltipButtonProps> = ({
  label,
  iconSrc,
  badge,
  size = 32,
  children,
  fullWidth = false,
  as = "div",
  onClick,
  disabled,
  ...rest
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  const buttonRef = useRef<HTMLElement | null>(null);
  
  // Callback ref to handle both div and button elements
  const setButtonRef = (element: HTMLElement | null) => {
    buttonRef.current = element;
  };

  // Ensure we're mounted (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update tooltip position on scroll/resize when tooltip is visible
  useEffect(() => {
    if (!showTooltip || !buttonRef.current) return;

    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setTooltipPosition({
          top: rect.bottom + 12,
          left: rect.left + rect.width / 2,
        });
      }
    };

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showTooltip]);

  const handleMouseEnter = (e?: React.MouseEvent<HTMLElement>) => {
    // Only show tooltips on desktop (non-mobile)
    if (isMobile) return;
    // Calculate tooltip position - use a small delay to ensure element is rendered
    const calculatePosition = () => {
      // Try to get the ref, or use the event target as fallback
      const element = buttonRef.current || (e?.currentTarget as HTMLElement);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTooltipPosition({
          top: rect.bottom + 12, // 12px = mt-3 (12px)
          left: rect.left + rect.width / 2, // Center of button
        });
        return true;
      }
      return false;
    };
    // Calculate position immediately
    calculatePosition();
    // show after 1s, recalculate position right before showing
    timeoutRef.current = window.setTimeout(() => {
      if (calculatePosition()) {
        setShowTooltip(true);
      }
    }, 1000);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    setShowTooltip(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    // Hide tooltip on click/touch (mobile)
    if (showTooltip) {
      setShowTooltip(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    }
    if (onClick && !disabled) {
      onClick(e);
    }
  };

  const Tag = as as any;

  return (
    <Tag
      ref={setButtonRef}
      className={`relative ${
        fullWidth ? "flex-1" : "inline-flex"
      } items-center justify-center`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      disabled={disabled}
      {...rest}
    >
      {children ? (
        children
      ) : iconSrc ? (
        <img src={iconSrc} alt={label} className="h-4 w-4 svg-icon" />
      ) : null}

      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white z-50">
          {badge}
        </span>
      )}

      {mounted && showTooltip && createPortal(
        <span 
          className="fixed px-2 py-1 text-xs text-white bg-black rounded whitespace-nowrap z-[9999] pointer-events-none" 
          style={{ 
            backgroundColor: 'var(--text-primary)', 
            color: 'var(--card-bg)',
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translateX(-50%)'
          }}
        >
          {label}
        </span>,
        document.body
      )}
    </Tag>
  );
};

export default TooltipButton;

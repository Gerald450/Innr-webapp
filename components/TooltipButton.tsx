// TooltipButton.tsx
"use client";
import React, { useState, useRef, useEffect, FC, ReactNode } from "react";

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
  const timeoutRef = useRef<number | undefined>(undefined);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMouseEnter = () => {
    // Only show tooltips on desktop (non-mobile)
    if (isMobile) return;
    // show after 1s
    timeoutRef.current = window.setTimeout(() => setShowTooltip(true), 1000);
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
        <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
          {badge}
        </span>
      )}

      {showTooltip && (
        <span className="absolute left-1/2 top-full mt-3 -translate-x-1/2 px-2 py-1 text-xs text-white bg-black rounded whitespace-nowrap opacity-50 z-50" style={{ backgroundColor: 'var(--text-primary)', color: 'var(--card-bg)' }}>
          {label}
        </span>
      )}
    </Tag>
  );
};

export default TooltipButton;

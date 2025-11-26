import { useState, useRef, FC, ReactNode } from "react";

interface TooltipButtonProps {
  label: string;            // Tooltip text
  iconSrc: string;          // Icon image source
  badge?: number | string;  // Optional badge (e.g., notification count)
  size?: number;            // Tailwind h/w size (default 8 = 2rem)
  children?: ReactNode;     // Optional children (if you want to override icon)
}

const TooltipButton: FC<TooltipButtonProps> = ({ label, iconSrc, badge, size = 8, children }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<number | undefined>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = window.setTimeout(() => {
      setShowTooltip(true);
    }, 1000); // 1 second delay
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowTooltip(false);
  };

  return (
    <button
      className={`relative flex h-${size} w-${size} items-center justify-center rounded-full bg-[#e4e6eb] transition hover:bg-[#d8dadf]`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={label}
    >
      {children ? children : <img src={iconSrc} alt={label} className="h-4 w-4" />}

      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
          {badge}
        </span>
      )}

      {showTooltip && (
        <span className="absolute left-1/2 top-full mt-4 -translate-x-1/2 px-2 py-1 text-xs text-white bg-black rounded transition-opacity opacity-50">
          {label}
        </span>
      )}
    </button>
  );
};

export default TooltipButton;

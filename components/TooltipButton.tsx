import { useState, useRef, FC, ReactNode } from "react";

interface TooltipButtonProps {
  label: string;
  iconSrc?: string;
  badge?: number | string;
  size?: number;
  children?: ReactNode;
  fullWidth?: boolean;
  as?: "div" | "button"; // allow rendering as button
}

const TooltipButton: FC<TooltipButtonProps> = ({
  label,
  iconSrc,
  badge,
  size = 32,
  children,
  fullWidth = false,
  as = "div",
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);

  const handleMouseEnter = () => {
    timeoutRef.current = window.setTimeout(() => setShowTooltip(true), 1000);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowTooltip(false);
  };

  const Tag = as as any;

  return (
    <Tag
      className={`relative ${
        fullWidth ? "flex-1" : "inline-flex"
      } items-center justify-center`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children ? (
        children
      ) : (
        <img src={iconSrc} alt={label} className="h-4 w-4" />
      )}
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
          {badge}
        </span>
      )}
      {showTooltip && (
        <span className="absolute left-1/2 top-full mt-3 -translate-x-1/2 px-2 py-1 text-xs text-white bg-black rounded whitespace-nowrap opacity-50">
          {label}
        </span>
      )}
    </Tag>
  );
};

export default TooltipButton;

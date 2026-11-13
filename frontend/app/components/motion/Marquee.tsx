import type { ReactNode } from "react";

interface MarqueeProps {
  children: ReactNode;
  /** Seconds for one full pass. */
  duration?: number;
  reverse?: boolean;
  className?: string;
}

/**
 * CSS-only infinite ticker. The track is duplicated so the loop is seamless,
 * and it pauses on hover. Decorative content should be marked aria-hidden.
 */
export default function Marquee({
  children,
  duration = 32,
  reverse = false,
  className = "",
}: MarqueeProps) {
  return (
    <div className={`marquee ${className}`}>
      <div
        className="marquee__track"
        style={{
          animationDuration: `${duration}s`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        <div className="marquee__group">{children}</div>
        <div className="marquee__group" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

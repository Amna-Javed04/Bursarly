"use client";

import { useCallback, useRef, type ReactNode } from "react";

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  /** Colour of the cursor-following glow. */
  glow?: string;
  /** Adds a gentle 3D tilt that follows the cursor. */
  tilt?: boolean;
}

/**
 * A surface that tracks the cursor with a soft radial glow and optional
 * parallax tilt. Uses direct CSS variable writes so the pointer never
 * triggers a React re-render.
 */
export default function SpotlightCard({
  children,
  className = "",
  glow = "rgba(18, 214, 166, 0.16)",
  tilt = false,
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);

  const handleMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const node = ref.current;
      if (!node || frame.current !== null) return;

      const { clientX, clientY } = event;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const rect = node.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        node.style.setProperty("--spot-x", `${x}px`);
        node.style.setProperty("--spot-y", `${y}px`);

        if (tilt) {
          const rx = ((y - rect.height / 2) / rect.height) * -5;
          const ry = ((x - rect.width / 2) / rect.width) * 5;
          node.style.setProperty("--tilt-x", `${rx.toFixed(2)}deg`);
          node.style.setProperty("--tilt-y", `${ry.toFixed(2)}deg`);
        }
      });
    },
    [tilt]
  );

  const handleLeave = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--tilt-x", "0deg");
    node.style.setProperty("--tilt-y", "0deg");
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ ["--spot-glow" as string]: glow }}
      className={`spotlight-card ${tilt ? "spotlight-tilt" : ""} ${className}`}
    >
      <span className="spotlight-card__glow" aria-hidden="true" />
      <div className="spotlight-card__content">{children}</div>
    </div>
  );
}

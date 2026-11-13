"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

interface CountUpProps {
  to: number;
  /** Text rendered after the animated number, e.g. "+". */
  suffix?: string;
  /** Text rendered instead of a number (skips the animation). */
  label?: string;
  /** Seconds for the count-up. */
  duration?: number;
  className?: string;
}

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Animates a number from 0 to `to` with requestAnimationFrame.
 * Deterministic: it always lands on the exact value, even if the element is
 * off-screen or the tab was backgrounded.
 */
export default function CountUp({
  to,
  suffix = "",
  label,
  duration = 1.4,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (label) return;

    if (reduce) {
      setValue(to);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const total = Math.max(duration, 0.2) * 1000;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / total, 1);
      setValue(Math.round(easeOutExpo(progress) * to));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setValue(to);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, duration, reduce, label]);

  return (
    <span ref={ref} className={className}>
      {label ?? `${value}${suffix}`}
    </span>
  );
}

"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds to wait before animating. */
  delay?: number;
  /** Distance in px the element travels while fading in. */
  y?: number;
  /** Scale the element up slightly as it lands. */
  scale?: boolean;
  /** Animate on mount instead of waiting for the element to enter view. */
  onMount?: boolean;
  id?: string;
}

export default function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  scale = false,
  onMount = false,
  id,
}: RevealProps) {
  const reduce = useReducedMotion();

  const variants: Variants = {
    hidden: {
      opacity: 0,
      y: reduce ? 0 : y,
      scale: scale && !reduce ? 0.97 : 1,
      filter: reduce ? "blur(0px)" : "blur(6px)",
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: { duration: 0.85, delay, ease: EASE },
    },
  };

  if (onMount) {
    return (
      <motion.div
        id={id}
        className={className}
        initial="hidden"
        animate="visible"
        variants={variants}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      id={id}
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

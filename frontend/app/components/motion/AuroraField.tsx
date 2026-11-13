interface AuroraFieldProps {
  /** Extra classes for the wrapper. */
  className?: string;
  /** Opacity of the glow blobs. */
  intensity?: number;
  /** Adds the fine dot grid behind the blobs. */
  grid?: boolean;
  /** Dark surfaces (footer) keep the fade to ink; light pages do not. */
  fadeToInk?: boolean;
}

/**
 * Ambient glow: slow drifting pink / lavender / peach blobs + optional dot grid.
 * Pure CSS so it costs nothing on the main thread, and it never repaints the
 * base colour — the page canvas stays continuous underneath.
 */
export default function AuroraField({
  className = "",
  intensity = 0.55,
  grid = true,
  fadeToInk = false,
}: AuroraFieldProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity: intensity }}
    >
      <div className="aurora-blob aurora-blob--jade" />
      <div className="aurora-blob aurora-blob--cobalt" />
      <div className="aurora-blob aurora-blob--gold" />
      {grid && <div className="aurora-grid absolute inset-0" />}
      {fadeToInk && (
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--ink)]/80" />
      )}
    </div>
  );
}

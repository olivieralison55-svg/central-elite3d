"use client";

import { useEffect, useRef } from "react";
import { Play } from "lucide-react";

export interface TranscriptTurnItem {
  speaker: string; // "Q" (interviewer) or "A" (participant)
  startTime: number;
  endTime: number;
  text: string;
  turnIndex: number;
}

function formatClock(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Q/A transcript list with playback sync: the turn containing
 * `activeTime` is highlighted and scrolled into view; clicking a turn's
 * timestamp emits onTurnClick(startTime, turn). Per-turn extra content
 * (tag pills, actions) renders through the renderTurnExtra slot.
 * Each block carries data-turn-index for selection-based flows.
 */
export default function TranscriptViewer({
  turns,
  activeTime = null,
  onTurnClick,
  renderTurnExtra,
  renderTurnMetaExtra,
  speakerLabels = { q: "Interviewer", a: "Participant" },
  className = "",
}: {
  turns: TranscriptTurnItem[];
  activeTime?: number | null;
  onTurnClick?: (startTime: number, turn: TranscriptTurnItem) => void;
  renderTurnExtra?: (turn: TranscriptTurnItem) => React.ReactNode;
  renderTurnMetaExtra?: (turn: TranscriptTurnItem) => React.ReactNode;
  speakerLabels?: { q: string; a: string };
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef<number | null>(null);

  const activeIndex =
    activeTime === null
      ? null
      : turns.find((t) => activeTime >= t.startTime && activeTime <= t.endTime)?.turnIndex ?? null;

  useEffect(() => {
    if (activeIndex === null || activeIndex === activeIndexRef.current) return;
    activeIndexRef.current = activeIndex;
    containerRef.current
      ?.querySelector(`[data-turn-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  return (
    <div ref={containerRef} className={`flex flex-col gap-2 ${className}`}>
      {turns.map((turn) => {
        const isQ = turn.speaker === "Q";
        const isActive = turn.turnIndex === activeIndex;
        return (
          <div
            key={turn.turnIndex}
            data-turn-index={turn.turnIndex}
            className={`group rounded-lg border px-3.5 py-2.5 transition-colors duration-quick ${
              isActive
                ? "border-primary/40 bg-selected"
                : "border-transparent hover:bg-sub-bg"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-semibold uppercase tracking-wide ${
                  isQ ? "text-muted" : "text-primary"
                }`}
              >
                {isQ ? speakerLabels.q : speakerLabels.a}
              </span>
              {renderTurnMetaExtra?.(turn)}
              <button
                type="button"
                onClick={() => onTurnClick?.(turn.startTime, turn)}
                className="ml-auto flex shrink-0 items-center gap-1 rounded-6 px-1.5 py-0.5 text-[11px] tabular-nums text-muted transition-colors duration-quick hover:bg-selected hover:text-ink"
              >
                <Play size={10} />
                {formatClock(turn.startTime)}
              </button>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-ink">{turn.text}</p>
            {renderTurnExtra?.(turn)}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AlertCircle, Pause, Play } from "lucide-react";

export interface AudioPlayerHandle {
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
}

function formatClock(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Compact audio player — play/pause, click-to-seek progress bar and
 * current/total time. Controlled from outside via the imperative ref
 * (seek/play/pause) so a transcript can drive playback; emits
 * onTimeUpdate so the transcript can highlight the active turn.
 */
const AudioPlayer = forwardRef<
  AudioPlayerHandle,
  {
    src: string | null;
    onTimeUpdate?: (time: number) => void;
    /** Fired when the source fails to load, so the owner can find out why. */
    onError?: () => void;
    /** Shown instead of the generic failure text. The primitive cannot know why
        a source failed — whoever owns the source does. */
    errorMessage?: string;
    className?: string;
  }
>(function AudioPlayer(
  { src, onTimeUpdate, onError, errorMessage, className = "" },
  ref,
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  // A new source is a new verdict: without this, one unplayable recording would
  // keep the next one it replaces looking broken.
  useEffect(() => {
    setFailed(false);
    setDuration(0);
    setCurrentTime(0);
  }, [src]);

  useImperativeHandle(ref, () => ({
    seek: (time: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = time;
    },
    play: () => void audioRef.current?.play(),
    pause: () => audioRef.current?.pause(),
  }));

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play();
  }

  function seekFromClick(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    const bar = barRef.current;
    if (!audio || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * duration;
  }

  const pct = duration ? (currentTime / duration) * 100 : 0;
  const status = !src ? "missing" : failed ? "failed" : "ok";

  return (
    <div className={`flex items-center gap-3 rounded-lg border border-line bg-sub-bg px-3 py-2.5 ${className}`}>
      {/* metadata only: duration without downloading the whole track */}
      <audio
        ref={audioRef}
        src={src ?? undefined}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
          onTimeUpdate?.(e.currentTarget.currentTime);
        }}
        // The whole reason a three-week outage went unnoticed: a source that
        // never loads used to leave a normal-looking player stuck at 0:00, with
        // nothing on screen and nothing in the console.
        onError={() => {
          setFailed(true);
          setPlaying(false);
          console.error("[audio-player] failed to load source:", src);
          onError?.();
        }}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={!src || failed}
        aria-label={playing ? "Pause" : "Play"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white transition duration-quick ease-out-quart hover:bg-primary-dark disabled:pointer-events-none disabled:opacity-50"
      >
        {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        {status === "ok" ? (
          <>
            <div
              ref={barRef}
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              tabIndex={0}
              onClick={seekFromClick}
              className="h-1.5 cursor-pointer overflow-hidden rounded-full bg-selected"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 flex gap-1 text-[11px] tabular-nums text-muted">
              <span data-testid="audio-current">{formatClock(currentTime)}</span>
              <span>/</span>
              <span data-testid="audio-total">{formatClock(duration)}</span>
            </div>
          </>
        ) : (
          /* "no recording" and "the recording would not load" are different
             facts about the interview, so they do not share a message. */
          <p
            data-testid="audio-status"
            className={`flex items-center gap-1.5 text-[12px] ${
              status === "failed" ? "text-danger" : "text-muted"
            }`}
          >
            {status === "failed" && <AlertCircle size={13} className="shrink-0" />}
            {status === "failed"
              ? (errorMessage ?? "Gravação indisponível")
              : "Sem gravação"}
          </p>
        )}
      </div>
    </div>
  );
});

export default AudioPlayer;

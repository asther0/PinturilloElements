"use client";

import { useEffect, useRef, useState } from "react";

const FONT_DISPLAY =
  "var(--font-space-mono), Space Mono, ui-monospace, monospace";

type Step = { key: "3" | "2" | "1" | "go"; label: string; bg: string };

const STEPS: Step[] = [
  { key: "3", label: "3", bg: "#F5D033" },
  { key: "2", label: "2", bg: "#3FC9B6" },
  { key: "1", label: "1", bg: "#F26B4E" },
  { key: "go", label: "¡Comenzamos!", bg: "#A78BFA" },
];

const FALL_MS = 380;
const HOLD_MS = 550;
const FINAL_HOLD_MS = 600;
const LAST_INDEX = STEPS.length - 1;

export default function RoundStartOverlay({ onDone }: { onDone: () => void }) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [poppedIndex, setPoppedIndex] = useState(-1);
  const [exiting, setExiting] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, reduceMotion ? Math.min(ms, 30) : ms));
    let cancelled = false;

    (async () => {
      for (let i = 0; i < STEPS.length; i++) {
        if (cancelled) return;
        setActiveIndex(i);
        await wait(FALL_MS);
        if (cancelled) return;
        setPoppedIndex(i);
        await wait(i === LAST_INDEX ? FINAL_HOLD_MS : HOLD_MS);
      }
      if (cancelled) return;
      setExiting(true);
      await wait(FALL_MS);
      if (cancelled) return;
      onDoneRef.current();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="absolute inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {STEPS.map((step, i) => (
        <div
          key={step.key}
          className="absolute inset-0 flex origin-top items-center justify-center transition-transform duration-[380ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:duration-[1ms]"
          style={{
            zIndex: i + 1,
            backgroundColor: step.bg,
            transform:
              exiting && i === LAST_INDEX
                ? "translateY(100%)"
                : i <= activeIndex
                  ? "scaleY(1)"
                  : "scaleY(0)",
          }}
        >
          <span
            className={`px-6 text-center font-bold text-[#111111] transition-all duration-[260ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:duration-[1ms] ${
              step.key === "go" ? "text-[26px] sm:text-[44px]" : "text-[64px] sm:text-[120px]"
            } ${i === poppedIndex ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}
            style={{ fontFamily: FONT_DISPLAY, lineHeight: 1 }}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

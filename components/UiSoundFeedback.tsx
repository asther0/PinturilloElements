"use client";

import { useEffect } from "react";
import { getUiSoundClickTarget, playUiClickSound } from "@/lib/uiSound";

export function UiSoundFeedback() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (getUiSoundClickTarget(event.target)) playUiClickSound();
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}

export const UI_CLICK_SOUND_PATH = "/petdex-sounds/noir-webling.mp3";
export const UI_CLICK_SOUND_VOLUME = 0.22;
export const UI_CLICK_SOUND_CUTOFF_MS = 120;
export const UI_CLICK_TARGET_SELECTOR = 'button, a, [role="button"]';

type SoundFeedbackTarget = {
  matches(selector: string): boolean;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
};

let activeAudio: HTMLAudioElement | null = null;
let cutoffTimer: ReturnType<typeof setTimeout> | undefined;

export function isUiSoundEligible(target: SoundFeedbackTarget): boolean {
  return (
    target.matches(UI_CLICK_TARGET_SELECTOR) &&
    !target.hasAttribute("disabled") &&
    target.getAttribute("aria-disabled")?.toLowerCase() !== "true" &&
    target.getAttribute("data-sound")?.toLowerCase() !== "off"
  );
}

export function getUiSoundClickTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;

  const interactiveTarget = target.closest(UI_CLICK_TARGET_SELECTOR);
  return interactiveTarget instanceof HTMLElement && isUiSoundEligible(interactiveTarget)
    ? interactiveTarget
    : null;
}

export function playUiClickSound(): void {
  if (typeof Audio === "undefined") return;

  try {
    const audio = activeAudio || new Audio(UI_CLICK_SOUND_PATH);
    activeAudio = audio;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = UI_CLICK_SOUND_VOLUME;

    if (cutoffTimer) clearTimeout(cutoffTimer);

    void audio.play().catch(() => {
      // Sound feedback is optional when playback is unavailable.
    });

    cutoffTimer = setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      cutoffTimer = undefined;
    }, UI_CLICK_SOUND_CUTOFF_MS);
  } catch {
    // Creating or controlling browser audio can fail in restricted contexts.
  }
}

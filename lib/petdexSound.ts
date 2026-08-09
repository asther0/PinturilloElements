import { PETDEX_CATALOG_BY_SPRITESHEET } from "@/lib/petdexCatalog";

export const PETDEX_SOUND_VOLUME = 0.45;

export type PetdexSoundSource = {
  slug?: string;
  spritesheetUrl?: string;
};

let activeAudio: HTMLAudioElement | null = null;

export function getLocalPetdexSoundPath(source: PetdexSoundSource): string | undefined {
  const pet = source.spritesheetUrl
    ? PETDEX_CATALOG_BY_SPRITESHEET.get(source.spritesheetUrl)
    : undefined;

  return pet?.localSoundPath;
}

export function playPetdexSound(source: PetdexSoundSource | undefined): void {
  if (!source || typeof Audio === "undefined") return;

  const soundPath = getLocalPetdexSoundPath(source);
  if (!soundPath) return;

  const audio = activeAudio || new Audio();
  activeAudio = audio;
  audio.pause();
  audio.src = soundPath;
  audio.volume = PETDEX_SOUND_VOLUME;
  audio.currentTime = 0;

  void audio.play().catch(() => {
    // Browsers can reject playback before a user gesture. Sound is optional.
  });
}

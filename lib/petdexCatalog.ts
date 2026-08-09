export type PetdexCatalogPet = {
  slug: string;
  displayName: string;
  spritesheetPath: string;
  dominantColor?: string;
  localAssetPath: string;
  soundUrl?: string;
  localSoundPath?: string;
};

// Captured from GET /petdex-api/pets/search?limit=24&sort=popular.
// Keep spritesheetPath as the canonical Petdex source for room metadata while
// rendering localAssetPath so the avatar picker is entirely self-contained.
export const PETDEX_CATALOG: readonly PetdexCatalogPet[] = [
  { slug: "nezukocoder", displayName: "NezukoCoder", spritesheetPath: "https://assets.petdex.dev/pets/nezukocoder-7d766f7c2597/sprite.webp", dominantColor: "#c65922", localAssetPath: "/petdex/nezukocoder.jpg", soundUrl: "https://assets.petdex.dev/pets/nezukocoder-7d766f7c2597/sound.mp3", localSoundPath: "/petdex-sounds/nezukocoder.mp3" },
  { slug: "shinchan", displayName: "Shinchan", spritesheetPath: "https://assets.petdex.dev/pets/shinchan-154a84d8ff3c/sprite.webp", dominantColor: "#de1f1a", localAssetPath: "/petdex/shinchan.jpg", soundUrl: "https://assets.petdex.dev/pets/shinchan-154a84d8ff3c/sound.mp3", localSoundPath: "/petdex-sounds/shinchan.mp3" },
  { slug: "capvolt", displayName: "Pikachu\u200c", spritesheetPath: "https://assets.petdex.dev/pets/capvolt-7be64ef6cfa2/sprite.webp", dominantColor: "#f7d605", localAssetPath: "/petdex/capvolt.jpg" },
  { slug: "lulu-capybara-2", displayName: "噜噜", spritesheetPath: "https://assets.petdex.dev/pets/lulu-capybara-9f9107636ecc/sprite.webp", localAssetPath: "/petdex/lulu-capybara-2.jpg" },
  { slug: "doraemon", displayName: "Doraemon", spritesheetPath: "https://assets.petdex.dev/pets/doraemon-58b12a5012e0/sprite.webp", dominantColor: "#048ae1", localAssetPath: "/petdex/doraemon.jpg", soundUrl: "https://assets.petdex.dev/pets/doraemon-58b12a5012e0/sound.mp3", localSoundPath: "/petdex-sounds/doraemon.mp3" },
  { slug: "yuexinmiao", displayName: "月薪喵", spritesheetPath: "https://assets.petdex.dev/pets/yuexinmiao-f35a9aec318c/sprite.webp", dominantColor: "#cc4ca4", localAssetPath: "/petdex/yuexinmiao.jpg" },
  { slug: "qqpet-codex", displayName: "QQpet-codex", spritesheetPath: "https://assets.petdex.dev/pets/qqpet-codex-pending-6c6a5a48a512/sprite.png", dominantColor: "#eb8b04", localAssetPath: "/petdex/qqpet-codex.png" },
  { slug: "usagi", displayName: "Usagi", spritesheetPath: "https://assets.petdex.dev/pets/usagi-4e4254c223e6/sprite.webp", dominantColor: "#ceba89", localAssetPath: "/petdex/usagi.jpg" },
  { slug: "doubao-2", displayName: "豆包", spritesheetPath: "https://assets.petdex.dev/pets/doubao-5424aed9fd0f/sprite.webp", dominantColor: "#d925bb", localAssetPath: "/petdex/doubao-2.jpg" },
  { slug: "hoops", displayName: "Hoops", spritesheetPath: "https://assets.petdex.dev/pets/hoops-206e70d7dbd5/sprite.webp", dominantColor: "#f29015", localAssetPath: "/petdex/hoops.jpg" },
  { slug: "noir-webling", displayName: "Noir Webling", spritesheetPath: "https://assets.petdex.dev/curated/noir-webling/spritesheet.webp", dominantColor: "#c117e7", localAssetPath: "/petdex/noir-webling.jpg", soundUrl: "https://assets.petdex.dev/curated/noir-webling/sound.mp3", localSoundPath: "/petdex-sounds/noir-webling.mp3" },
  { slug: "capoo", displayName: "capoo", spritesheetPath: "https://assets.petdex.dev/pets/capoo-ae8a23f3a95e/sprite.webp", dominantColor: "#5cccec", localAssetPath: "/petdex/capoo.jpg" },
  { slug: "hachiware-2", displayName: "小八", spritesheetPath: "https://assets.petdex.dev/pets/hachiware-6d07aabe3762/sprite.webp", dominantColor: "#ecda68", localAssetPath: "/petdex/hachiware-2.jpg" },
  { slug: "bananacat", displayName: "BananaCat", spritesheetPath: "https://assets.petdex.dev/pets/bananacat-e33eb2513db6/sprite.webp", dominantColor: "#fcca05", localAssetPath: "/petdex/bananacat.jpg" },
  { slug: "kirby", displayName: "Kirby", spritesheetPath: "https://assets.petdex.dev/pets/kirby-602269bf05c2/sprite.png", dominantColor: "#e03166", localAssetPath: "/petdex/kirby.png" },
  { slug: "paimo-2", displayName: "Super Paimon", spritesheetPath: "https://assets.petdex.dev/pets/paimo-f2237239b114/sprite.webp", dominantColor: "#417cb1", localAssetPath: "/petdex/paimo-2.jpg" },
  { slug: "eve", displayName: "EVE", spritesheetPath: "https://assets.petdex.dev/pets/eve-743f1e0e6b0d/sprite.webp", dominantColor: "#04dafc", localAssetPath: "/petdex/eve.jpg" },
  { slug: "kun-like", displayName: "Kun Like", spritesheetPath: "https://assets.petdex.dev/pets/kun-like-pending-b038e063f577/sprite.webp", dominantColor: "#e72715", localAssetPath: "/petdex/kun-like.jpg" },
  { slug: "kabi", displayName: "卡比兽", spritesheetPath: "https://assets.petdex.dev/pets/kabi-8d6adeb86474/sprite.webp", dominantColor: "#f47c64", localAssetPath: "/petdex/kabi.jpg" },
  { slug: "aniya", displayName: "Aniya", spritesheetPath: "https://assets.petdex.dev/pets/aniya-b3bf1f1ce1a0/sprite.webp", dominantColor: "#bc6966", localAssetPath: "/petdex/aniya.jpg" },
  { slug: "round-maodie-c63864e8", displayName: "圆头耄耋", spritesheetPath: "https://assets.petdex.dev/pets/round-maodie-c63864e8-173bca87-714/sprite.webp", dominantColor: "#b1854c", localAssetPath: "/petdex/round-maodie-c63864e8.jpg" },
  { slug: "a-tom", displayName: "A Tom", spritesheetPath: "https://assets.petdex.dev/pets/a-tom-0b70614c22ef/sprite.webp", dominantColor: "#c8bd4a", localAssetPath: "/petdex/a-tom.jpg" },
  { slug: "einstein", displayName: "Einstein", spritesheetPath: "https://assets.petdex.dev/pets/einstein-6cd31a3aab54/sprite.webp", dominantColor: "#f2bd6c", localAssetPath: "/petdex/einstein.jpg", soundUrl: "https://assets.petdex.dev/pets/einstein-6cd31a3aab54/sound.mp3", localSoundPath: "/petdex-sounds/einstein.mp3" },
  { slug: "nezuko", displayName: "Nezuko", spritesheetPath: "https://assets.petdex.dev/pets/nezuko-6856df028590/sprite.webp", dominantColor: "#cb6226", localAssetPath: "/petdex/nezuko.jpg", soundUrl: "https://assets.petdex.dev/pets/nezuko-6856df028590/sound.mp3", localSoundPath: "/petdex-sounds/nezuko.mp3" },
];

export const PETDEX_INITIAL_VISIBLE_COUNT = 12;

export const PETDEX_CATALOG_BY_SPRITESHEET = new Map(
  PETDEX_CATALOG.map((pet) => [pet.spritesheetPath, pet])
);

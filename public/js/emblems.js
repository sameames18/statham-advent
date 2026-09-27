// The generated painted picture behind each door, one per film.

export const EMBLEM_SLUGS = [
  'lock-stock-and-two-smoking-barrels',
  'snatch',
  'the-transporter',
  'transporter-2',
  'chaos',
  'revolver',
  'crank',
  'war',
  'the-bank-job',
  'in-the-name-of-the-king',
  'death-race',
  'transporter-3',
  'crank-high-voltage',
  'the-expendables',
  'the-mechanic',
  'blitz',
  'killer-elite',
  'safe',
  'parker',
  'hummingbird',
  'homefront',
  'wild-card',
  'mechanic-resurrection',
  'the-meg',
  'wrath-of-man',
  'operation-fortune',
  'meg-2',
  'the-beekeeper',
  'a-working-man',
  'shelter',
  'mutiny',
];

export function emblemImage(slug, cls = 'emblem-image') {
  const safeSlug = EMBLEM_SLUGS.includes(slug) ? slug : 'the-beekeeper';
  return `<img class="${cls}" src="/emblems/${safeSlug}.webp" alt="" aria-hidden="true" draggable="false">`;
}

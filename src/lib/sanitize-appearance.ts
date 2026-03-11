/**
 * Strip words from AI-generated appearance text that trigger
 * OpenAI's image-generation moderation filter.
 */
const BLOCKED_WORDS = [
  'weapon', 'weapons',
  'blade', 'blades',
  'sword', 'swords',
  'dagger', 'daggers',
  'spear', 'spears',
  'axe', 'axes',
  'knife', 'knives',
  'kill', 'kills', 'killing',
  'blood', 'bloody', 'bleeding',
  'gore', 'gory',
  'death', 'deadly',
  'venom', 'venomous',
  'poison', 'poisonous',
  'toxic',
  'fangs',
  'attack', 'attacking',
  'fight', 'fighting', 'fighter',
  'battle', 'battling',
  'war', 'warrior',
  'destroy', 'destruction',
  'slash', 'slashing',
  'stab', 'stabbing',
  'crush', 'crushing',
  'prey',
  'predator', 'predatory',
  'devour', 'devouring',
  'menacing', 'menace',
  'threatening',
  'fierce', 'ferocious',
  'aggressive',
  'brutal',
  'savage',
  'lethal',
  'combat',
];

const BLOCKED_RE = new RegExp(
  `\\b(${BLOCKED_WORDS.join('|')})\\b`,
  'gi',
);

export function sanitizeForImageGen(text: string): string {
  return text.replace(BLOCKED_RE, '').replace(/\s{2,}/g, ' ').trim();
}

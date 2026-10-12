import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const hub = path.resolve(import.meta.dirname, '..');
const keys = [
  ['solar-flare', 'phoenix-wings'], ['reactor-ring', 'plasma-arcs'],
  ['ripple-pool', 'twin-koi'], ['prism-facets', 'crystal-crown'],
  ['gravity-well', 'stardust-orbit'], ['starflower-wreath', 'butterfly-duet'],
  ['storm-sigil', 'celestial-dragon'], ['divine-halo', 'six-wing-seraph'],
  ['molten-armor', 'oni-horns'], ['spectrum-core', 'supernova-rays'],
  ['spirit-seal', 'nine-tail-spirits'], ['tidal-crown', 'leviathan-arms'],
  ['royal-filigree', 'fortune-orbit'], ['runic-gate', 'astral-spellcraft'],
];

// Read the approved, local mockups. Stop before their interactive DOM setup;
// run only their artwork builders, with no network, file, or UI capabilities.
export function readMockup(pack) {
  const source = fs.readFileSync(path.join(hub, 'mockups', `cosmetics-${pack}.js`), 'utf8');
  const boundary = source.indexOf('  const gallery=');
  if (boundary < 0) throw new Error(`Missing artwork boundary in ${pack}`);
  const context = { document: { getElementById: () => ({}) }, window: { matchMedia: () => ({}) } };
  vm.runInNewContext(source.slice(0, boundary) + 'globalThis.artwork = { concepts, layers, art, fox };})();', context);
  return context.artwork;
}

function topLevelGroups(markup) {
  const groups = [];
  let depth = 0, start = 0;
  for (const match of markup.matchAll(/<\/?[a-zA-Z][\w:-]*\b[^>]*>/g)) {
    const tag = match[0];
    if (tag.startsWith('</')) {
      if (--depth === 0) groups.push(markup.slice(start, match.index + tag.length));
    } else {
      if (depth === 0) start = match.index;
      if (!tag.endsWith('/>')) depth++;
      else if (depth === 0) groups.push(markup.slice(start, match.index + tag.length));
    }
  }
  if (depth) throw new Error('Unbalanced approved SVG artwork');
  return groups;
}

const records = [];
for (const pack of ['after-hours', 'overdrive']) {
  const { concepts, layers, art } = readMockup(pack);
  for (const c of concepts) {
    const [borderKey, accessoryKey] = keys[records.length];
    const original = art(c);
    const gradientId = original.match(/<linearGradient id="(.+?)-metal"/)[1];
    const defs = original.match(/<defs>(.*?)<\/defs>/s)[1].replaceAll(gradientId, '__COSMETIC_ID__');
    const { back, front } = layers(c, '__COSMETIC_ID__');
    const separate = (markup, kind) => topLevelGroups(markup).filter(group => {
      const opening = group.slice(0, group.indexOf('>') + 1);
      return opening.includes(`${kind}-layer`);
    }).join('');
    for (const markup of [back, front]) {
      if (topLevelGroups(markup).some(group => !/^<g\b[^>]*class="[^"]*(?:border|decoration)-layer/.test(group))) {
        throw new Error(`Unclassified SVG group: ${c.name}`);
      }
    }
    records.push({
      id: `${pack}-${c.id}`, collection: pack, name: c.name, description: c.description,
      borderKey, borderName: c.border, accessoryKey, accessoryName: c.decoration,
      colors: [c.c1, c.c2], defs, back, front,
      borderBack: separate(back, 'border'), borderFront: separate(front, 'border'),
      accessoryBack: separate(back, 'decoration'), accessoryFront: separate(front, 'decoration'),
    });
  }
}
fs.writeFileSync(path.join(hub, 'src/lib/animated-cosmetics.ts'),
  '// Generated from the approved mockups by scripts/import-cosmetics-mockups.mjs.\n' +
  '// SVG markup is trusted, static application artwork, never user input.\n' +
  `export const ANIMATED_COSMETIC_SETS = ${JSON.stringify(records, null, 2)} as const;\n\n` +
  'export type AnimatedCosmeticSet = (typeof ANIMATED_COSMETIC_SETS)[number];\n' +
  'export type AnimatedBorderKey = AnimatedCosmeticSet["borderKey"];\n' +
  'export type AnimatedAccessoryKey = AnimatedCosmeticSet["accessoryKey"];\n');
fs.writeFileSync(path.join(hub, '../api-server/src/lib/animated-cosmetic-keys.ts'),
  '// Generated with the frontend artwork by engagement-hub/scripts/import-cosmetics-mockups.mjs.\n' +
  `export const ANIMATED_BORDER_KEYS = ${JSON.stringify(records.map(c => c.borderKey), null, 2)} as const;\n` +
  `export const ANIMATED_ACCESSORY_KEYS = ${JSON.stringify(records.map(c => c.accessoryKey), null, 2)} as const;\n`);
console.log(`Imported ${records.length} exact artwork sets and their API keys.`);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const hub = path.resolve(import.meta.dirname, '..');
const generated = fs.readFileSync(path.join(hub, 'src/lib/animated-cosmetics.ts'), 'utf8');
const entries = JSON.parse(generated.match(/export const ANIMATED_COSMETIC_SETS = ([\s\S]*?) as const;/)[1]);

test('all fourteen approved sets preserve their exact SVG layers and gradients', () => {
  assert.equal(entries.length, 14);
  let offset = 0;
  for (const pack of ['after-hours', 'overdrive']) {
    const source = fs.readFileSync(path.join(hub, 'mockups', `cosmetics-${pack}.js`), 'utf8');
    const context = { document: { getElementById: () => ({}) }, window: { matchMedia: () => ({}) } };
    vm.runInNewContext(source.slice(0, source.indexOf('  const gallery=')) + 'globalThis.result = { concepts, layers, art };})();', context);
    for (const concept of context.result.concepts) {
      const entry = entries[offset++];
      const approved = context.result.layers(concept, '__COSMETIC_ID__');
      assert.equal(entry.name, concept.name);
      assert.equal(entry.back, approved.back);
      assert.equal(entry.front, approved.front);
      assert.deepEqual(entry.colors, [concept.c1, concept.c2]);
      const svg = context.result.art(concept);
      const uid = svg.match(/<linearGradient id="(.+?)-metal"/)[1];
      assert.equal(entry.defs, svg.match(/<defs>(.*?)<\/defs>/s)[1].replaceAll(uid, '__COSMETIC_ID__'));
      assert.equal(entry.borderBack.length + entry.accessoryBack.length, entry.back.length);
      assert.equal(entry.borderFront.length + entry.accessoryFront.length, entry.front.length);
    }
  }
});

test('every new equip key is accepted by the API and remains unique', () => {
  const api = fs.readFileSync(path.join(hub, '../api-server/src/lib/animated-cosmetic-keys.ts'), 'utf8');
  const readKeys = name => JSON.parse(api.match(new RegExp(`export const ${name} = ([\\s\\S]*?) as const;`))[1]);
  for (const [field, name] of [['borderKey', 'ANIMATED_BORDER_KEYS'], ['accessoryKey', 'ANIMATED_ACCESSORY_KEYS']]) {
    const keys = entries.map(entry => entry[field]);
    assert.equal(new Set(keys).size, 14);
    assert.deepEqual(readKeys(name), keys);
  }
});

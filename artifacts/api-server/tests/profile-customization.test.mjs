import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import express from 'express';

const api = path.resolve(import.meta.dirname, '..');
const temporary = path.join(api, '.tmp/cosmetics-route-test.mjs');
await fs.mkdir(path.dirname(temporary), { recursive: true });
const calls = [];
globalThis.cosmeticsTestDatabase = { query: async (sql, values) => { calls.push({ sql, values }); return { rowCount: 1 }; } };
await build({
  entryPoints: [path.join(api, 'src/routes/profile-customization.ts')], outfile: temporary,
  bundle: true, platform: 'node', format: 'esm', packages: 'external',
  plugins: [{ name: 'isolated-profile-route', setup(builder) {
    builder.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: 'db', namespace: 'fixture' }));
    builder.onResolve({ filter: /middleware\/session-auth$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({ contents: name === 'db'
      ? 'export const pool = globalThis.cosmeticsTestDatabase;'
      : `export const requireSession=(req,res,next)=>{if(!req.headers['x-test-session'])return res.status(401).end();req.sessionUser={id:'sample-user',is_approved:true};next();};
         export const requireApprovedSession=(req,res,next)=>next();
         export const assertAllowedBrowserOrigin=(req,res,next)=>next();` }));
  } }],
});
const { default: route } = await import(pathToFileURL(temporary).href);
const keysSource = await fs.readFile(path.join(api, 'src/lib/animated-cosmetic-keys.ts'), 'utf8');
const keys = name => JSON.parse(keysSource.match(new RegExp(`export const ${name} = ([\\s\\S]*?) as const;`))[1]);
const borders = keys('ANIMATED_BORDER_KEYS'), accessories = keys('ANIMATED_ACCESSORY_KEYS');
const app = express();
app.use(express.json());
app.use(route);
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const patch = (kind, body, authenticated = true) => fetch(`${base}/profile/customization/${kind}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json', ...(authenticated ? { 'x-test-session': 'yes' } : {}) }, body: JSON.stringify(body),
});

test('all new borders and accessories equip individually, and matched sets save atomically', async () => {
  for (let index = 0; index < 14; index++) {
    assert.equal((await patch('border', { value: borders[index] })).status, 204);
    assert.equal((await patch('accessory', { value: accessories[index] })).status, 204);
    const before = calls.length;
    assert.equal((await patch('set', { border: borders[index], accessory: accessories[index] })).status, 204);
    assert.equal(calls.length, before + 1);
    assert.match(calls.at(-1).sql, /set active_border = \$2, active_accessory = \$3/);
    assert.deepEqual(calls.at(-1).values, ['sample-user', borders[index], accessories[index]]);
  }
});

test('invalid or incomplete sets do not update either cosmetic', async () => {
  const before = calls.length;
  for (const body of [{ border: borders[0] }, { accessory: accessories[0] }, { border: 'unknown', accessory: accessories[0] }, { border: borders[0], accessory: 'unknown' }, { border: 123, accessory: [] }]) {
    assert.equal((await patch('set', body)).status, 400);
  }
  assert.equal(calls.length, before);
});

test('old cosmetics and clearing a set remain supported; anonymous requests are rejected', async () => {
  assert.equal((await patch('set', { border: 'cosmic-orbit', accessory: 'angel-wings' })).status, 204);
  assert.equal((await patch('set', { border: null, accessory: null })).status, 204);
  const before = calls.length;
  assert.equal((await patch('set', { border: borders[0], accessory: accessories[0] }, false)).status, 401);
  assert.equal(calls.length, before);
});

test.after(async () => { await new Promise(resolve => server.close(resolve)); delete globalThis.cosmeticsTestDatabase; await fs.rm(temporary); });

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createServer } from 'vite';

process.env.PORT = '5180';
process.env.BASE_PATH = '/';
process.env.VITE_API_URL = '';
const hub = path.resolve(import.meta.dirname, '..');
const entries = JSON.parse(fs.readFileSync(path.join(hub, 'src/lib/animated-cosmetics.ts'), 'utf8').match(/export const ANIMATED_COSMETIC_SETS = ([\s\S]*?) as const;/)[1]);
const source = fs.readFileSync(path.join(hub, 'mockups/cosmetics-after-hours.js'), 'utf8');
const artwork = { document: { getElementById: () => ({}) }, window: { matchMedia: () => ({}) } };
vm.runInNewContext(source.slice(0, source.indexOf('  const gallery=')) + 'globalThis.fox = fox;})();', artwork);
const user = {
  id: 'sample-profile', email: 'alex@example.test', username: 'Alex', points: 100,
  badges: [], current_streak: 5, longest_streak: 10, active_title: null, unlocked_titles: [],
  active_accessory: entries[0].accessoryKey, active_border: entries[0].borderKey,
  unlocked_accessories: [], unlocked_borders: [], is_admin: false, permissions: [],
  department: 'Customer experience', role: 'Team member', is_deleted: false,
  birthday: '2000-01-01', is_approved: true, identities: [],
  avatar_url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="96 86 108 108">${artwork.fox}</svg>`)}`,
};
const server = await createServer({
  configFile: path.join(hub, 'vite.config.ts'), server: { host: '127.0.0.1' },
  plugins: [{ name: 'sample-profile-only', configureServer(vite) {
    vite.middlewares.use(async (req, res, next) => {
      if (!req.url.startsWith('/api/')) return next();
      res.setHeader('content-type', 'application/json');
      if (req.method === 'GET' && req.url.startsWith('/api/auth/me')) return res.end(JSON.stringify({ tenant: 'C9', user }));
      if (req.method === 'POST' && req.url === '/api/auth/daily-login') return res.end('{"claimed":false}');
      if (req.method === 'GET' && req.url === '/api/achievements') return res.end('[]');
      if (req.method === 'GET' && req.url === '/api/org-structure') return res.end('{"roles":["Team member"],"departments":["Customer experience"],"managed":true}');
      if (req.method === 'PATCH' && req.url.startsWith('/api/profile/customization/')) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const kind = req.url.split('/').at(-1);
        if (kind === 'set') { user.active_border = body.border; user.active_accessory = body.accessory; }
        else if (kind === 'border') user.active_border = body.value;
        else if (kind === 'accessory') user.active_accessory = body.value;
        else { res.statusCode = 403; return res.end('{"error":"Unsupported sample action"}'); }
        res.statusCode = 204; return res.end();
      }
      res.statusCode = 403; res.end('{"error":"This preview only changes the sample cosmetic selection."}');
    });
  } }],
});
await server.listen();
console.log('Sample profile preview: http://127.0.0.1:5180/tests/cosmetics-profile.html');

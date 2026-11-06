const encoder = new TextEncoder();
const decoder = new TextDecoder();

function reply(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin'
    }
  });
}

function base64url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.slice(i, i + 8192));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64url(value) {
  const encoded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function signature(payload, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
}

function sameString(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function passwordMatches(candidate, actual) {
  const [left, right] = await Promise.all([candidate, actual].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function validSession(request, env) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
  const [payload, mac] = token.split('.');
  if (!payload || !mac || !sameString(await signature(payload, env.SESSION_SECRET), mac)) return false;
  try {
    const session = JSON.parse(decoder.decode(decodeBase64url(payload)));
    return Number.isInteger(session.exp) && session.exp > Date.now() && session.exp <= Date.now() + 3600000;
  } catch {
    return false;
  }
}

async function github(env, method, body) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/posts.json`;
  const response = await fetch(method === 'GET' ? `${url}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}` : url, {
    method,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Jus-Web-Blog-Service',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

async function currentPosts(env) {
  const { response, result } = await github(env, 'GET');
  if (response.status === 404) return { posts: [], sha: undefined };
  if (!response.ok) throw new Error(`GitHub read failed (${response.status})`);
  const bytes = Uint8Array.from(atob(result.content.replace(/\s/g, '')), character => character.charCodeAt(0));
  const posts = JSON.parse(decoder.decode(bytes));
  if (!Array.isArray(posts)) throw new Error('Post file is invalid');
  return { posts, sha: result.sha };
}

async function savePosts(env, posts, sha, message) {
  const unpadded = base64url(encoder.encode(`${JSON.stringify(posts, null, 2)}\n`)).replace(/-/g, '+').replace(/_/g, '/');
  const content = unpadded.padEnd(Math.ceil(unpadded.length / 4) * 4, '=');
  const { response } = await github(env, 'PUT', {
    message,
    content,
    ...(sha ? { sha } : {}),
    branch: env.GITHUB_BRANCH
  });
  if (response.status === 409) throw new Error('The blog changed while saving. Please try again.');
  if (!response.ok) throw new Error(`GitHub save failed (${response.status})`);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (origin !== env.ALLOWED_ORIGIN) return reply({ error: 'Forbidden' }, 403);
    if (!env.ADMIN_PASSWORD || !env.GITHUB_TOKEN || !env.SESSION_SECRET || !env.LOGIN_ATTEMPTS) return reply({ error: 'Blog service is not configured' }, 503, origin);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin' } });
    }
    const path = new URL(request.url).pathname;
    try {
      if (path === '/login' && request.method === 'POST') {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const key = `login:${ip}`;
        const attempts = Number(await env.LOGIN_ATTEMPTS.get(key) || '0');
        if (attempts >= 5) return reply({ error: 'Too many attempts. Try again in 15 minutes.' }, 429, origin);
        const { password } = await request.json();
        if (typeof password !== 'string' || password.length > 200 || !await passwordMatches(password, env.ADMIN_PASSWORD)) {
          await env.LOGIN_ATTEMPTS.put(key, String(attempts + 1), { expirationTtl: 900 });
          return reply({ error: 'Incorrect password' }, 401, origin);
        }
        await env.LOGIN_ATTEMPTS.delete(key);
        const payload = base64url(encoder.encode(JSON.stringify({ exp: Date.now() + 3600000, nonce: crypto.randomUUID() })));
        return reply({ token: `${payload}.${await signature(payload, env.SESSION_SECRET)}` }, 200, origin);
      }
      if (!await validSession(request, env)) return reply({ error: 'Please log in again.' }, 401, origin);
      if (path === '/posts' && request.method === 'GET') {
        const { posts } = await currentPosts(env);
        return reply({ posts }, 200, origin);
      }
      if (path === '/posts' && request.method === 'POST') {
        const input = await request.json();
        const title = typeof input.title === 'string' ? input.title.trim() : '';
        const body = typeof input.body === 'string' ? input.body.trim() : '';
        const date = input.date;
        const parsedDate = typeof date === 'string' ? Date.parse(`${date}T12:00:00Z`) : NaN;
        if (!title || title.length > 160 || !body || body.length > 20000 || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate) || new Date(parsedDate).toISOString().slice(0, 10) !== date) {
          return reply({ error: 'Enter a title, date, and post text.' }, 400, origin);
        }
        const { posts, sha } = await currentPosts(env);
        const post = { id: crypto.randomUUID(), date, title, body };
        await savePosts(env, [post, ...posts], sha, `Add blog post: ${title.slice(0, 60)}`);
        return reply({ post }, 201, origin);
      }
      if (path.startsWith('/posts/') && request.method === 'DELETE') {
        const id = path.slice('/posts/'.length);
        if (!/^[0-9a-f-]{36}$/.test(id)) return reply({ error: 'Invalid post' }, 400, origin);
        const { posts, sha } = await currentPosts(env);
        if (!posts.some(post => post.id === id)) return reply({ error: 'Post not found' }, 404, origin);
        await savePosts(env, posts.filter(post => post.id !== id), sha, `Delete blog post: ${id}`);
        return reply({ deleted: true }, 200, origin);
      }
      return reply({ error: 'Not found' }, 404, origin);
    } catch (error) {
      return reply({ error: error.message === 'Unexpected end of JSON input' ? 'Invalid request' : error.message }, 500, origin);
    }
  }
};

import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './worker.js';

test('password login, publish, list, and delete commit to GitHub', async () => {
  const attempts = new Map();
  const env = {
    ALLOWED_ORIGIN: 'https://www.thisisamerica.website',
    GITHUB_REPO: 'TitanBusinessPros/J-Web',
    GITHUB_BRANCH: 'main',
    ADMIN_PASSWORD: 'test-password',
    GITHUB_TOKEN: 'test-token',
    SESSION_SECRET: 'test-session-secret',
    LOGIN_ATTEMPTS: {
      get: async key => attempts.get(key),
      put: async (key, value) => attempts.set(key, value),
      delete: async key => attempts.delete(key)
    }
  };
  let posts = [];
  let sha = 'original';
  const commits = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    if (options.method === 'GET') {
      return Response.json({ content: Buffer.from(JSON.stringify(posts)).toString('base64'), sha });
    }
    const body = JSON.parse(options.body);
    assert.equal(body.sha, sha);
    posts = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
    commits.push(body.message);
    sha = `next-${commits.length}`;
    return Response.json({ content: { sha } });
  };
  const call = async (path, method = 'GET', body, token) => {
    const response = await worker.fetch(new Request(`https://example.workers.dev${path}`, {
      method,
      headers: { Origin: env.ALLOWED_ORIGIN, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    }), env);
    return { status: response.status, data: await response.json() };
  };
  try {
    assert.equal((await call('/login', 'POST', { password: 'wrong' })).status, 401);
    const login = await call('/login', 'POST', { password: 'test-password' });
    assert.equal(login.status, 200);
    const token = login.data.token;
    assert.equal((await call('/posts', 'POST', { title: 'Update', date: '2026-11-05', body: 'A new post.' }, token)).status, 201);
    const listed = await call('/posts', 'GET', undefined, token);
    assert.equal(listed.data.posts[0].title, 'Update');
    assert.equal((await call(`/posts/${listed.data.posts[0].id}`, 'DELETE', undefined, token)).status, 200);
    assert.deepEqual(posts, []);
    assert.equal(commits.length, 2);
    assert.equal((await call('/posts', 'GET')).status, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

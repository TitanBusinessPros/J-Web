# Blog editor setup

The public site is on GitHub Pages. This Cloudflare Worker verifies the editor password and commits additions or deletions to `posts.json` in `TitanBusinessPros/J-Web`. The password and GitHub token are Cloudflare Worker secrets; neither belongs in website files or this repository.

## One-time setup

1. Create a Cloudflare account and sign in to Wrangler: `npx wrangler login` from this folder.
2. Create a KV namespace for failed login attempts: `npx wrangler kv namespace create LOGIN_ATTEMPTS --update-config`. Check that `wrangler.toml` now has a `kv_namespaces` entry with binding `LOGIN_ATTEMPTS`.
3. In GitHub, create a fine-grained personal access token limited to the `TitanBusinessPros/J-Web` repository with **Contents: Read and write**. Do not put it in any site file.
4. In this folder, run each command below and enter the value when prompted:
   - `npx wrangler secret put ADMIN_PASSWORD` — the chosen editor password.
   - `npx wrangler secret put GITHUB_TOKEN` — the fine-grained GitHub token.
   - `npx wrangler secret put SESSION_SECRET` — a separate random secret of at least 32 characters. Generate one with a password manager.
5. Run `npx wrangler deploy`. Copy the resulting `https://...workers.dev` address into `admin-config.js` as `window.BLOG_API_URL` (no trailing slash).
6. Publish `admin-config.js`, `admin.html`, `admin.js`, `blog.html`, `blog.js`, `posts.json`, and `styles.css` to the GitHub Pages repository. Visit `https://www.thisisamerica.website/admin.html` to sign in.

The Worker accepts browser requests only from `https://www.thisisamerica.website`. It issues one-hour sessions and allows five failed attempts per IP address in a 15-minute window. The editor saves each post or deletion as a commit to `posts.json`; the existing GitHub Pages deployment workflow then publishes the updated blog.

If the Worker is unavailable or the GitHub token expires, sign-in or saving will fail with an error message. Rotate the token through `npx wrangler secret put GITHUB_TOKEN` and deploy again. To change the password, run `npx wrangler secret put ADMIN_PASSWORD` and deploy again.

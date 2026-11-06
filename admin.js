(() => {
  const api = (window.BLOG_API_URL || '').replace(/\/$/, '');
  const status = document.querySelector('#admin-status');
  const loginPanel = document.querySelector('#login-panel');
  const editorPanel = document.querySelector('#editor-panel');
  const loginForm = document.querySelector('#login-form');
  const postForm = document.querySelector('#post-form');
  const list = document.querySelector('#admin-posts');
  let token = sessionStorage.getItem('blogSession') || '';

  if (!api) {
    status.textContent = 'The blog editor service has not been connected yet.';
    loginForm.querySelector('button').disabled = true;
    return;
  }

  async function request(path, options = {}) {
    const response = await fetch(`${api}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
    return result;
  }

  function showEditor(visible) {
    loginPanel.hidden = visible;
    editorPanel.hidden = !visible;
  }

  async function loadPosts() {
    const { posts } = await request('/posts');
    list.replaceChildren();
    if (!posts.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No posts yet.';
      list.append(empty);
    }
    for (const post of posts) {
      const row = document.createElement('div');
      row.className = 'admin-item';
      const label = document.createElement('p');
      label.textContent = `${post.date} — ${post.title}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Delete';
      button.addEventListener('click', async () => {
        if (!confirm(`Delete “${post.title}” from the blog?`)) return;
        button.disabled = true;
        status.textContent = 'Deleting post…';
        try {
          await request(`/posts/${encodeURIComponent(post.id)}`, { method: 'DELETE' });
          await loadPosts();
          status.textContent = 'Post deleted. The website may take a few minutes to update.';
        } catch (error) {
          status.textContent = error.message;
          button.disabled = false;
        }
      });
      row.append(label, button);
      list.append(row);
    }
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = loginForm.querySelector('button');
    button.disabled = true;
    status.textContent = 'Logging in…';
    try {
      const result = await request('/login', { method: 'POST', body: JSON.stringify({ password: document.querySelector('#admin-password').value }) });
      token = result.token;
      sessionStorage.setItem('blogSession', token);
      document.querySelector('#admin-password').value = '';
      showEditor(true);
      await loadPosts();
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  postForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = postForm.querySelector('button');
    button.disabled = true;
    status.textContent = 'Publishing post…';
    try {
      await request('/posts', { method: 'POST', body: JSON.stringify({ title: document.querySelector('#post-title').value, date: document.querySelector('#post-date').value, body: document.querySelector('#post-body').value }) });
      postForm.reset();
      document.querySelector('#post-date').value = new Date().toLocaleDateString('en-CA');
      await loadPosts();
      status.textContent = 'Post saved to GitHub. The website may take a few minutes to update.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('#logout-button').addEventListener('click', () => {
    token = '';
    sessionStorage.removeItem('blogSession');
    showEditor(false);
    status.textContent = 'Logged out.';
  });

  document.querySelector('#post-date').value = new Date().toLocaleDateString('en-CA');
  if (token) {
    loadPosts().then(() => showEditor(true)).catch(() => {
      token = '';
      sessionStorage.removeItem('blogSession');
      status.textContent = 'Please log in again.';
    });
  }
})();

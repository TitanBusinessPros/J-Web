(() => {
  const CODE_HASH = 'e565d2001a7d9e93b814177e3b0acd0d37e3e49dc22ead424eba7aa5da62a944';
  const DATA_PATTERN = /(<script id="blog-data" type="application\/json">)([\s\S]*?)(<\/script>)/;
  const status = document.querySelector('#admin-status');
  const fileStatus = document.querySelector('#file-status');
  const loginPanel = document.querySelector('#login-panel');
  const editorPanel = document.querySelector('#editor-panel');
  const postForm = document.querySelector('#post-form');
  const list = document.querySelector('#admin-posts');
  const connectButton = document.querySelector('#connect-button');
  const downloadButton = document.querySelector('#download-button');
  const fallbackFile = document.querySelector('#fallback-file');
  let handle = null;
  let sourceHtml = '';
  let posts = [];
  let baseline = '';

  function setStatus(message) {
    status.textContent = message;
  }

  function parseBlog(html) {
    const match = html.match(DATA_PATTERN);
    if (!match) throw new Error('That file is not the current blog.html.');
    const result = JSON.parse(match[2]);
    if (!Array.isArray(result)) throw new Error('The blog post data is invalid.');
    return result;
  }

  function updatedHtml(html, nextPosts) {
    const data = JSON.stringify(nextPosts).replace(/</g, '\\u003c');
    return html.replace(DATA_PATTERN, (_match, start, _old, end) => `${start}${data}${end}`);
  }

  async function codeMatches(code) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return hex === CODE_HASH;
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('jus-blog-editor', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('files');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function storedHandle() {
    try {
      const db = await openDatabase();
      return await new Promise((resolve, reject) => {
        const request = db.transaction('files').objectStore('files').get('blog');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  async function rememberHandle(selected) {
    try {
      const db = await openDatabase();
      await new Promise((resolve, reject) => {
        const request = db.transaction('files', 'readwrite').objectStore('files').put(selected, 'blog');
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Saving still works for this visit if the browser blocks IndexedDB.
    }
  }

  function showPosts() {
    list.replaceChildren();
    if (!posts.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No posts yet.';
      list.append(empty);
      return;
    }
    for (const post of [...posts].sort((a, b) => b.date.localeCompare(a.date))) {
      const row = document.createElement('div');
      row.className = 'admin-item';
      const label = document.createElement('p');
      label.textContent = `${post.date} — ${post.title}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Delete';
      button.addEventListener('click', async () => {
        if (!confirm(`Delete “${post.title}” from blog.html?`)) return;
        button.disabled = true;
        setStatus('Saving change…');
        try {
          await savePosts(posts.filter(item => item.id !== post.id));
        } catch (error) {
          setStatus(error.message);
          button.disabled = false;
        }
      });
      row.append(label, button);
      list.append(row);
    }
  }

  async function loadFile(selected) {
    if (selected.name !== 'blog.html') throw new Error('Choose the file named blog.html.');
    const html = await (await selected.getFile()).text();
    const loaded = parseBlog(html);
    handle = selected;
    sourceHtml = html;
    posts = loaded;
    baseline = JSON.stringify(loaded);
    postForm.hidden = false;
    downloadButton.hidden = false;
    fileStatus.textContent = 'Connected to your local blog.html. Posts you save or delete will be written into that file.';
    showPosts();
    await rememberHandle(selected);
  }

  async function chooseFile() {
    if (!window.showOpenFilePicker) {
      fallbackFile.click();
      return;
    }
    try {
      const [selected] = await window.showOpenFilePicker({ types: [{ description: 'HTML files', accept: { 'text/html': ['.html'] } }], multiple: false });
      if (!selected) return;
      if (await selected.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('Please allow changes to blog.html.');
      await loadFile(selected);
      setStatus('Blog file connected.');
    } catch (error) {
      if (error.name !== 'AbortError') setStatus(error.message);
    }
  }

  fallbackFile.addEventListener('change', async () => {
    try {
      const file = fallbackFile.files[0];
      if (!file || file.name !== 'blog.html') throw new Error('Choose the file named blog.html.');
      const html = await file.text();
      const loaded = parseBlog(html);
      handle = null;
      sourceHtml = html;
      posts = loaded;
      baseline = JSON.stringify(loaded);
      postForm.hidden = false;
      downloadButton.hidden = false;
      fileStatus.textContent = 'This browser will download an updated blog.html after each change. Replace the old file with that download.';
      showPosts();
      setStatus('Blog file loaded.');
    } catch (error) {
      setStatus(error.message);
    } finally {
      fallbackFile.value = '';
    }
  });

  function download(html) {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'blog.html';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function savePosts(nextPosts) {
    if (!sourceHtml) throw new Error('Choose your local blog.html first.');
    const currentHtml = handle ? await (await handle.getFile()).text() : sourceHtml;
    if (JSON.stringify(parseBlog(currentHtml)) !== baseline) throw new Error('The blog file changed. Reconnect it before saving.');
    const nextHtml = updatedHtml(currentHtml, nextPosts);
    if (handle) {
      const writable = await handle.createWritable();
      await writable.write(nextHtml);
      await writable.close();
    } else {
      download(nextHtml);
    }
    sourceHtml = nextHtml;
    posts = nextPosts;
    baseline = JSON.stringify(nextPosts);
    showPosts();
    setStatus(handle ? 'Saved in blog.html on this computer. Publish that file to update the public website.' : 'Updated blog.html downloaded. Replace the old file, then publish it to update the public website.');
  }

  document.querySelector('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const input = document.querySelector('#admin-code');
    try {
      if (!await codeMatches(input.value)) {
        setStatus('Incorrect code.');
        return;
      }
      input.value = '';
      loginPanel.hidden = true;
      editorPanel.hidden = false;
      setStatus('Editor unlocked.');
      const saved = await storedHandle();
      if (saved) {
        const permission = await saved.queryPermission({ mode: 'readwrite' });
        if (permission === 'granted' || await saved.requestPermission({ mode: 'readwrite' }) === 'granted') {
          await loadFile(saved);
          setStatus('Editor unlocked and blog file connected.');
        }
      }
    } catch {
      setStatus('The editor could not open in this browser.');
    }
  });

  connectButton.addEventListener('click', chooseFile);
  downloadButton.addEventListener('click', () => download(sourceHtml));
  document.querySelector('#logout-button').addEventListener('click', () => {
    handle = null;
    sourceHtml = '';
    posts = [];
    baseline = '';
    postForm.hidden = true;
    downloadButton.hidden = true;
    list.replaceChildren();
    editorPanel.hidden = true;
    loginPanel.hidden = false;
    setStatus('Editor locked.');
  });

  postForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = postForm.querySelector('button[type="submit"]');
    button.disabled = true;
    setStatus('Saving post…');
    try {
      const post = {
        id: crypto.randomUUID(),
        date: document.querySelector('#post-date').value,
        title: document.querySelector('#post-title').value.trim(),
        body: document.querySelector('#post-body').value.trim()
      };
      if (!post.title || !post.body) throw new Error('Enter a title and post text.');
      await savePosts([post, ...posts]);
      postForm.reset();
      setToday();
    } catch (error) {
      setStatus(error.message);
    } finally {
      button.disabled = false;
    }
  });

  function setToday() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    document.querySelector('#post-date').value = local.toISOString().slice(0, 10);
  }

  setToday();
})();

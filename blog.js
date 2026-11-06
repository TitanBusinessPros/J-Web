(() => {
  const list = document.querySelector('#blog-posts');
  const empty = document.querySelector('#blog-empty');
  if (!list || !empty) return;

  function paragraph(text) {
    const element = document.createElement('p');
    element.textContent = text;
    return element;
  }

  fetch(`posts.json?v=${Date.now()}`, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Posts unavailable');
      return response.json();
    })
    .then(posts => {
      if (!Array.isArray(posts)) throw new Error('Invalid posts');
      if (!posts.length) return;
      empty.hidden = true;
      posts.sort((a, b) => b.date.localeCompare(a.date));
      for (const post of posts) {
        const article = document.createElement('article');
        article.className = 'blog-post';
        const time = document.createElement('time');
        time.dateTime = post.date;
        time.textContent = new Date(`${post.date}T12:00:00Z`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
        const title = document.createElement('h3');
        title.textContent = post.title;
        article.append(time, title);
        for (const text of post.body.split(/\n\s*\n/)) article.append(paragraph(text));
        list.append(article);
      }
    })
    .catch(() => {
      empty.querySelector('h3').textContent = 'Updates are temporarily unavailable.';
      empty.querySelector('p').textContent = 'Please try again later.';
    });
})();

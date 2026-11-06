(() => {
  const list = document.querySelector('#blog-posts');
  const empty = document.querySelector('#blog-empty');
  const data = document.querySelector('#blog-data');
  if (!list || !empty || !data) return;

  try {
    const posts = JSON.parse(data.textContent);
    if (!Array.isArray(posts)) throw new Error('Invalid blog data');
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
      for (const text of post.body.split(/\n\s*\n/)) {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        article.append(paragraph);
      }
      list.append(article);
    }
  } catch {
    empty.querySelector('h3').textContent = 'Updates are temporarily unavailable.';
    empty.querySelector('p').textContent = 'Please try again later.';
  }
})();

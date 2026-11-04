(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.primary-nav');
  const feedback = document.querySelector('#share-feedback');
  const shareUrl = window.location.href.split('#')[0];
  const shareTitle = 'Our Family Deserves to Be Heard';
  const shareText = "Shawn Polly says he was arrested after trying to help a friend in an emergency. Now a housing demand is separating his family. Read their story.";

  document.querySelector('#year').textContent = new Date().getFullYear();

  function closeMenu() {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    nav.classList.remove('is-open');
  }

  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
    nav.classList.toggle('is-open', !isOpen);
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });

  if (!document.querySelector('#share-facebook')) return;

  document.querySelector('#share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  document.querySelector('#share-x').href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  document.querySelector('#share-email').href = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;

  document.querySelector('#copy-link').addEventListener('click', async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const field = document.createElement('textarea');
        field.value = shareUrl;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('Copy failed');
      }
      feedback.textContent = 'Website link copied.';
    } catch {
      feedback.textContent = `Copy this link: ${shareUrl}`;
    }
  });

  const nativeButton = document.querySelector('#native-share');
  if (navigator.share) {
    nativeButton.hidden = false;
    nativeButton.addEventListener('click', async () => {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        feedback.textContent = 'Thank you for sharing.';
      } catch (error) {
        if (error.name !== 'AbortError') feedback.textContent = 'Sharing was unavailable. Try copying the link.';
      }
    });
  }
})();

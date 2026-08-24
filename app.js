/* Fraguío — sitio estático. Carga posts.json (generado desde posts/*.md) y renderiza. */
(function () {
  const app = document.getElementById('app');
  let posts = null;
  let showContent = true;
  let authorFilter = null;

  function stars(rating) {
    const n = Math.max(0, Math.min(5, Number(rating) || 0));
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function formatDate(iso) {
    // iso: YYYY-MM or YYYY-MM-DD
    const [y, m] = iso.split('-');
    return `${m}/${y}`;
  }

  function renderMarkdown(md) {
    return marked.parse(md, { breaks: true });
  }

  const EXCERPT_WORDS = 50;

  function excerpt(md) {
    const words = md.trim().split(/\s+/);
    if (words.length <= EXCERPT_WORDS) return null;
    return words.slice(0, EXCERPT_WORDS).join(' ') + '…';
  }

  function metaHtml(post) {
    const author = post.author ? `<span class="post-author">${post.author}</span> · ` : '';
    return `<div class="post-meta">${author}<time>${formatDate(post.date)}</time> · <span class="post-stars">${stars(post.rating)}</span></div>`;
  }

  function contentHtml(post) {
    const short = excerpt(post.content);
    if (!short) return `<div class="post-content">${renderMarkdown(post.content)}</div>`;
    const moreLink = ` <a class="more-link" href="#" data-more="${post.slug}">[Más]</a>`;
    let shortHtml = renderMarkdown(short);
    // Insertar el enlace dentro del último párrafo para que quede en línea
    const lastP = shortHtml.lastIndexOf('</p>');
    shortHtml = lastP !== -1
      ? shortHtml.slice(0, lastP) + moreLink + shortHtml.slice(lastP)
      : shortHtml + moreLink;
    return `
      <div class="post-content post-excerpt">${shortHtml}</div>
      <div class="post-content post-full" hidden>${renderMarkdown(post.content)}</div>`;
  }

  const AUTHOR_NAMES = { '👾': 'Javier Fraguío', '🐧': 'Laura Fraguío' };

  function authorFilterHtml() {
    const authors = [...new Set(posts.map(p => p.author).filter(Boolean))].sort();
    if (authors.length < 2) return '';
    const link = (author) => {
      const active = authorFilter === author ? ' is-active' : '';
      const title = AUTHOR_NAMES[author] ? ` title="${AUTHOR_NAMES[author]}"` : '';
      return `<a href="#" class="author-link${active}" data-author="${author}"${title}>${author}</a>`;
    };
    return `<nav class="author-filter">${authors.map(link).join(' ')}</nav>`;
  }

  function renderHome() {
    const PAGE_SIZE = 20;
    const visible = authorFilter ? posts.filter(p => p.author === authorFilter) : posts;
    let rendered = 0;
    let observer = null;

    const itemHtml = post => `
      <article class="post-item">
        <a class="post-title" href="#/post/${post.slug}">${post.title}</a>
        ${metaHtml(post)}
        ${showContent ? contentHtml(post) : ''}
      </article>`;

    app.innerHTML = `
      <header class="header">
        <h1 class="site-title" id="site-title">Fraguío</h1>
        <p class="site-subtitle">Críticas de cine</p>
        ${authorFilterHtml()}
      </header>
      <main class="posts-feed" id="posts-feed"></main>
      <div id="feed-sentinel"></div>`;

    const feed = document.getElementById('posts-feed');
    const sentinel = document.getElementById('feed-sentinel');

    function bindMoreLinks(scope) {
      scope.querySelectorAll('.more-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const item = link.closest('.post-item');
          item.querySelector('.post-excerpt').hidden = true;
          item.querySelector('.post-full').hidden = false;
        });
      });
    }

    function appendPage() {
      const page = visible.slice(rendered, rendered + PAGE_SIZE);
      rendered += page.length;
      const fragment = document.createElement('div');
      fragment.innerHTML = page.map(itemHtml).join('');
      bindMoreLinks(fragment);
      feed.append(...fragment.children);
      if (rendered >= visible.length && observer) {
        observer.disconnect();
        observer = null;
      }
    }

    appendPage();

    if (rendered < visible.length) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some(e => e.isIntersecting)) appendPage();
      }, { rootMargin: '400px' });
      observer.observe(sentinel);
    }

    document.getElementById('site-title').addEventListener('click', () => {
      showContent = !showContent;
      renderHome();
    });

    app.querySelectorAll('.author-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const author = link.dataset.author;
        authorFilter = authorFilter === author ? null : author;
        renderHome();
      });
    });
  }

  function renderPost(slug) {
    const post = posts.find(p => p.slug === slug);
    if (!post) {
      app.innerHTML = `<a class="nav-link" href="#/">← Volver</a>
        <div class="error-message">Entrada no encontrada.</div>`;
      return;
    }
    app.innerHTML = `
      <a class="nav-link" href="#/">← Volver</a>
      <article class="post-detail">
        <h1 class="post-title">${post.title}</h1>
        ${metaHtml(post)}
        <div class="post-content">${renderMarkdown(post.content)}</div>
      </article>`;
    window.scrollTo(0, 0);
  }

  function route() {
    if (!posts) return;
    const hash = window.location.hash || '#/';
    const match = hash.match(/^#\/post\/(.+)$/);
    if (match) {
      renderPost(decodeURIComponent(match[1]));
    } else {
      renderHome();
    }
  }

  window.addEventListener('hashchange', route);

  if (Array.isArray(window.POSTS)) {
    posts = window.POSTS;
    route();
  } else {
    app.innerHTML = '<div class="error-message">No se encontró posts.js. Ejecuta: node scripts/build-index.mjs</div>';
  }
})();

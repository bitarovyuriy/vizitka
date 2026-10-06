/* ==========================================================================
   Юрий Битаров — визитка. Скрипт: загрузка работ, витрина избранного,
   лента портфолио, модалка с плеером, контакты, год в футере.
   ========================================================================== */

/* Адреса собираются в рантайме: в разметке нет ни готовых ссылок, ни адресов —
   скриптовая сборка отсекает простые парсеры, которые выдирают mailto и t.me из HTML */
const CONTACTS = (() => {
  const telegramUser = ['bet', 'araw'].join('');
  const mailUser = ['bz', 'jura'].join('.');
  const mailHost = ['gmail', 'com'].join('.');
  return {
    telegram: 'https://t.me/' + telegramUser,
    email: mailUser + '@' + mailHost
  };
})();

const AUTOPLAY_DELAY = 5000;
const SWIPE_THRESHOLD = 40;

const showcaseStage = document.getElementById('showcaseStage');
const showcaseDots = document.getElementById('showcaseDots');
const showcasePrev = document.getElementById('showcasePrev');
const showcaseNext = document.getElementById('showcaseNext');
const showcaseEl = document.getElementById('showcase');

const videoGrid = document.getElementById('videoGrid');
const gridLoader = document.getElementById('gridLoader');
const gridMessage = document.getElementById('gridMessage');

const modal = document.getElementById('modal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalClose = document.getElementById('modalClose');
const modalIframeWrap = document.getElementById('modalIframeWrap');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const videoLoader = document.getElementById('videoLoader');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let videos = [];
let currentIndex = 0;
let autoplayTimer = null;
let lastFocused = null;
let loaderFallback = null;

/* --- Работы --------------------------------------------------------------- */
async function loadVideos() {
  showLoader(true);
  try {
    const response = await fetch('videos.json?_=' + Date.now());
    if (!response.ok) throw new Error('HTTP ' + response.status);

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('пустой список');

    videos = data;
    renderGrid(videos);
    buildShowcase(videos);
    showMessage('');
  } catch (err) {
    console.warn('Не удалось загрузить videos.json:', err.message);
    videos = [];
    renderGrid(videos);
    showMessage('Работы не загрузились. Проверь файл <strong>videos.json</strong> — он должен лежать рядом с index.html и быть корректным JSON. Если открываешь страницу прямо с диска, нужен локальный сервер или GitHub Pages.');
  } finally {
    showLoader(false);
  }
}

function showLoader(show) {
  if (gridLoader) gridLoader.style.display = show ? 'flex' : 'none';
}

function showMessage(html) {
  if (!gridMessage) return;
  gridMessage.innerHTML = html || '';
  gridMessage.hidden = !html;
}

/* --- Лента портфолио ------------------------------------------------------ */
function renderGrid(list) {
  if (!videoGrid) return;
  videoGrid.innerHTML = '';

  if (!list.length) return;

  const fragment = document.createDocumentFragment();

  list.forEach((video, index) => {
    const title = video.short || video.title || 'Работа';

    const card = document.createElement('article');
    card.className = 'video-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Смотреть: ' + title);

    card.innerHTML = `
      <div class="video-card__thumb">
        <span class="video-card__badge">${escapeHtml((video.platform || 'video').toUpperCase())}</span>
        <img src="${escapeHtml(getThumbnail(video))}" alt="" loading="${index < 4 ? 'eager' : 'lazy'}" decoding="async" />
        <span class="video-card__play"><i class="fa-solid fa-play"></i></span>
      </div>
      <div class="video-card__body">
        <h3 class="video-card__title">${escapeHtml(title)}</h3>
        <p class="video-card__desc">${escapeHtml(video.description || '')}</p>
      </div>
    `;

    const img = card.querySelector('img');
    img.addEventListener('error', () => { img.style.visibility = 'hidden'; });

    card.addEventListener('click', () => openModal(video, index));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openModal(video, index);
      }
    });

    fragment.appendChild(card);
  });

  videoGrid.appendChild(fragment);
}

/* --- Витрина избранного --------------------------------------------------- */
function buildShowcase(list) {
  if (!showcaseStage || !list.length) return;

  showcaseStage.innerHTML = '';
  if (showcaseDots) showcaseDots.innerHTML = '';

  const stageFragment = document.createDocumentFragment();
  const dotsFragment = document.createDocumentFragment();

  list.forEach((video, index) => {
    const slide = document.createElement('button');
    slide.type = 'button';
    slide.className = 'slide';
    slide.dataset.index = index;
    slide.setAttribute('aria-label', 'Смотреть: ' + (video.short || video.title || ''));
    slide.innerHTML = `
      <img class="slide__img" src="${escapeHtml(getThumbnail(video))}" alt="" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async" />
      <span class="slide__play"><i class="fa-solid fa-play"></i></span>
      <span class="slide__caption">${escapeHtml(video.short || video.title || '')}</span>
    `;
    slide.addEventListener('click', () => {
      if (index === currentIndex) openModal(video, index);
      else setSlide(index, true);
    });
    stageFragment.appendChild(slide);

    if (showcaseDots) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'showcase__dot';
      dot.setAttribute('aria-label', 'Работа ' + (index + 1));
      dot.addEventListener('click', () => setSlide(index, true));
      dotsFragment.appendChild(dot);
    }
  });

  showcaseStage.appendChild(stageFragment);
  if (showcaseDots) showcaseDots.appendChild(dotsFragment);

  currentIndex = 0;
  setSlide(0, false);
  startAutoplay();
}

function setSlide(index, restartTimer) {
  const slides = showcaseStage ? showcaseStage.querySelectorAll('.slide') : [];
  const dots = showcaseDots ? showcaseDots.querySelectorAll('.showcase__dot') : [];
  if (!slides.length) return;

  currentIndex = (index + slides.length) % slides.length;

  slides.forEach((slide, i) => slide.classList.toggle('is-active', i === currentIndex));
  dots.forEach((dot, i) => dot.classList.toggle('is-active', i === currentIndex));

  if (restartTimer) startAutoplay();
}

function nextSlide() {
  if (!videos.length) return;
  setSlide(currentIndex + 1, true);
}

function prevSlide() {
  if (!videos.length) return;
  setSlide(currentIndex - 1, true);
}

function startAutoplay() {
  stopAutoplay();
  if (reduceMotion || videos.length < 2 || modal.classList.contains('open')) return;
  autoplayTimer = setInterval(() => setSlide(currentIndex + 1, false), AUTOPLAY_DELAY);
}

function stopAutoplay() {
  if (autoplayTimer) {
    clearInterval(autoplayTimer);
    autoplayTimer = null;
  }
}

if (showcaseNext) showcaseNext.addEventListener('click', nextSlide);
if (showcasePrev) showcasePrev.addEventListener('click', prevSlide);

if (showcaseEl) {
  showcaseEl.addEventListener('mouseenter', stopAutoplay);
  showcaseEl.addEventListener('mouseleave', startAutoplay);
  showcaseEl.addEventListener('focusin', stopAutoplay);
  showcaseEl.addEventListener('focusout', startAutoplay);

  let touchStartX = 0;
  let touchStartY = 0;

  showcaseEl.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].screenX;
    touchStartY = event.changedTouches[0].screenY;
    stopAutoplay();
  }, { passive: true });

  showcaseEl.addEventListener('touchend', (event) => {
    const dx = touchStartX - event.changedTouches[0].screenX;
    const dy = Math.abs(touchStartY - event.changedTouches[0].screenY);
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > dy) {
      if (dx > 0) nextSlide();
      else prevSlide();
    }
    startAutoplay();
  }, { passive: true });
}

/* --- Модалка -------------------------------------------------------------- */
function openModal(video, index) {
  if (!modal) return;

  stopAutoplay();
  lastFocused = document.activeElement;
  if (typeof index === 'number') currentIndex = index;

  if (modalTitle) modalTitle.textContent = video.title || video.short || '';
  if (modalDesc) modalDesc.textContent = video.description || '';
  if (videoLoader) videoLoader.style.display = 'flex';
  if (modalIframeWrap) modalIframeWrap.innerHTML = '';

  const iframe = document.createElement('iframe');
  iframe.src = buildEmbedUrl(video);
  iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('title', video.title || 'Видео');
  iframe.addEventListener('load', () => { if (videoLoader) videoLoader.style.display = 'none'; });

  if (modalIframeWrap) modalIframeWrap.appendChild(iframe);

  // если плеер не отдал load (чужой домен, блокировка) — снимаем спиннер по таймауту
  clearTimeout(loaderFallback);
  loaderFallback = setTimeout(() => {
    if (videoLoader) videoLoader.style.display = 'none';
  }, 6000);

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  if (modalClose) modalClose.focus();
}

function closeModal() {
  if (!modal) return;

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (modalIframeWrap) modalIframeWrap.innerHTML = '';
  clearTimeout(loaderFallback);
  document.body.style.overflow = '';

  if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  lastFocused = null;
  startAutoplay();
}

if (modalClose) modalClose.addEventListener('click', closeModal);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

document.addEventListener('keydown', (event) => {
  const isOpen = modal && modal.classList.contains('open');

  if (event.key === 'Escape' && isOpen) {
    closeModal();
    return;
  }
  if (isOpen) return;

  if (event.key === 'ArrowRight') nextSlide();
  if (event.key === 'ArrowLeft') prevSlide();
});

/* --- Медиа ---------------------------------------------------------------- */
function getThumbnail(video) {
  if (video.thumbnail && video.thumbnail.trim() !== '') return video.thumbnail.trim();

  if (video.platform === 'youtube') {
    const id = extractYouTubeId(video.url);
    if (id) return 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg';
  }

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#121214"/></svg>'
  );
}

function extractYouTubeId(url) {
  const match = String(url).match(/embed\/([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function buildEmbedUrl(video) {
  let url = String(video.url || '');

  const setParam = (name, value) => {
    const pattern = new RegExp('([?&])' + name + '=[^&]*');
    if (pattern.test(url)) url = url.replace(pattern, '$1' + name + '=' + value);
    else url += (url.includes('?') ? '&' : '?') + name + '=' + value;
  };

  const addParam = (name, value) => {
    if (!new RegExp('[?&]' + name + '=').test(url)) setParam(name, value);
  };

  if (video.platform === 'youtube') {
    addParam('rel', '0');
    addParam('modestbranding', '1');
    addParam('controls', '1');
  } else if (video.platform === 'vimeo') {
    addParam('dnt', '1');
    addParam('title', '0');
    addParam('byline', '0');
    addParam('portrait', '0');
  } else if (video.platform === 'vk') {
    setParam('autoplay', '1');
  }

  return url;
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* --- Мелочи --------------------------------------------------------------- */
function setupContacts() {
  const links = [
    ['#tgBtn', CONTACTS.telegram, true],
    ['#mailBtn', 'mailto:' + CONTACTS.email, false],
    ['[data-contact="telegram"]', CONTACTS.telegram, true],
    ['[data-contact="email"]', 'mailto:' + CONTACTS.email, false]
  ];

  links.forEach(([selector, href, external]) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.setAttribute('href', href);
      if (external) el.setAttribute('target', '_blank');
    });
  });
}

function setupYear() {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const slides = showcaseStage ? showcaseStage.querySelectorAll('.slide') : [];
    if (slides.length) setSlide(currentIndex, false);
  }, 150);
});

document.addEventListener('DOMContentLoaded', () => {
  setupContacts();
  setupYear();
  loadVideos();
});

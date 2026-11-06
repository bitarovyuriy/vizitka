/* ==========================================================================
   Юрий Битаров — визитка. Скрипт: загрузка проектов, витрина избранного,
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

const AUTOPLAY_DELAY = 6000;
const SLIDE_DURATION = 560;
const SWIPE_THRESHOLD = 40;

const showcaseStage = document.getElementById('showcaseStage');
const showcaseDots = document.getElementById('showcaseDots');
const showcasePrev = document.getElementById('showcasePrev');
const showcaseNext = document.getElementById('showcaseNext');
const showcaseEl = document.getElementById('showcase');
const showcaseControls = document.getElementById('showcaseControls');
const showcaseCounter = document.getElementById('showcaseCounter');
const showcaseToggle = document.getElementById('showcaseToggle');
const showcaseStatus = document.getElementById('showcaseStatus');

const videoGrid = document.getElementById('videoGrid');
const gridLoader = document.getElementById('gridLoader');
const gridMessage = document.getElementById('gridMessage');

const modal = document.getElementById('modal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalClose = document.getElementById('modalClose');
const modalIframeWrap = document.getElementById('modalIframeWrap');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const shortsSection = document.getElementById('shorts');
const shortsScroller = document.getElementById('shortsScroller');
const shortsNav = document.getElementById('shortsNav');
const shortsPrev = document.getElementById('shortsPrev');
const shortsNext = document.getElementById('shortsNext');
const videoLoader = document.getElementById('videoLoader');

const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduceMotion = motionPreference.matches;

let videos = [];
let currentIndex = -1;
let autoplayTimer = null;
let autoplayPaused = false;
let showcaseHovered = false;
let showcaseTouched = false;
let suppressSlideClickUntil = 0;
let slideAnimations = [];
let queuedSlide = null;
let lastFocused = null;
let loaderFallback = null;

/* --- Проекты --------------------------------------------------------------- */
async function loadVideos() {
  showLoader(true);
  try {
    const response = await fetch('videos.json?_=' + Date.now());
    if (!response.ok) throw new Error('HTTP ' + response.status);

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('пустой список');

    videos = data;

    // вертикальные уходят в свою ленту, в сетке и витрине остаются горизонтальные
    const vertical = videos.filter(isVertical);
    const horizontal = videos.filter((video) => !isVertical(video));

    renderGrid(horizontal);
    buildShowcase(horizontal);
    renderShorts(vertical);
    showMessage('');
  } catch (err) {
    console.warn('Не удалось загрузить videos.json:', err.message);
    videos = [];
    renderGrid(videos);
    buildShowcase([]);
    renderShorts([]);
    showMessage('Проекты не загрузились. Проверь файл <strong>videos.json</strong> — он должен лежать рядом с index.html и быть корректным JSON. Если открываешь страницу прямо с диска, нужен локальный сервер или GitHub Pages.');
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

/* --- Подписи и площадки --------------------------------------------------- */
function getProjectCaption(video) {
  return {
    title: video.short || video.title || 'Проект',
    client: String(video.client || '').trim(),
    role: String(video.role || '').trim() || String(video.description || '').trim()
  };
}

function platformIcon(video) {
  const platforms = {
    youtube: ['fa-youtube', 'YouTube'],
    vk: ['fa-vk', 'VK'],
    vimeo: ['fa-vimeo', 'Vimeo']
  };
  const platform = platforms[video.platform];
  if (!platform) return '';
  return `<span class="platform-icon" role="img" aria-label="${platform[1]}"><i class="fa-brands ${platform[0]}" aria-hidden="true"></i></span>`;
}

/* --- Избранные работы и остальные проекты -------------------------------- */
function renderGrid(list) {
  if (!videoGrid) return;
  videoGrid.innerHTML = '';

  if (!list.length) return;

  // Явный выбор имеет приоритет; без отметок выделяем первые две работы.
  const marked = list.filter((video) => video.featured === true).slice(0, 2);
  const featured = marked.length ? marked : list.slice(0, 2);
  const featuredSet = new Set(featured);
  const groups = [featured, list.filter((video) => !featuredSet.has(video))];

  groups.forEach((group, groupIndex) => {
    if (!group.length) return;
    const container = document.createElement('div');
    container.className = groupIndex === 0 ? 'video-grid__featured' : 'video-grid__rest';

    group.forEach((video) => {
      container.appendChild(createVideoCard(video, groupIndex === 0));
    });
    videoGrid.appendChild(container);
  });
}

function createVideoCard(video, featured) {
  const { title, client, role } = getProjectCaption(video);
  const card = document.createElement('article');
  card.className = 'video-card' + (featured ? ' video-card--featured' : '');
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', 'Смотреть: ' + title);
  card.setAttribute('aria-haspopup', 'dialog');
  card.setAttribute('aria-controls', 'modal');

  card.innerHTML = `
    <div class="video-card__thumb">
      ${platformIcon(video)}
      <img src="${escapeHtml(getThumbnail(video))}" alt="" loading="${featured ? 'eager' : 'lazy'}" decoding="async" />
      <span class="video-card__play" aria-hidden="true"><i class="fa-solid fa-play"></i></span>
    </div>
    <div class="video-card__body">
      <h3 class="video-card__title">${escapeHtml(title)}</h3>
      ${client ? `<p class="video-card__client">${escapeHtml(client)}</p>` : ''}
      ${role ? `<p class="video-card__role">${escapeHtml(role)}</p>` : ''}
    </div>
  `;

  const img = card.querySelector('img');
  img.addEventListener('error', () => { img.style.visibility = 'hidden'; });

  card.addEventListener('click', () => openModal(video));
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openModal(video);
    }
  });

  return card;
}

function isVertical(video) {
  return Boolean(video) && video.vertical === true;
}

/* --- Вертикальные ---------------------------------------------------------- */
function renderShorts(list) {
  if (!shortsSection || !shortsScroller) return;

  shortsScroller.innerHTML = '';

  // секции нет на странице, пока не добавлено ни одного вертикального видео
  if (!list.length) {
    shortsSection.hidden = true;
    return;
  }

  const fragment = document.createDocumentFragment();

  list.forEach((video) => {
    const { title, client, role } = getProjectCaption(video);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'shorts__card';
    card.setAttribute('aria-label', 'Смотреть: ' + title);
    card.setAttribute('aria-haspopup', 'dialog');
    card.setAttribute('aria-controls', 'modal');

    card.innerHTML = `
      <span class="shorts__media">
        ${platformIcon(video)}
        <img src="${escapeHtml(getThumbnail(video))}" alt="" loading="lazy" decoding="async" />
        <span class="shorts__play" aria-hidden="true"><i class="fa-solid fa-play"></i></span>
      </span>
      <span class="shorts__title">${escapeHtml(title)}</span>
      ${client ? `<span class="shorts__client">${escapeHtml(client)}</span>` : ''}
      ${role ? `<span class="shorts__meta">${escapeHtml(role)}</span>` : ''}
    `;

    const img = card.querySelector('img');
    img.addEventListener('error', () => { img.style.visibility = 'hidden'; });

    // Открытие вертикального видео не меняет выбранный слайд карусели.
    card.addEventListener('click', () => openModal(video));

    fragment.appendChild(card);
  });

  shortsScroller.appendChild(fragment);
  shortsSection.hidden = false;
  updateShortsNav();
}

/* листание ленты вертикальных: шаг — карточка плюс зазор */
function shortsStep() {
  if (!shortsScroller) return 0;
  const card = shortsScroller.querySelector('.shorts__card');
  if (!card) return shortsScroller.clientWidth;
  const gap = parseFloat(getComputedStyle(shortsScroller).columnGap) || 20;
  return card.getBoundingClientRect().width + gap;
}

function scrollShorts(direction) {
  if (!shortsScroller) return;
  shortsScroller.scrollBy({ left: direction * shortsStep(), behavior: reduceMotion ? 'instant' : 'smooth' });
}

// стрелки прячем, если лента целиком помещается, и гасим на краях
function updateShortsNav() {
  if (!shortsScroller || !shortsNav) return;

  const max = shortsScroller.scrollWidth - shortsScroller.clientWidth;
  const scrollable = max > 4;

  shortsNav.hidden = !scrollable;
  if (!scrollable) return;

  // лента сняплена, поэтому в начале браузер держит небольшой отступ (падинг скроллера)
  const inset = parseFloat(getComputedStyle(shortsScroller).paddingLeft) || 0;

  if (shortsPrev) shortsPrev.disabled = shortsScroller.scrollLeft <= inset + 2;
  if (shortsNext) shortsNext.disabled = shortsScroller.scrollLeft >= max - 2;
}

function bindShortsNav() {
  if (shortsPrev) shortsPrev.addEventListener('click', () => scrollShorts(-1));
  if (shortsNext) shortsNext.addEventListener('click', () => scrollShorts(1));
  if (shortsScroller) shortsScroller.addEventListener('scroll', updateShortsNav, { passive: true });
}

/* --- Витрина избранного --------------------------------------------------- */
function buildShowcase(list) {
  if (!showcaseStage || !showcaseEl) return;

  stopAutoplay();
  cancelSlideTransition();
  showcaseStage.innerHTML = '';
  if (showcaseDots) showcaseDots.innerHTML = '';
  if (showcaseStatus) showcaseStatus.textContent = '';
  showcaseEl.hidden = !list.length;
  currentIndex = -1;
  if (!list.length) return;
  if (showcaseControls) showcaseControls.hidden = list.length < 2;
  if (showcaseToggle) showcaseToggle.hidden = reduceMotion;

  const stageFragment = document.createDocumentFragment();
  const dotsFragment = document.createDocumentFragment();

  list.forEach((video, index) => {
    const { title, client, role } = getProjectCaption(video);
    const slide = document.createElement('button');
    slide.type = 'button';
    slide.className = 'slide';
    slide.dataset.index = index;
    slide.setAttribute('aria-label', 'Смотреть: ' + title);
    slide.setAttribute('aria-haspopup', 'dialog');
    slide.setAttribute('aria-controls', 'modal');
    slide.tabIndex = -1;
    slide.inert = true;
    slide.setAttribute('aria-hidden', 'true');
    slide.innerHTML = `
      <img class="slide__img" src="${escapeHtml(getThumbnail(video))}" alt="" loading="${index < 2 ? 'eager' : 'lazy'}" decoding="async" ${index === 0 ? 'fetchpriority="high"' : ''} />
      ${platformIcon(video)}
      <span class="slide__play" aria-hidden="true"><i class="fa-solid fa-play"></i></span>
      <span class="slide__caption">
        <span class="slide__title">${escapeHtml(title)}</span>
        ${client ? `<span class="slide__client">${escapeHtml(client)}</span>` : ''}
        ${role ? `<span class="slide__role">${escapeHtml(role)}</span>` : ''}
      </span>
    `;
    slide.addEventListener('click', () => {
      if (Date.now() < suppressSlideClickUntil) return;
      if (index === currentIndex) openModal(video);
    });
    const img = slide.querySelector('img');
    img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
    stageFragment.appendChild(slide);

    if (showcaseDots) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'showcase__dot';
      dot.setAttribute('aria-label', 'Проект ' + (index + 1) + ': ' + title);
      dot.setAttribute('aria-controls', 'showcaseStage');
      dot.addEventListener('click', () => setSlide(index, true));
      dotsFragment.appendChild(dot);
    }
  });

  showcaseStage.appendChild(stageFragment);
  if (showcaseDots) showcaseDots.appendChild(dotsFragment);

  setSlide(0, false);
  startAutoplay();
}

function cancelSlideTransition() {
  slideAnimations.forEach((animation) => animation.cancel());
  slideAnimations = [];
  queuedSlide = null;
}

function setSlide(index, restartTimer, direction = 0) {
  const slides = showcaseStage ? showcaseStage.querySelectorAll('.slide') : [];
  const dots = showcaseDots ? showcaseDots.querySelectorAll('.showcase__dot') : [];
  if (!slides.length) return;

  const target = ((index % slides.length) + slides.length) % slides.length;
  if (restartTimer) startAutoplay();

  // Быстрые нажатия ставим в очередь: текущий переезд завершается без рывка.
  if (slideAnimations.length && !reduceMotion) {
    queuedSlide = { index: target, restartTimer, direction };
    return;
  }
  if (target === currentIndex) return;

  const previous = slides[currentIndex];
  const incoming = slides[target];
  const moveFocus = previous && previous.contains(document.activeElement);
  const travel = direction || (target > currentIndex ? 1 : -1);
  currentIndex = target;

  incoming.inert = false;
  incoming.tabIndex = 0;
  incoming.removeAttribute('aria-hidden');
  incoming.classList.add('is-active');
  if (moveFocus) incoming.focus({ preventScroll: true });

  slides.forEach((slide, i) => {
    if (i === target) return;
    slide.classList.remove('is-active');
    slide.tabIndex = -1;
    slide.inert = true;
    slide.setAttribute('aria-hidden', 'true');
  });
  dots.forEach((dot, i) => {
    dot.classList.toggle('is-active', i === target);
    if (i === target) dot.setAttribute('aria-current', 'true');
    else dot.removeAttribute('aria-current');
  });
  if (showcaseCounter) showcaseCounter.textContent = String(target + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
  if (restartTimer && showcaseStatus) showcaseStatus.textContent = 'Проект ' + (target + 1) + ' из ' + slides.length + '. ' + incoming.getAttribute('aria-label');

  if (!previous || reduceMotion) return;

  // Анимируются только transform и opacity; после завершения остаются CSS-состояния.
  const options = { duration: SLIDE_DURATION, easing: 'cubic-bezier(0.22, 0.68, 0.18, 1)' };
  const animations = [
    previous.animate([
      { transform: 'translateX(0) scale(1)', opacity: 1 },
      { transform: `translateX(${-travel * 100}%) scale(0.97)`, opacity: 0.45 }
    ], options),
    incoming.animate([
      { transform: `translateX(${travel * 100}%) scale(1.03)`, opacity: 0.65 },
      { transform: 'translateX(0) scale(1)', opacity: 1 }
    ], options)
  ];
  slideAnimations = animations;
  Promise.all(animations.map((animation) => animation.finished)).then(() => {
    if (slideAnimations !== animations) return;
    const pending = queuedSlide;
    cancelSlideTransition();
    if (pending) setSlide(pending.index, pending.restartTimer, pending.direction);
  }).catch(() => { /* Отмена ожидаема при смене настройки движения или данных. */ });
}

function nextSlide() {
  setSlide((queuedSlide ? queuedSlide.index : currentIndex) + 1, true, 1);
}

function prevSlide() {
  setSlide((queuedSlide ? queuedSlide.index : currentIndex) - 1, true, -1);
}

function startAutoplay() {
  stopAutoplay();
  const count = showcaseStage ? showcaseStage.children.length : 0;
  const focused = showcaseEl && showcaseEl.contains(document.activeElement);
  if (reduceMotion || autoplayPaused || showcaseHovered || showcaseTouched || focused || document.hidden || count < 2 || (modal && modal.classList.contains('open'))) return;
  autoplayTimer = setTimeout(() => {
    setSlide(currentIndex + 1, false, 1);
    startAutoplay();
  }, AUTOPLAY_DELAY);
}

function stopAutoplay() {
  if (autoplayTimer) {
    clearTimeout(autoplayTimer);
    autoplayTimer = null;
  }
}

if (showcaseNext) showcaseNext.addEventListener('click', nextSlide);
if (showcasePrev) showcasePrev.addEventListener('click', prevSlide);
if (showcaseToggle) showcaseToggle.addEventListener('click', () => {
  autoplayPaused = !autoplayPaused;
  showcaseToggle.setAttribute('aria-pressed', String(autoplayPaused));
  showcaseToggle.setAttribute('aria-label', autoplayPaused ? 'Включить автопрокрутку' : 'Приостановить автопрокрутку');
  showcaseToggle.innerHTML = `<i class="fa-solid ${autoplayPaused ? 'fa-play' : 'fa-pause'}" aria-hidden="true"></i>`;
  startAutoplay();
});

if (showcaseEl) {
  showcaseEl.addEventListener('mouseenter', () => { showcaseHovered = true; stopAutoplay(); });
  showcaseEl.addEventListener('mouseleave', () => { showcaseHovered = false; startAutoplay(); });
  showcaseEl.addEventListener('focusin', stopAutoplay);
  showcaseEl.addEventListener('focusout', () => queueMicrotask(startAutoplay));

  let touchStartX = 0;
  let touchStartY = 0;

  showcaseStage.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
    showcaseTouched = true;
    stopAutoplay();
  }, { passive: true });

  showcaseStage.addEventListener('touchend', (event) => {
    const dx = touchStartX - event.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY - event.changedTouches[0].clientY);
    showcaseTouched = false;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > dy) {
      suppressSlideClickUntil = Date.now() + 500;
      if (dx > 0) nextSlide();
      else prevSlide();
    }
    startAutoplay();
  }, { passive: true });
  showcaseStage.addEventListener('touchcancel', () => { showcaseTouched = false; startAutoplay(); }, { passive: true });
}

document.addEventListener('visibilitychange', startAutoplay);
motionPreference.addEventListener('change', (event) => {
  reduceMotion = event.matches;
  const pending = queuedSlide;
  cancelSlideTransition();
  if (pending) setSlide(pending.index, false, pending.direction);
  if (showcaseToggle) showcaseToggle.hidden = reduceMotion;
  startAutoplay();
});

/* --- Модалка -------------------------------------------------------------- */
function openModal(video) {
  if (!modal) return;

  stopAutoplay();
  lastFocused = document.activeElement;

  if (modalTitle) modalTitle.textContent = video.title || video.short || '';
  const { client, role } = getProjectCaption(video);
  if (modalDesc) modalDesc.textContent = [client, role].filter(Boolean).join(' — ');
  // вертикальное видео открываем в рамке 9:16, горизонтальное — 16:9
  modal.classList.toggle('modal--vertical', isVertical(video));
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
  modal.inert = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  if (modalClose) modalClose.focus();
  document.querySelectorAll('body > header, body > main, body > footer').forEach((el) => { el.inert = true; });
}

function closeModal() {
  if (!modal) return;

  modal.classList.remove('open');
  modal.classList.remove('modal--vertical');
  if (modalIframeWrap) modalIframeWrap.innerHTML = '';
  clearTimeout(loaderFallback);
  document.body.style.overflow = '';
  document.querySelectorAll('body > header, body > main, body > footer').forEach((el) => { el.inert = false; });

  if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  modal.inert = true;
  modal.setAttribute('aria-hidden', 'true');
  lastFocused = null;
  startAutoplay();
}

if (modalClose) modalClose.addEventListener('click', closeModal);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

document.addEventListener('keydown', (event) => {
  const isOpen = modal && modal.classList.contains('open');

  if (event.key === 'Escape' && isOpen) {
    event.preventDefault();
    closeModal();
    return;
  }
  if (isOpen) {
    // Не выпускаем Tab из диалога на фон страницы.
    if (event.key === 'Tab') {
      const iframe = modalIframeWrap.querySelector('iframe');
      if (event.shiftKey && document.activeElement === modalClose && iframe) {
        event.preventDefault();
        iframe.focus();
      } else if (!event.shiftKey && document.activeElement === iframe) {
        event.preventDefault();
        modalClose.focus();
      }
    }
    return;
  }

  // У ленты вертикальных собственная горизонтальная прокрутка.
  if (event.defaultPrevented || event.target.closest('#shortsScroller, input, textarea, select, [contenteditable="true"]')) return;
  if (!showcaseEl || showcaseEl.hidden) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    if (event.key === 'ArrowRight') nextSlide();
    else prevSlide();
  }
});

/* --- Медиа ---------------------------------------------------------------- */
function getThumbnail(video) {
  if (video.thumbnail && video.thumbnail.trim() !== '') return video.thumbnail.trim();

  if (video.platform === 'youtube') {
    const id = extractYouTubeId(video.url);
    if (id) return 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg';
  }

  // заглушка повторяет пропорции карточки: 9:16 для вертикальных
  const vertical = video.vertical === true;
  const width = vertical ? 360 : 640;
  const height = vertical ? 640 : 360;

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '"><rect width="100%" height="100%" fill="#121214"/></svg>'
  );
}

function extractYouTubeId(url) {
  const value = String(url || '');

  // youtube.com/embed/ID, /shorts/ID, /live/ID, youtu.be/ID, watch?v=ID
  const match = value.match(/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/)
    || value.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
    || value.match(/[?&]v=([a-zA-Z0-9_-]{11})/);

  return match ? match[1] : null;
}

// Приводим обычную ссылку к виду, который понимает плеер: можно вставлять
// в videos.json адрес страницы, а не готовый embed.
function normalizeEmbedUrl(video) {
  const url = String((video && video.url) || '').trim();
  if (!url) return url;

  // уже готовый embed — оставляем как есть
  if (/video_ext\.php|clip_ext\.php|\/embed\//.test(url)) return url;

  if (/youtube\.com|youtu\.be/.test(url)) {
    const id = extractYouTubeId(url);
    if (id) return 'https://www.youtube.com/embed/' + id;
  }

  // VK: vk.com/vk.ru/vkvideo.ru, видео (video-123_456) и клипы (clip-123_456)
  const vk = url.match(/(?:vk\.com|vk\.ru|vkvideo\.ru)\/(clip|video)(-?\d+)_(\d+)/);
  if (vk) {
    const file = vk[1] === 'clip' ? 'clip_ext.php' : 'video_ext.php';
    return 'https://vk.com/' + file + '?oid=' + vk[2] + '&id=' + vk[3];
  }

  return url;
}

function buildEmbedUrl(video) {
  let url = normalizeEmbedUrl(video);

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

/* --- Тост и копирование почты --------------------------------------------- */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // Запасной путь для http и старых движков: скрытое поле + execCommand
  return new Promise((resolve, reject) => {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0';
    document.body.appendChild(field);
    field.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(field);
    ok ? resolve() : reject(new Error('copy failed'));
  });
}

async function handleEmailCopy(event) {
  event.preventDefault();
  try {
    await copyToClipboard(CONTACTS.email);
    showToast('Адрес скопирован: ' + CONTACTS.email);
  } catch (e) {
    // Копирование недоступно — открываем почтовый клиент, как раньше
    window.location.href = 'mailto:' + CONTACTS.email;
  }
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

  document.querySelectorAll('#mailBtn, [data-contact="email"]').forEach((el) => {
    el.addEventListener('click', handleEmailCopy);
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
    updateShortsNav();
  }, 150);
});

document.addEventListener('DOMContentLoaded', () => {
  setupContacts();
  setupYear();
  bindShortsNav();
  loadVideos();
});

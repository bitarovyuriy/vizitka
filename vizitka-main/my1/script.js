/* =========================================================
   ПОРТФОЛИО ВИДЕОМОНТАЖЁРА — ЛОГИКА
   - Загрузка videos.json через fetch()
   - Рендер карточек
   - Модальное окно с iframe
   - Защита контактов от спама
   ========================================================= */

/* ---------- ДЕФОЛТНЫЕ ВИДЕО (если videos.json недоступен) ---------- */
const DEFAULT_VIDEOS = [
  {
    id: 1,
    title: "Музыкальный клип | Dream Avenue",
    description: "Динамичный монтаж, цветокоррекция, VFX эффекты",
    url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    thumbnail: "",
    platform: "youtube"
  },
  {
    id: 2,
    title: "Рекламный ролик | Бренд XYZ",
    description: "Motion дизайн, 2D анимация, синхронизация с музыкой",
    url: "https://www.youtube.com/embed/9bZkp7q19f0",
    thumbnail: "",
    platform: "youtube"
  },
  {
    id: 3,
    title: "Документальный фильм | Городские истории",
    description: "Эмоциональный монтаж, работа со звуком, интершум",
    url: "https://player.vimeo.com/video/76979871",
    thumbnail: "",
    platform: "vimeo"
  }
];

/* ---------- DOM-ЭЛЕМЕНТЫ ---------- */
const videoGrid     = document.getElementById('videoGrid');
const headerCircles = document.getElementById('headerCircles');
const gridLoader    = document.getElementById('gridLoader');
const refreshBtn    = document.getElementById('refreshBtn');
const modal         = document.getElementById('modal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalClose    = document.getElementById('modalClose');
const modalIframeWrap = document.getElementById('modalIframeWrap');
const modalTitle    = document.getElementById('modalTitle');
const modalDesc     = document.getElementById('modalDesc');
const videoLoader   = document.getElementById('videoLoader');

/* =========================================================
   1. ЗАГРУЗКА ДАННЫХ ИЗ videos.json
   ========================================================= */
async function loadVideos() {
  showGridLoader(true);
  videoGrid.innerHTML = '';

  let videos;
  try {
    // Добавляем метку времени, чтобы избежать кеширования при обновлении
    const response = await fetch('videos.json?_=' + Date.now());
    if (!response.ok) throw new Error('Файл не найден');

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Пустой список');

    videos = data;
  } catch (err) {
    // Если JSON недоступен (например, открыто без сервера) — используем дефолтные
    console.warn('Не удалось загрузить videos.json:', err.message, '— показываю дефолтные примеры.');
    videos = DEFAULT_VIDEOS;
  } finally {
    renderVideos(videos);          // рисуем ленту
    renderHeaderCircles(videos);   // рисуем кружки в хедере
    showGridLoader(false);
  }
}

/* =========================================================
   2. ГЕНЕРАЦИЯ КАРТОЧЕК
   ========================================================= */
function renderVideos(videos) {
  videoGrid.innerHTML = '';

  if (!videos.length) {
    videoGrid.innerHTML = '<p class="grid-message">Работы пока не добавлены.</p>';
    return;
  }

  videos.forEach((video, index) => {
    const card = document.createElement('article');
    card.className = 'video-card';

    // Превью: либо указанный thumbnail, либо автогенерация из YouTube
    const thumb = getThumbnail(video);
    // Бейдж платформы
    const badge = video.platform ? video.platform.toUpperCase() : 'VIDEO';

    card.innerHTML = `
      <div class="video-card__thumb">
        <span class="video-card__badge">${badge}</span>
        <img src="${thumb}" alt="${escapeHtml(video.title)}" loading="lazy"
             onerror="this.style.display='none'">
        <div class="video-card__play"><i class="fa-solid fa-play"></i></div>
      </div>
      <div class="video-card__body">
        <h3 class="video-card__title">${escapeHtml(video.title)}</h3>
        <p class="video-card__desc">${escapeHtml(video.description)}</p>
        <button class="video-card__btn"><i class="fa-solid fa-play"></i> Смотреть</button>
      </div>
    `;

    // Клик по всей карточке и по кнопке — открывает модалку
    card.addEventListener('click', () => openModal(video));

    videoGrid.appendChild(card);

    // Stagger-анимация: каждая карточка появляется с задержкой
    setTimeout(() => card.classList.add('show'), index * 100);
  });
}

/* =========================================================
   КРУЖКИ-ПРЕВЬЮ ВИДЕО В ХЕДЕРЕ
   ========================================================= */
function renderHeaderCircles(videos) {
  if (!headerCircles) return;
  headerCircles.innerHTML = '';

  if (!Array.isArray(videos) || videos.length === 0) return;

  const MAX = 4; // сколько кружков показать в хедере
  const shown = videos.slice(0, MAX);

  shown.forEach((video, index) => {
    const circle = document.createElement('div');
    circle.className = 'header-circle';
    circle.style.animationDelay = (index * 0.12) + 's'; // stagger
    circle.title = video.title || '';

    const thumb = getThumbnail(video);
    circle.innerHTML = `<img src="${thumb}" alt="${escapeHtml(video.title)}" loading="lazy" onerror="this.style.display='none'">`;

    // Клик по кружку — открыть модалку с этим видео
    circle.addEventListener('click', (e) => { e.stopPropagation(); openModal(video); });

    headerCircles.appendChild(circle);
  });

  // Если работ больше — добавляем кружок "+N", который скроллит к портфолио
  if (videos.length > MAX) {
    const more = document.createElement('div');
    more.className = 'header-circle header-circle--more';
    more.style.animationDelay = (MAX * 0.12) + 's';
    more.textContent = '+' + (videos.length - MAX);
    more.title = 'Смотреть все работы';
    more.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('portfolio').scrollIntoView({ behavior: 'smooth' });
    });
    headerCircles.appendChild(more);
  }
}

/* Получить превью видео */
function getThumbnail(video) {
  // Если задан явный thumbnail — используем его
  if (video.thumbnail && video.thumbnail.trim() !== '') return video.thumbnail;

  // Автогенерация превью для YouTube
  if (video.platform === 'youtube') {
    const id = extractYouTubeId(video.url);
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }

  // Vimeo и прочее — заглушка (тёмный фон карточки)
  return 'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#111"/></svg>');
}

/* Извлечь ID видео YouTube из embed-ссылки */
function extractYouTubeId(url) {
  const match = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/* =========================================================
   3. МОДАЛЬНОЕ ОКНО
   ========================================================= */
function openModal(video) {
  // Заголовок и описание
  modalTitle.textContent = video.title;
  modalDesc.textContent = video.description;

  // Показываем лоадер видео
  videoLoader.style.display = 'flex';
  modalIframeWrap.innerHTML = '';

  // Формируем итоговый URL с нужными параметрами
  const src = buildEmbedUrl(video);

  // Создаём iframe с защитой sandbox
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-forms allow-presentation');
  // Когда iframe загрузился — прячем лоадер
  iframe.addEventListener('load', () => { videoLoader.style.display = 'none'; });

  modalIframeWrap.appendChild(iframe);

  // Открываем модалку
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden'; // блокируем прокрутку фона
}

/* Сборка URL с параметрами под платформу */
function buildEmbedUrl(video) {
  let url = video.url;

  if (video.platform === 'youtube') {
    // YouTube: убираем рекламу, без автовоспроизведения
    url += (url.includes('?') ? '&' : '?') +
      'rel=0&modestbranding=1&controls=1&showinfo=0&autoplay=0';
  } else if (video.platform === 'vimeo') {
    // Vimeo: приватность, без лишней информации
    url += (url.includes('?') ? '&' : '?') +
      'dnt=1&title=0&byline=0&portrait=0&autoplay=0';
  }

  return url;
}

/* Закрытие модалки */
function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modalIframeWrap.innerHTML = ''; // удаляем iframe -> останавливаем видео
  document.body.style.overflow = ''; // возвращаем прокрутку
}

/* Закрытие: крестик, фон, ESC */
modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
});

/* =========================================================
   4. КНОПКА "ОБНОВИТЬ ЛЕНТУ"
   ========================================================= */
refreshBtn.addEventListener('click', () => {
  refreshBtn.classList.add('loading');
  loadVideos().finally(() => {
    setTimeout(() => refreshBtn.classList.remove('loading'), 500);
  });
});

/* =========================================================
   5. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ========================================================= */
function showGridLoader(show) {
  gridLoader.style.display = show ? 'flex' : 'none';
}

/* Экранирование HTML (защита от поломки разметки) */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* =========================================================
   6. ЗАЩИТА КОНТАКТОВ ОТ СПАМА (подстановка через JS)
   ========================================================= */
function setupContacts() {
  // ⚙️ ИЗМЕНИ ЗДЕСЬ свои контакты:
  const tgUser = 'alex_volkov';            // ник в Telegram без @
  const mailUser = 'alex.volkov';          // часть до @
  const mailDomain = 'gmail.com';          // домен

  const tgBtn = document.getElementById('tgBtn');
  const mailBtn = document.getElementById('mailBtn');

  // Собираем ссылки динамически — боты не считают их из HTML
  tgBtn.href = 'https://t.me/' + tgUser;
  mailBtn.href = 'mailto:' + mailUser + '@' + mailDomain;
}

/* =========================================================
   7. ИНИЦИАЛИЗАЦИЯ
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  loadVideos();        // загружаем видео
  setupContacts();     // подставляем контакты
  // Год в футере
  document.getElementById('year').textContent = new Date().getFullYear();
});
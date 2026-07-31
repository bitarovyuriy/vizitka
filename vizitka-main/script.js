


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

const VK_PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">' +
  '<rect width="100%" height="100%" fill="#0077FF"/>' +
  '<text x="50%" y="50%" font-family="Arial, sans-serif" font-size="120" ' +
  'font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">VK</text>' +
  '</svg>'
);

const videoGrid     = document.getElementById('videoGrid');
const carouselTrack = document.getElementById('carouselTrack');
const prevBtn       = document.getElementById('prevBtn');
const nextBtn       = document.getElementById('nextBtn');
const gridLoader    = document.getElementById('gridLoader');
const refreshBtn    = document.getElementById('refreshBtn');
const modal         = document.getElementById('modal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalClose    = document.getElementById('modalClose');
const modalIframeWrap = document.getElementById('modalIframeWrap');
const modalTitle    = document.getElementById('modalTitle');
const modalDesc     = document.getElementById('modalDesc');
const videoLoader   = document.getElementById('videoLoader');
const carouselEl    = document.querySelector('.carousel');

let videos = [];
let currentIndex = 0;
let autoplayInterval = null;
const AUTOPLAY_DELAY = 2000; 


async function loadVideos() {
  showGridLoader(true);
  videoGrid.innerHTML = '';

  try {
    
    const response = await fetch('videos.json?_=' + Date.now());
    if (!response.ok) throw new Error('Файл не найден');

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Пустой список');

    videos = data;
  } catch (err) {
    
    console.warn('Не удалось загрузить videos.json:', err.message, '— показываю дефолтные примеры.');
    videos = DEFAULT_VIDEOS;
  } finally {
    currentIndex = 0;
    renderVideos(videos);
    buildCarousel();
    updateCarousel();
    
    setTimeout(updateCarousel, 100);
    setTimeout(updateCarousel, 300);
    setTimeout(updateCarousel, 700);
    startAutoplay();
    showGridLoader(false);
  }
}


function renderVideos(videos) {
  videoGrid.innerHTML = '';

  if (!videos.length) {
    videoGrid.innerHTML = '<p class="grid-message">Работы пока не добавлены.</p>';
    return;
  }

  videos.forEach((video, index) => {
    const card = document.createElement('article');
    card.className = 'video-card';

    
    const thumb = getThumbnail(video);
    
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

   
    card.addEventListener('click', () => openModal(video));

    videoGrid.appendChild(card);

    
    setTimeout(() => card.classList.add('show'), index * 100);
  });
}


function buildCarousel() {
  if (!carouselTrack) return;
  carouselTrack.innerHTML = '';

  videos.forEach((video, idx) => {
    const card = document.createElement('div');
    card.className = 'carousel-card';
    card.dataset.index = idx;
    card.innerHTML = `
      <img src="${getThumbnail(video)}" alt="${escapeHtml(video.title)}" loading="lazy" onerror="this.style.display='none'">
      <div class="card-title">${escapeHtml(video.title)}</div>
    `;

    
    const img = card.querySelector('img');
    if (img) {
      img.addEventListener('load', updateCarousel);
      img.addEventListener('error', updateCarousel);
    }

    card.addEventListener('click', () => {
      if (idx === currentIndex) {
        openModal(video);
      } else {
        currentIndex = idx;
        updateCarousel();
        startAutoplay();
      }
    });

    carouselTrack.appendChild(card);
  });
}

function updateCarousel() {
  if (!carouselTrack || !carouselEl) return;

  const cards = carouselTrack.querySelectorAll('.carousel-card');
  if (!cards.length) return;

  cards.forEach((card, idx) => {
    card.classList.toggle('active', idx === currentIndex);
  });

  const activeCard = cards[currentIndex];
  if (!activeCard) return;

  const wrapper = carouselTrack.parentElement;

  if (activeCard.offsetWidth === 0 || wrapper.offsetWidth === 0) {
    requestAnimationFrame(updateCarousel);
    return;
  }

  const wrapperCenter = wrapper.clientWidth / 2;
  const cardCenter = activeCard.offsetLeft + activeCard.offsetWidth / 2;
  const offset = wrapperCenter - cardCenter;

  carouselTrack.style.transform = `translateX(${offset}px)`;
}
function nextSlide() {
  if (videos.length === 0) return;
  currentIndex = (currentIndex + 1) % videos.length;
  updateCarousel();
}

function prevSlide() {
  if (videos.length === 0) return;
  currentIndex = (currentIndex - 1 + videos.length) % videos.length;
  updateCarousel();
}

if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); startAutoplay(); });
if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); startAutoplay(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') { nextSlide(); startAutoplay(); }
  if (e.key === 'ArrowLeft')  { prevSlide(); startAutoplay(); }
});


let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(updateCarousel, 150);
});


let touchStartX = 0;
let touchEndX = 0;

if (carouselEl) {
  carouselEl.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    stopAutoplay();
  }, { passive: true });

  carouselEl.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 40) {     // порог свайпа
      if (diff > 0) nextSlide();
      else prevSlide();
    }
    setTimeout(startAutoplay, 3000);
  }, { passive: true });
}


function startAutoplay() {
  stopAutoplay();
  autoplayInterval = setInterval(() => {
    nextSlide();
  }, AUTOPLAY_DELAY);
}

function stopAutoplay() {
  if (autoplayInterval) {
    clearInterval(autoplayInterval);
    autoplayInterval = null;
  }
}

if (carouselEl) {
  carouselEl.addEventListener('mouseenter', stopAutoplay);
  carouselEl.addEventListener('mouseleave', startAutoplay);
}

function getThumbnail(video) {
  
  if (video.thumbnail && video.thumbnail.trim() !== '') {
    return video.thumbnail.trim();
  }

  
  if (video.platform === 'vk') {
    return VK_PLACEHOLDER;
  }

  
  if (video.platform === 'youtube') {
    const id = extractYouTubeId(video.url);
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }

  
  return 'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">' +
      '<rect width="100%" height="100%" fill="#111"/>' +
      '</svg>'
    );
}


function extractYouTubeId(url) {
  const match = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}


function openModal(video) {
  stopAutoplay();

  
  modalTitle.textContent = video.title;
  modalDesc.textContent = video.description;

  
  videoLoader.style.display = 'flex';
  modalIframeWrap.innerHTML = '';

  
  const src = buildEmbedUrl(video);

  
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
  iframe.setAttribute('allowfullscreen', '');
  iframe.frameBorder = '0';

  
  if (video.platform !== 'vk' && video.platform !== 'youtube') {
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-forms allow-presentation');
  }

  
  iframe.addEventListener('load', () => { videoLoader.style.display = 'none'; });

  modalIframeWrap.appendChild(iframe);


  
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden'; // блокируем прокрутку фона
}


function buildEmbedUrl(video) {
  let url = video.url;
  
  const sep = url.includes('?') ? '&' : '?';

  if (video.platform === 'youtube') {
    
    url += sep + 'rel=0&modestbranding=1&controls=1&showinfo=0&autoplay=0';
  } else if (video.platform === 'vimeo') {
    
    url += sep + 'dnt=1&title=0&byline=0&portrait=0&autoplay=0';
  } else if (video.platform === 'vk') {
    
    url += sep + 'hd=2&autoplay=0';
  }

  return url;
}


function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modalIframeWrap.innerHTML = ''; 
  document.body.style.overflow = ''; 
  startAutoplay();
}


modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
});


refreshBtn.addEventListener('click', () => {
  refreshBtn.classList.add('loading');
  loadVideos().finally(() => {
    setTimeout(() => refreshBtn.classList.remove('loading'), 500);
  });
});


function showGridLoader(show) {
  gridLoader.style.display = show ? 'flex' : 'none';
}


function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function setupContacts() {
  
  const tgUser = 'betaraw';            
  const mailUser = 'bz.jura';          
  const mailDomain = 'gmail.com';          

  const tgBtn = document.getElementById('tgBtn');
  const mailBtn = document.getElementById('mailBtn');

  
  tgBtn.href = 'https://t.me/' + tgUser;
  mailBtn.href = 'mailto:' + mailUser + '@' + mailDomain;
}


document.addEventListener('DOMContentLoaded', () => {
  loadVideos();        
  setupContacts();     
  // Год в футере
  document.getElementById('year').textContent = new Date().getFullYear();
});
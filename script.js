import { addGuestbookEntry, isFirebaseConfigured, subscribeGuestbook } from './firebase-guestbook.js';

// --- 확대(줌) 억제: 핀치줌·빠른 멀티터치 차단은 index.html head에서 이미 최대한 빨리 등록해둠 ---
// 더블탭 줌 차단: 실제 iOS 더블탭 줌은 "같은 지점"을 500ms 안에 두 번 탭했을 때만 발생하므로,
// 시간뿐 아니라 위치(거리)도 같이 확인해야 함. 안 그러면 갤러리 썸네일을 빠르게 연속으로
// 탭할 때(다른 지점, 짧은 간격) 오탐되어 클릭이 씹히는 문제가 생김.
document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
let __lastTouchEnd = 0;
let __lastTouchX = 0;
let __lastTouchY = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  const touch = e.changedTouches && e.changedTouches[0];
  const x = touch ? touch.clientX : 0;
  const y = touch ? touch.clientY : 0;
  const dx = x - __lastTouchX;
  const dy = y - __lastTouchY;
  const isSameSpot = Math.hypot(dx, dy) < 25; // 같은 지점(25px 이내)일 때만 더블탭으로 간주
  if (now - __lastTouchEnd <= 500 && isSameSpot) e.preventDefault();
  __lastTouchEnd = now;
  __lastTouchX = x;
  __lastTouchY = y;
}, { passive: false });

// --- 히어로 눈 날림 효과: 입자마다 크기·방향·흔들림·소멸 여부를 랜덤하게 줘서 역동적으로 흩날리게 함 ---
// 입자 모양은 여기서 쉽게 바꿀 수 있습니다. 배열에 여러 개를 넣으면 입자마다 랜덤하게 섞여서 나옵니다.
// 사용 가능한 값: 'circle'(동그라미) | 'square'(사각형) | 'star'(별) | 'heart'(하트)
const HERO_SNOW_SHAPES = ['circle'];
// 입자 색깔도 여기서 바꿀 수 있습니다. '#RRGGBB' 형식으로 넣으면 되고,
// 여러 개를 넣으면 입자마다 랜덤하게 섞여서 나옵니다. (예: ['#ffffff', '#f6d9c3'])
const HERO_SNOW_COLORS = ['#ffffff'];

function hexToRgbString(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`;
}

function drawSnowShape(ctx, shape, x, y, r) {
  ctx.beginPath();
  if (shape === 'square') {
    ctx.rect(x - r, y - r, r * 2, r * 2);
  } else if (shape === 'star') {
    const spikes = 5, outerR = r, innerR = r * 0.45;
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 === 0 ? outerR : innerR;
      const a = (Math.PI / spikes) * i - Math.PI / 2;
      const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'heart') {
    const s = r / 1.1;
    ctx.moveTo(x, y + s * .9);
    ctx.bezierCurveTo(x - s * 1.4, y - s * .4, x - s * .5, y - s * 1.3, x, y - s * .4);
    ctx.bezierCurveTo(x + s * .5, y - s * 1.3, x + s * 1.4, y - s * .4, x, y + s * .9);
    ctx.closePath();
  } else {
    ctx.arc(x, y, r, 0, Math.PI * 2); // circle (기본값)
  }
}

function setupHeroSnow() {
  const canvas = document.querySelector('.hero-snow');
  const frame = document.querySelector('.hero-frame');
  if (!canvas || !frame) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; // 모션 최소화 설정 존중

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let particles = [];
  let width = 0, height = 0;
  let running = false;
  let rafId = null;

  const randomParticle = (seedAcrossHeight) => {
    // 전체적으로는 아래쪽 위주(기준 각도 -35~35도)로 날리되, 매 프레임 각도 자체가 천천히
    // 출렁여서(dirWobble) 직선으로 뻔하게 떨어지지 않고 자유롭게 흐르는 궤적을 만듦
    const baseAngle = ((Math.random() * 70) - 35) * Math.PI / 180;
    const dirWobbleRange = ((Math.random() * 22) + 14) * Math.PI / 180;
    const speed = Math.random() * 1.1 + 0.7;
    const fades = Math.random() < 0.4; // 입자 중 40%만 날리는 도중 서서히 사라지는 효과 적용
    const baseR = Math.random() * 2.6 + 1.4; // 입자 크기: 1.4~4px, 랜덤
    return {
      x: Math.random() * width,
      y: seedAcrossHeight ? Math.random() * height : -10,
      baseAngle,
      dir: Math.random() * Math.PI * 2,        // 방향 출렁임 위상(입자마다 다르게 시작)
      dirSpeed: Math.random() * 0.018 + 0.006,
      dirWobbleRange,
      speed,
      baseR,
      pulse: Math.random() * Math.PI * 2,       // 멀어졌다 가까워졌다 하는 느낌의 크기 변화 위상
      pulseSpeed: Math.random() * 0.008 + 0.003,
      pulseRange: baseR * (Math.random() * 0.35 + 0.2), // 기본 크기의 20~55% 정도 오르내림
      wobble: Math.random() * Math.PI * 2,      // 좌우 미세 흔들림 위상(방향 출렁임과는 별개, 잔떨림용)
      wobbleSpeed: Math.random() * 0.02 + 0.006,
      wobbleRange: Math.random() * 1 + 0.4,
      baseOpacity: Math.random() * 0.45 + 0.35,
      fades,
      life: 0,
      maxLife: fades ? Math.random() * 130 + 90 : Infinity, // 페이드 입자만 수명을 둬서 다 사라지면 재생성
      shape: HERO_SNOW_SHAPES[Math.floor(Math.random() * HERO_SNOW_SHAPES.length)],
      color: hexToRgbString(HERO_SNOW_COLORS[Math.floor(Math.random() * HERO_SNOW_COLORS.length)])
    };
  };

  function resize() {
    const rect = frame.getBoundingClientRect();
    width = rect.width; height = rect.height;
    canvas.width = width * dpr; canvas.height = height * dpr;
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function init() {
    resize();
    const count = Math.max(26, Math.min(70, Math.round((width * height) / 8500)));
    particles = Array.from({ length: count }, () => randomParticle(true));
  }

  function frameStep() {
    if (!running) return;
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
      p.dir += p.dirSpeed;
      p.wobble += p.wobbleSpeed;
      p.pulse += p.pulseSpeed;
      p.life += 1;
      // 기준 각도에 출렁임을 더해서 매 프레임 진행 방향이 자유롭게 바뀌는 곡선 궤적을 만듦
      const angle = p.baseAngle + Math.sin(p.dir) * p.dirWobbleRange;
      p.y += Math.cos(angle) * p.speed;
      p.x += Math.sin(angle) * p.speed + Math.sin(p.wobble) * p.wobbleRange * 0.05;
      const offBottom = p.y > height + 8;
      const lifeOver = p.fades && p.life >= p.maxLife;
      if (offBottom || lifeOver) { Object.assign(p, randomParticle(false)); return; }
      if (p.x < -8) p.x = width + 8; else if (p.x > width + 8) p.x = -8;
      // 페이드 입자는 등장(0→1)과 소멸(1→0)이 부드럽게 이어지도록 sin 커브로 투명도 계산
      const opacity = p.fades ? p.baseOpacity * Math.sin(Math.PI * Math.min(p.life / p.maxLife, 1)) : p.baseOpacity;
      // 멀어졌다 가까워졌다 하는 느낌: 기본 크기를 중심으로 살짝씩 커졌다 작아졌다 반복
      const r = Math.max(p.baseR + Math.sin(p.pulse) * p.pulseRange, 0.6);
      drawSnowShape(ctx, p.shape, p.x, p.y, r);
      ctx.fillStyle = `rgba(${p.color},${Math.max(opacity, 0)})`;
      ctx.fill();
    });
    rafId = requestAnimationFrame(frameStep);
  }

  function start() { if (running) return; running = true; frameStep(); }
  function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; }

  init();
  new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && document.visibilityState === 'visible') start(); else stop();
    });
  }, { threshold: 0 }).observe(frame);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') stop();
    else if (frame.getBoundingClientRect().bottom > 0) start();
  });
  window.addEventListener('resize', () => { resize(); });
}

// --- 사진 확대 전용 차단: 갤러리/히어로 이미지는 롱프레스 저장/드래그까지 추가로 차단 ---
function blockImageZoom() {
  document.querySelectorAll('.hero-illustration img, .gallery-featured img, .gallery-thumb img')
    .forEach(img => {
      if (img.__zoomBlocked) return;
      img.__zoomBlocked = true;
      img.addEventListener('dragstart', e => e.preventDefault());
    });
}

// --- 좌우 스크롤 슬라이더 공통: 내용이 화면 폭을 넘어갈 때만 화살표를 보여주고, 누르면 다음/이전 아이템 경계로 정확히 이동 ---
function setupSlider(wrapSelector, scrollSelector) {
  const wrap = document.querySelector(wrapSelector);
  const scrollEl = document.querySelector(scrollSelector);
  if (!wrap || !scrollEl) return;
  const prevBtn = wrap.querySelector('.slider-nav-prev');
  const nextBtn = wrap.querySelector('.slider-nav-next');
  if (!prevBtn || !nextBtn) return;

  const maxScroll = () => scrollEl.scrollWidth - scrollEl.clientWidth;

  // 고정폭만큼 scrollBy 하면 남은 거리가 애매하게 남아 아이템 중간에서 멈춰 여백이 보일 수 있어서,
  // 항상 실제 아이템의 시작 위치(offsetLeft)로 스크롤을 맞춰서 절대 어중간한 위치에 멈추지 않게 함.
  // scroll-snap-type이 mandatory인 경우 유효한 스냅 위치는 offsetLeft가 아니라
  // offsetLeft - scroll-padding-left 이므로, 이 값으로 보정하지 않으면 스냅이 목표 위치를
  // 무효 처리하고 원래 자리로 되돌려버려 버튼을 눌러도 안 움직이는 것처럼 보인다.
  const snapInset = parseFloat(getComputedStyle(scrollEl).scrollPaddingLeft) || 0;
  const goTo = dir => {
    const positions = Array.from(scrollEl.children).map(el => el.offsetLeft - snapInset);
    const current = scrollEl.scrollLeft;
    const end = maxScroll();
    let target;
    if (dir > 0) {
      target = positions.find(pos => pos > current + 2);
      target = target === undefined ? end : Math.min(target, end);
    } else {
      target = [...positions].reverse().find(pos => pos < current - 2);
      target = target === undefined ? 0 : Math.max(target, 0);
    }
    scrollEl.scrollTo({ left: target, behavior: 'smooth' });
  };

  const update = () => {
    const hasOverflow = scrollEl.scrollWidth > scrollEl.clientWidth + 1;
    wrap.classList.toggle('has-overflow', hasOverflow);
    if (!hasOverflow) return;
    const end = maxScroll();
    prevBtn.disabled = scrollEl.scrollLeft <= 1;
    nextBtn.disabled = scrollEl.scrollLeft >= end - 1;
  };

  prevBtn.addEventListener('click', () => goTo(-1));
  nextBtn.addEventListener('click', () => goTo(1));
  scrollEl.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  new MutationObserver(update).observe(scrollEl, { childList: true });
  update();
}

// --- 문구별 폰트/크기 커스터마이징: wedding.json의 "typography" 값을 읽어 각 영역에 적용 ---
const TYPOGRAPHY_MAP = {
  hero: '.hero-headline, .hero-date, .hero-names-line',
  sectionLabel: '.section-label, .eyebrow',
  sectionTitle: '.section h2, .info h2, .thanks h2',
  body: '.prose, .invitation-parents, .address, .transit b, .transit span, .account-list h3, .account-list p, .account-group summary, .dday',
  countdown: '.countdown-value',
  story: '.timeline time, .timeline h3, .timeline p',
  guestbook: '.guestbook-entry p, .guestbook-entry strong',
  thanks: '.thanks span, .thanks p'
};
// 프리셋: index.html에 이미 불러온, 모바일 청첩장에서 자주 쓰이는 구글 폰트들. 새 폰트를 추가하려면 index.html의 <link href="https://fonts.googleapis.com/css2?...">에도 함께 추가해야 합니다.
const FONT_PRESETS = {
  serif: 'var(--serif)',                // 차분하고 단정한 한글 명조 - 기본 세리프 (Gowun Batang)
  myeongjo: "'Nanum Myeongjo', serif",  // 전통적인 느낌의 명조체 - 격식 있는 본문에 어울림
  maruburi: "'MaruBuri', serif",        // 네이버 마루 부리 - 온기 있고 현대적인 명조 계열(웹폰트는 style.css에서 별도 로드)
  thin: "'Song Myung', serif",          // 가늘고 우아한 세리프 - 숫자·날짜·짧은 문구에 어울림
  dodum: "'Gowun Dodum', sans-serif",   // 부드럽고 둥근 고딕 - 편안한 느낌의 본문/설명
  sans: 'var(--sans)',                  // 깔끔한 기본 고딕 (Pretendard)
  script: "'Parisienne', cursive",      // 우아한 영문 필기체 - 포인트 강조용(한글엔 자동 대체)
  handwriting: "'Gamja Flower', cursive" // 귀엽고 따뜻한 손글씨 - 방명록 등 친근한 느낌
};
function applyTypography(typography = {}) {
  let css = '';
  Object.entries(typography).forEach(([key, rules]) => {
    const selector = TYPOGRAPHY_MAP[key];
    if (!selector || !rules || typeof rules !== 'object') return;
    const decls = [];
    if (rules.fontFamily) decls.push(`font-family: ${FONT_PRESETS[rules.fontFamily] || `'${rules.fontFamily}', var(--sans)`} !important`);
    if (rules.fontSize) decls.push(`font-size: ${rules.fontSize} !important`);
    if (rules.fontWeight) decls.push(`font-weight: ${rules.fontWeight} !important`);
    if (rules.lineHeight) decls.push(`line-height: ${rules.lineHeight} !important`);
    if (rules.letterSpacing) decls.push(`letter-spacing: ${rules.letterSpacing} !important`);
    if (rules.color) decls.push(`color: ${rules.color} !important`);
    if (!decls.length) return;
    css += `${selector} { ${decls.join('; ')}; }\n`;
  });
  let styleTag = document.getElementById('dynamic-typography');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'dynamic-typography';
    document.head.append(styleTag);
  }
  styleTag.textContent = css;
}

const $ = (s, p = document) => p.querySelector(s);
const esc = (value = '') => String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
// 배열이면 줄마다, 문자열이면 \n 기준으로 나눠 각 줄을 이스케이프한 뒤 <br>로 합침 (여러 줄 문구용)
const escLines = (value) => (Array.isArray(value) ? value : String(value ?? '').split('\n')).map(esc).join('<br>');
let data, gallery = [], activeImage = 0, audio, guestbookEntries = [];
const toast = message => { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2200); };
const ddaySentence = (iso, groom, bride) => { const wedding = new Date(iso); if (Number.isNaN(wedding)) return ''; const now = new Date(); const inKorea = d => new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })); const a = inKorea(now); const b = inKorea(wedding); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0); const days = Math.round((b - a) / 86400000); const names = `${esc(groom)} <i>&amp;</i> ${esc(bride)}`; if (days === 0) return `오늘은 ${names}의 <b class="dday-count">결혼식</b>이에요`; if (days > 0) return `${names}의 결혼식까지 <b class="dday-count">${days}일</b> 남았어요`; return `${names}가 결혼한 지 <b class="dday-count">${Math.abs(days)}일</b> 되었어요`; };
const weddingDate = iso => { const value = new Date(iso); if (Number.isNaN(value)) return { year: '', month: '', day: '', display: '', weekday: '', time: '' }; const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(value).filter(p => p.type !== 'literal').map(p => [p.type, p.value])); const weekday = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'long' }).format(value); const hour = Number(values.hour); const minute = Number(values.minute); const time = `${values.dayPeriod === 'PM' ? '오후' : '오전'} ${hour}시${minute ? ` ${minute}분` : ''}`; return { year: values.year, month: values.month, day: values.day, display: `${values.year}.${values.month}.${values.day}`, weekday, time }; };
const parentsLine = (parents, name) => { if (!parents) return ''; const names = [parents.father, parents.mother].filter(Boolean).map(n => `<strong class="invitation-name">${esc(n)}</strong>`).join(' · '); return `${names}의 <span class="invitation-child">${esc(parents.child || '')}</span> <strong class="invitation-name">${esc(name)}</strong>`; };
// 신랑/신부 이름에서 성을 뗀 이름만 반환 (한 글자 성을 가정하는 일반적인 관례). invitation 본문 하단·D-day 문구 전용.
const givenName = (name = '') => { const s = String(name).trim(); return s.length > 1 ? s.slice(1) : s; };
const weddingCalendar = when => { const year = Number(when.year), month = Number(when.month), eventDay = Number(when.day); if (!year || !month || !eventDay) return ''; const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate(); const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? '<span class="calendar-empty"></span>' : `<span class="calendar-day${index - firstWeekday + 1 === eventDay ? ' calendar-event' : ''}">${index - firstWeekday + 1}</span>`); return `<div class="calendar" aria-label="${when.display} 달력"><div class="calendar-weekdays"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div class="calendar-days">${cells.join('')}</div></div>`; };
// 히어로 상단 날짜 배지("07TH NOV 2026" 형식)용 서수 표기와 월 약어
const ordinalDay = n => { const num = Number(n); if (!num) return ''; const v = num % 100; const suffix = (v >= 11 && v <= 13) ? 'TH' : ['TH', 'ST', 'ND', 'RD'][num % 10] || 'TH'; return `${num}${suffix}`; };
const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// 모든 섹션 공통: label/title이 wedding.json에 없거나 빈 값이면 해당 태그 자체를 렌더링하지 않습니다.
// (하드코딩된 기본값으로 대체하지 않음 → invitation 섹션과 동일한 방식으로 통일)
const tag = (tagName, className, value) => value ? `<${tagName}${className ? ` class="${className}"` : ''}>${esc(value)}</${tagName}>` : '';
function page(d) {
  const w = d.wedding || {}, c = d.couple || {}, invitation = d.invitation || {}, when = weddingDate(w.date); gallery = d.gallery?.images || [];
  const accountGroups = d.accounts?.groups || [];
  const weddingDay = d.weddingDay || {}, galleryData = d.gallery || {}, location = d.location || {}, accounts = d.accounts || {}, guestbook = d.guestbook || {};
  return `
<header class="hero"><div class="hero-frame"><div class="hero-illustration"><img src="${esc(d.hero?.image)}" alt="${esc(d.hero?.alt)}" onerror="this.parentElement.classList.add('image-error')"></div><canvas class="hero-snow" aria-hidden="true"></canvas><div class="hero-copy"><p class="hero-date"><span>${esc(when.year)}</span><span>${esc(MONTH_ABBR[Number(when.month) - 1] || '')}</span><span>${esc(ordinalDay(when.day))}</span></p><h1 class="hero-headline">Getting<br>Married</h1></div><p class="hero-names-line"><span>${esc(c.brideEn || c.bride)}</span><span>${esc(c.groomEn || c.groom)}</span></p></div></header>
<section class="section invitation reveal">${tag('p', 'section-label', invitation.label)}${tag('h2', '', invitation.title)}<div class="prose">${(invitation.paragraphs || []).map(p => `<p>${esc(p)}</p>`).join('')}</div><hr class="invitation-divider"><p class="invitation-parents"><span>${parentsLine(c.groomParents, c.groom)}</span><span>${parentsLine(c.brideParents, c.bride)}</span></p></section>
<section class="section info reveal">${tag('p', 'section-label', weddingDay.label)}<h2>${esc(when.display)}<br><span class="wedding-day-time">${esc(when.weekday)} ${esc(when.time)}</span></h2>${weddingCalendar(when)}<div class="countdown" id="countdown" data-target="${esc(w.date)}"><div class="countdown-unit"><span class="countdown-value" data-unit="days">00</span><small>DAYS</small></div><div class="countdown-sep">:</div><div class="countdown-unit"><span class="countdown-value" data-unit="hours">00</span><small>HRS</small></div><div class="countdown-sep">:</div><div class="countdown-unit"><span class="countdown-value" data-unit="minutes">00</span><small>MIN</small></div><div class="countdown-sep">:</div><div class="countdown-unit"><span class="countdown-value" data-unit="seconds">00</span><small>SEC</small></div></div><strong class="dday">${ddaySentence(w.date, givenName(c.groom), givenName(c.bride))}</strong></section>
<section class="section gallery-section reveal">${tag('p', 'section-label', galleryData.label)}${tag('h2', '', galleryData.title)}<div class="gallery-featured"><img id="galleryFeaturedImg" src="${esc(gallery[0]?.src)}" alt="${esc(gallery[0]?.alt || '')}"></div><div class="thumbs-slider-wrap"><button type="button" class="slider-nav slider-nav-prev" aria-label="이전 사진 보기">‹</button><div class="gallery-thumbs">${gallery.map((x, i) => `<button type="button" class="gallery-thumb${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="${i + 1}번째 사진 선택"><img src="${esc(x.src)}" alt="${esc(x.alt)}" loading="lazy"></button>`).join('')}</div><button type="button" class="slider-nav slider-nav-next" aria-label="다음 사진 보기">›</button></div></section>
<section class="section location reveal">${tag('p', 'section-label', location.label)}${tag('h2', '', location.title)}<div id="naverMap" class="map" role="img" aria-label="${esc(location.mapAlt || `${w.venue || '예식장'} 주변 지도`)}"><noscript><img class="map" src="${esc(location.mapImage)}" alt="${esc(location.mapAlt || `${w.venue || '예식장'} 주변 약도`)}"></noscript></div><div class="map-nav-buttons"><button type="button" class="map-nav-button" data-nav="naver"><img class="map-nav-icon" src="assets/icons/naver.png" alt="" loading="lazy"><span>네이버지도</span></button><button type="button" class="map-nav-button" data-nav="kakao"><img class="map-nav-icon" src="assets/icons/kakao.png" alt="" loading="lazy"><span>카카오맵</span></button><button type="button" class="map-nav-button" data-nav="tmap"><img class="map-nav-icon" src="assets/icons/tmap.png" alt="" loading="lazy"><span>티맵</span></button></div><p class="address">${esc(w.address)}</p><div class="transit">${(location.transit || []).map(x => `<p><b>${esc(x.label)}</b><span>${escLines(x.text)}</span></p>`).join('')}</div></section>
<section class="section accounts reveal">${tag('p', 'section-label', accounts.label)}${tag('h2', '', accounts.title)}<div class="account-list">${accountGroups.map((group, groupIndex) => `<details class="account-group"><summary><span>${esc(group.side)} 계좌번호</span></summary><div class="account-items"><div class="account-items-inner">${(group.accounts || []).map((account, accountIndex) => `<article class="account-item"><div><h3>${esc(account.holder)}</h3><p>${esc(account.bank)} <b>${esc(account.number)}</b></p></div><button class="copy-button" data-group="${groupIndex}" data-account="${accountIndex}" aria-label="${esc(account.relation)} 계좌번호 복사"><span class="copy-icon">⧉</span>복사</button></article>`).join('')}</div></div></details>`).join('')}</div></section>
<section class="section guestbook reveal">${tag('p', 'section-label', guestbook.label)}${tag('h2', '', guestbook.title)}<div class="guestbook-slider-wrap"><button type="button" class="slider-nav slider-nav-prev" aria-label="이전 방명록 보기">‹</button><div id="guestbookEntries" class="guestbook-entries" aria-live="polite" aria-label="방명록 목록"><p class="guestbook-state">방명록을 불러오는 중이에요.</p></div><button type="button" class="slider-nav slider-nav-next" aria-label="다음 방명록 보기">›</button></div><div class="guestbook-slider-actions"><button id="guestbookWrite" type="button">✏️작성하기</button><button id="guestbookAll" type="button">📖전체보기</button></div><form id="guestbookForm" class="guestbook-form" hidden><label>이름<input id="guestbookName" name="name" maxlength="20" autocomplete="name" required placeholder="이름을 입력해 주세요"></label><label>축하 메시지<textarea id="guestbookMessage" name="message" maxlength="300" required placeholder="두 분을 위한 축하의 마음을 남겨 주세요"></textarea></label><div class="guestbook-form-actions"><button id="guestbookCancel" class="guestbook-cancel" type="button">취소</button><button class="guestbook-submit" type="submit">남기기</button></div></form><dialog id="guestbookAllDialog" class="guestbook-all-dialog"><div class="guestbook-all-header"><h2>방명록 전체보기</h2><button id="guestbookAllClose" type="button" aria-label="전체보기 닫기">×</button></div><div id="guestbookAllEntries" class="guestbook-all-entries"></div></dialog></section>
<footer class="thanks reveal"><span>Thank you for celebrating with us</span><h2>${esc(c.groom)} <i>&amp;</i> ${esc(c.bride)}</h2><p>${esc(when.display)}</p></footer>`;
}
function setFeaturedImage(index) {
  if (!gallery.length) return;
  activeImage = (index + gallery.length) % gallery.length;
  const item = gallery[activeImage];
  const img = $('#galleryFeaturedImg');
  if (img) { img.src = item.src; img.alt = item.alt; }
  document.querySelectorAll('.gallery-thumb').forEach((t, i) => t.classList.toggle('active', i === activeImage));
}
function setupAccordion() {
  document.querySelectorAll('.account-group').forEach(details => {
    const summary = details.querySelector('summary');
    const content = details.querySelector('.account-items');
    if (!summary || !content) return;
    details.dataset.animating = 'false';

    summary.addEventListener('click', e => {
      e.preventDefault();
      if (details.dataset.animating === 'true') return;
      details.open ? closeGroup() : openGroup();
    });

    function openGroup() {
      details.open = true;
      details.classList.add('is-open');
    }

    function closeGroup() {
      details.classList.remove('is-open');
      details.dataset.animating = 'true';
      content.addEventListener('transitionend', function onEnd(e) {
        if (e.propertyName !== 'grid-template-rows') return;
        details.open = false;
        content.removeEventListener('transitionend', onEnd);
        details.dataset.animating = 'false';
      });
    }
  });
}

function renderGuestbookEntries(entries) {
  guestbookEntries = entries;
  const container = $('#guestbookEntries');
  if (!container) return;
  container.replaceChildren();
  entries.forEach(entry => {
    const item = document.createElement('article');
    item.className = 'guestbook-entry';
    const decoration = document.createElement('div');
    decoration.className = 'guestbook-note-decoration';
    decoration.innerHTML = '<span aria-hidden="true">✽</span>';
    const name = document.createElement('strong');
    name.textContent = `- ${entry.name} -`;
    const message = document.createElement('p');
    message.textContent = entry.message;
    item.append(decoration, message, name);
    container.append(item);
  });
  const compose = document.createElement('article');
  compose.className = 'guestbook-entry guestbook-compose-card';
  const composeButton = document.createElement('button');
  composeButton.type = 'button';
  composeButton.dataset.guestbookCompose = 'true';
  composeButton.textContent = '방명록 작성하기';
  composeButton.addEventListener('click', event => {
    event.stopPropagation();
    document.dispatchEvent(new Event('guestbook-compose'));
  });
  compose.append(composeButton);
  container.append(compose);
}

function setupGuestbook() {
  const form = $('#guestbookForm'), entries = $('#guestbookEntries');
  if (!form || !entries) return;
  const writeDialog = document.createElement('dialog');
  writeDialog.className = 'guestbook-all-dialog guestbook-write-dialog';
  const writeHeader = document.createElement('div');
  writeHeader.className = 'guestbook-all-header';
  writeHeader.innerHTML = '<h2>방명록 작성하기</h2><button type="button" aria-label="작성 창 닫기">×</button>';
  writeDialog.append(writeHeader, form);
  document.body.append(writeDialog);
  const openForm = () => {
    form.hidden = false;
    writeDialog.showModal();
    setTimeout(() => $('#guestbookName')?.focus(), 0);
  };
  const closeForm = () => {
    form.reset();
    form.hidden = true;
    writeDialog.close();
  };
  writeHeader.querySelector('button').addEventListener('click', closeForm);
  writeDialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeForm();
  });
  document.addEventListener('guestbook-compose', openForm);
  let dragStartX = 0, dragStartScroll = 0, dragging = false, suppressClick = false, composePointerPressed = false;
  entries.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    composePointerPressed = Boolean(event.target.closest('[data-guestbook-compose]'));
    dragStartX = event.clientX;
    dragStartScroll = entries.scrollLeft;
    dragging = false;
    entries.setPointerCapture(event.pointerId);
    entries.classList.add('is-dragging');
  });
  entries.addEventListener('pointermove', event => {
    if (!entries.hasPointerCapture(event.pointerId)) return;
    const distance = event.clientX - dragStartX;
    if (Math.abs(distance) > 4) dragging = true;
    entries.scrollLeft = dragStartScroll - distance;
  });
  const endDrag = event => {
    if (!entries.hasPointerCapture(event.pointerId)) return;
    entries.releasePointerCapture(event.pointerId);
    entries.classList.remove('is-dragging');
    if (composePointerPressed && !dragging) openForm();
    composePointerPressed = false;
    if (dragging) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
    }
  };
  entries.addEventListener('pointerup', endDrag);
  entries.addEventListener('pointercancel', endDrag);
  const showAll = () => {
    const container = $('#guestbookAllEntries');
    if (!container) return;
    container.replaceChildren();
    if (!guestbookEntries.length) {
      const empty = document.createElement('p');
      empty.className = 'guestbook-state';
      empty.textContent = '아직 작성된 방명록이 없습니다.';
      container.append(empty);
    }
    guestbookEntries.forEach(entry => {
      const item = document.createElement('article');
      item.className = 'guestbook-entry';
      const decoration = document.createElement('div');
      decoration.className = 'guestbook-note-decoration';
      decoration.innerHTML = '<span aria-hidden="true">✽</span>';
      const message = document.createElement('p');
      message.textContent = entry.message;
      const name = document.createElement('strong');
      name.textContent = `- ${entry.name} -`;
      item.append(decoration, message, name);
      container.append(item);
    });
    $('#guestbookAllDialog')?.showModal();
  };
  entries.addEventListener('click', event => {
    if (suppressClick) {
      event.preventDefault();
      return;
    }
    if (event.target.closest('[data-guestbook-compose]')) openForm();
  });
  $('#guestbookWrite')?.addEventListener('click', openForm);
  $('#guestbookAll')?.addEventListener('click', showAll);
  $('#guestbookAllClose')?.addEventListener('click', () => $('#guestbookAllDialog')?.close());
  if (!isFirebaseConfigured) {
    renderGuestbookEntries([]);
    entries.querySelector('[data-guestbook-compose]').disabled = true;
    entries.querySelector('[data-guestbook-compose]').textContent = '방명록 준비 중';
    return;
  }
  $('#guestbookCancel')?.addEventListener('click', () => {
    closeForm();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = $('#guestbookName').value.trim(), message = $('#guestbookMessage').value.trim();
    if (!name || !message) return;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await addGuestbookEntry({ name, message });
      closeForm();
      toast('축하 메시지를 남겼어요.');
    } catch (error) {
      console.error(error);
      toast('메시지를 남기지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally { submit.disabled = false; }
  });
  try {
    subscribeGuestbook(renderGuestbookEntries, error => {
      console.error(error);
      entries.innerHTML = '<p class="guestbook-state">방명록을 불러오지 못했어요.</p>';
    });
  } catch (error) {
    console.error(error);
  }
}

function setup(d) { applyTypography(d.typography); $('#app').innerHTML = page(d); document.title = `${d.couple?.groom || '신랑'} & ${d.couple?.bride || '신부'}의 결혼식 초대`; const observer = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -6%' }); document.querySelectorAll('.reveal').forEach((e, i) => { e.style.setProperty('--reveal-delay', `${Math.min(i % 3, 2) * 70}ms`); observer.observe(e); }); document.querySelectorAll('.gallery-thumb').forEach(b => b.addEventListener('click', () => setFeaturedImage(+b.dataset.index))); document.querySelectorAll('.copy-button').forEach(b => b.addEventListener('click', async () => { const item = d.accounts?.groups?.[+b.dataset.group]?.accounts?.[+b.dataset.account]; const text = item?.number; if (!text) return toast('복사할 계좌번호가 없습니다.'); try { if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text); else { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); } toast(`${item.holder || '계좌번호'} 계좌를 복사했어요.`); } catch { toast('복사하지 못했습니다. 다시 시도해 주세요.'); } })); document.querySelectorAll('.map-nav-button').forEach(b => b.addEventListener('click', () => openMapNav(b.dataset.nav, d.location, d.wedding?.venue))); setupGuestbook(); setupAccordion(); setupCountdown(); setupMap(d.location); setupAudio(d.music); blockImageZoom(); setupHeroSnow(); setupSlider('.thumbs-slider-wrap', '.gallery-thumbs'); setupSlider('.guestbook-slider-wrap', '.guestbook-entries'); }
let __countdownTimer = null;
function setupCountdown() {
  const el = $('#countdown');
  if (!el) return;
  const target = new Date(el.dataset.target).getTime();
  if (Number.isNaN(target)) return;
  const days = el.querySelector('[data-unit="days"]');
  const hours = el.querySelector('[data-unit="hours"]');
  const minutes = el.querySelector('[data-unit="minutes"]');
  const seconds = el.querySelector('[data-unit="seconds"]');
  const pad = n => String(n).padStart(2, '0');
  const tick = () => {
    const diff = target - Date.now();
    if (diff <= 0) {
      days.textContent = hours.textContent = minutes.textContent = seconds.textContent = '00';
      el.classList.add('countdown-done');
      clearInterval(__countdownTimer);
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    days.textContent = pad(d);
    hours.textContent = pad(h);
    minutes.textContent = pad(m);
    seconds.textContent = pad(s);
  };
  tick();
  clearInterval(__countdownTimer);
  __countdownTimer = setInterval(tick, 1000);
}

function setupMap(loc) {
  const el = $('#naverMap');
  if (!el) return;
  const lat = Number(loc?.lat), lng = Number(loc?.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return;
  if (!window.naver?.maps) {
    el.innerHTML = `<img class="map" src="${esc(loc?.mapImage || '')}" alt="${esc(el.getAttribute('aria-label') || '')}" loading="lazy">`;
    return;
  }
  const position = new naver.maps.LatLng(lat, lng);
  const map = new naver.maps.Map(el, {
    center: position,
    zoom: loc.zoom || 17,
    zoomControl: false,
    zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT }
  });
  new naver.maps.Marker({ position, map, title: loc.mapAlt || '' });
}

function openMapNav(service, loc, venueName) {
  const lat = Number(loc?.lat), lng = Number(loc?.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return toast('위치 정보가 없습니다.');
  const name = encodeURIComponent(venueName || '예식장');
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const appName = encodeURIComponent(location.hostname || 'wedding-card');
  const targets = {
    naver: {
      app: `nmap://route/public?dlat=${lat}&dlng=${lng}&dname=${name}&appname=${appName}`,
      store: isIOS ? 'https://apps.apple.com/kr/app/naver-map-navigation/id311867728' : 'https://play.google.com/store/apps/details?id=com.nhn.android.nmap',
      web: `https://map.naver.com/p/search/${name}`
    },
    kakao: {
      app: `kakaomap://route?ep=${lat},${lng}&en=${name}&by=publictransit`,
      store: isIOS ? 'https://apps.apple.com/kr/app/id304608425' : 'https://play.google.com/store/apps/details?id=net.daum.android.map',
      web: `https://map.kakao.com/link/to/${name},${lat},${lng}`
    },
    tmap: {
      // 티맵 딥링크(tmap://route)는 대중교통 이동수단 파라미터를 지원하지 않고 항상 자동차 길찾기로 열림(티맵 자체 제약).
      app: `tmap://route?goalname=${name}&goalx=${lng}&goaly=${lat}`,
      store: isIOS ? 'https://apps.apple.com/kr/app/id431589174' : 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku',
      web: null
    }
  };
  const target = targets[service];
  if (!target) return;
  if (!isIOS && !isAndroid) { window.open(target.web || target.store, '_blank', 'noopener'); return; }
  const fallback = target.web || target.store;
  // 앱이 실제로 열렸는지 확인하는 신호를 pagehide 하나에만 의존하면(특히 티맵에서) 앱 전환이 살짝 느릴 때
  // 타이머가 먼저 발동해 설치돼 있어도 스토어 팝업이 뜨는 오탐이 생김.
  // visibilitychange/blur까지 함께 감시하고 타임아웃도 살짝 늘려 오탐 가능성을 줄임.
  let cancelled = false;
  const cancel = () => { cancelled = true; clearTimeout(timer); };
  const timer = setTimeout(() => { if (!cancelled && !document.hidden) location.href = fallback; }, 2000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); }, { once: true });
  window.addEventListener('pagehide', cancel, { once: true });
  window.addEventListener('blur', cancel, { once: true });
  location.href = target.app;
}

function setupAudio(music) { const btn = $('#musicButton'); if (!music?.enabled || !music.src) { btn.hidden = true; return; } audio = new Audio(music.src); audio.loop = true; audio.volume = .35; const update = playing => { btn.textContent = playing ? 'Ⅱ' : '♪'; btn.setAttribute('aria-label', playing ? '배경 음악 일시 정지' : '배경 음악 재생'); btn.setAttribute('aria-pressed', playing); }; audio.addEventListener('play', () => update(true)); audio.addEventListener('pause', () => update(false)); audio.addEventListener('error', () => { btn.hidden = true; }); audio.play().catch(() => update(false)); btn.addEventListener('click', () => audio.paused ? audio.play().catch(() => toast('음악을 재생할 수 없습니다.')) : audio.pause()); }
$('#shareButton').addEventListener('click', async () => { const w = data?.wedding || {}, title = `${data?.couple?.groom || '신랑'} & ${data?.couple?.bride || '신부'}의 결혼식에 초대합니다`, text = `${weddingDate(w.date).display || ''}, 저희 결혼합니다.`; try { if (navigator.share) await navigator.share({ title, text, url: location.href }); else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(location.href); toast('청첩장 주소를 복사했어요.'); } else { prompt('아래 주소를 복사해 주세요.', location.href); } } catch (e) { if (e.name !== 'AbortError') toast('공유를 완료하지 못했습니다.'); } });

fetch('data/wedding.json').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(d => { data = d; setup(d); }).catch(() => $('#app').innerHTML = '<div class="loading">초대장 정보를 불러오지 못했습니다.</div>');

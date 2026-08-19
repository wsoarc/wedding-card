import { addGuestbookEntry, isFirebaseConfigured, subscribeGuestbook } from './firebase-guestbook.js';

// --- 확대(줌) 억제: 핀치줌(Safari gesture), 더블탭 줌, Ctrl+휠 줌 차단 ---
['gesturestart', 'gesturechange', 'gestureend'].forEach(evt =>
  document.addEventListener(evt, e => e.preventDefault())
);
document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
let __lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - __lastTouchEnd <= 300) e.preventDefault();
  __lastTouchEnd = now;
}, { passive: false });

// --- 문구별 폰트/크기 커스터마이징: wedding.json의 "typography" 값을 읽어 각 영역에 적용 ---
const TYPOGRAPHY_MAP = {
  hero: '.hero h1, .hero-names, .hero-names time, .hero-date, .hero-venue',
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
const weddingCalendar = when => { const year = Number(when.year), month = Number(when.month), eventDay = Number(when.day); if (!year || !month || !eventDay) return ''; const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate(); const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? '<span class="calendar-empty"></span>' : `<span class="calendar-day${index - firstWeekday + 1 === eventDay ? ' calendar-event' : ''}">${index - firstWeekday + 1}</span>`); return `<div class="calendar" aria-label="${when.display} 달력"><div class="calendar-weekdays"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div class="calendar-days">${cells.join('')}</div></div>`; };
// 모든 섹션 공통: label/title이 wedding.json에 없거나 빈 값이면 해당 태그 자체를 렌더링하지 않습니다.
// (하드코딩된 기본값으로 대체하지 않음 → invitation 섹션과 동일한 방식으로 통일)
const tag = (tagName, className, value) => value ? `<${tagName}${className ? ` class="${className}"` : ''}>${esc(value)}</${tagName}>` : '';
function page(d) {
  const w = d.wedding || {}, c = d.couple || {}, invitation = d.invitation || {}, when = weddingDate(w.date); gallery = d.gallery?.images || [];
  const accountGroups = d.accounts?.groups || [];
  const weddingDay = d.weddingDay || {}, galleryData = d.gallery || {}, location = d.location || {}, accounts = d.accounts || {}, guestbook = d.guestbook || {};
  return `
<header class="hero"><div class="hero-frame"><div class="hero-illustration"><img src="${esc(d.hero?.image)}" alt="${esc(d.hero?.alt)}" onerror="this.parentElement.classList.add('image-error')"></div><div class="hero-copy"><div class="hero-names"><span>${esc(c.groom)}</span><time><b>${esc(when.month)}</b><i></i><b>${esc(when.day)}</b></time><span>${esc(c.bride)}</span></div><p class="hero-date">${esc(when.year)}.${esc(when.month)}.${esc(when.day)} ${esc(when.weekday).slice(0, 1).toUpperCase()}. ${esc(when.time)}</p><p class="hero-venue">${esc(w.venue)} ${esc(w.hall)}</p></div></div></header>
<section class="section invitation reveal">${tag('p', 'section-label', invitation.label)}${tag('h2', '', invitation.title)}<div class="prose">${(invitation.paragraphs || []).map(p => `<p>${esc(p)}</p>`).join('')}</div><hr class="invitation-divider"><p class="invitation-parents"><span>${parentsLine(c.groomParents, c.groom)}</span><span>${parentsLine(c.brideParents, c.bride)}</span></p></section>
<section class="section info reveal">${tag('p', 'section-label', weddingDay.label)}<h2>${esc(when.display)}<br><span class="wedding-day-time">${esc(when.weekday)} ${esc(when.time)}</span></h2>${weddingCalendar(when)}<div class="countdown" id="countdown" data-target="${esc(w.date)}"><div class="countdown-unit"><span class="countdown-value" data-unit="days">00</span><small>DAYS</small></div><div class="countdown-sep">:</div><div class="countdown-unit"><span class="countdown-value" data-unit="hours">00</span><small>HRS</small></div><div class="countdown-sep">:</div><div class="countdown-unit"><span class="countdown-value" data-unit="minutes">00</span><small>MIN</small></div><div class="countdown-sep">:</div><div class="countdown-unit"><span class="countdown-value" data-unit="seconds">00</span><small>SEC</small></div></div><strong class="dday">${ddaySentence(w.date, c.groom, c.bride)}</strong></section>
<section class="section gallery-section reveal">${tag('p', 'section-label', galleryData.label)}${tag('h2', '', galleryData.title)}<div class="gallery-featured"><img id="galleryFeaturedImg" src="${esc(gallery[0]?.src)}" alt="${esc(gallery[0]?.alt || '')}"></div><div class="gallery-thumbs">${gallery.map((x, i) => `<button type="button" class="gallery-thumb${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="${i + 1}번째 사진 선택"><img src="${esc(x.src)}" alt="${esc(x.alt)}" loading="lazy"></button>`).join('')}</div></section>
<section class="section location reveal">${tag('p', 'section-label', location.label)}${tag('h2', '', location.title)}<div id="naverMap" class="map" role="img" aria-label="${esc(location.mapAlt || `${w.venue || '예식장'} 주변 지도`)}"><noscript><img class="map" src="${esc(location.mapImage)}" alt="${esc(location.mapAlt || `${w.venue || '예식장'} 주변 약도`)}"></noscript></div><div class="map-nav-buttons"><button type="button" class="map-nav-button" data-nav="naver"><img class="map-nav-icon" src="assets/icons/naver.png" alt="" loading="lazy"><span>네이버지도</span></button><button type="button" class="map-nav-button" data-nav="kakao"><img class="map-nav-icon" src="assets/icons/kakao.png" alt="" loading="lazy"><span>카카오맵</span></button><button type="button" class="map-nav-button" data-nav="tmap"><img class="map-nav-icon" src="assets/icons/tmap.png" alt="" loading="lazy"><span>티맵</span></button></div><p class="address">${esc(w.address)}</p><div class="transit">${(location.transit || []).map(x => `<p><b>${esc(x.label)}</b><span>${escLines(x.text)}</span></p>`).join('')}</div></section>
<section class="section accounts reveal">${tag('p', 'section-label', accounts.label)}${tag('h2', '', accounts.title)}<div class="account-list">${accountGroups.map((group, groupIndex) => `<details class="account-group"><summary><span>${esc(group.side)} 계좌번호</span></summary><div class="account-items"><div class="account-items-inner">${(group.accounts || []).map((account, accountIndex) => `<article class="account-item"><div><h3>${esc(account.holder)}</h3><p>${esc(account.bank)} <b>${esc(account.number)}</b></p></div><button class="copy-button" data-group="${groupIndex}" data-account="${accountIndex}" aria-label="${esc(account.relation)} 계좌번호 복사"><span class="copy-icon">⧉</span>복사</button></article>`).join('')}</div></div></details>`).join('')}</div></section>
<section class="section guestbook reveal">${tag('p', 'section-label', guestbook.label)}${tag('h2', '', guestbook.title)}<div class="guestbook-slider-wrap"><div id="guestbookEntries" class="guestbook-entries" aria-live="polite" aria-label="방명록 목록"><p class="guestbook-state">방명록을 불러오는 중이에요.</p></div></div><div class="guestbook-slider-actions"><button id="guestbookWrite" type="button">✏️작성하기</button><button id="guestbookAll" type="button">📖전체보기</button></div><form id="guestbookForm" class="guestbook-form" hidden><label>이름<input id="guestbookName" name="name" maxlength="20" autocomplete="name" required placeholder="이름을 입력해 주세요"></label><label>축하 메시지<textarea id="guestbookMessage" name="message" maxlength="300" required placeholder="두 분을 위한 축하의 마음을 남겨 주세요"></textarea></label><div class="guestbook-form-actions"><button id="guestbookCancel" class="guestbook-cancel" type="button">취소</button><button class="guestbook-submit" type="submit">남기기</button></div></form><dialog id="guestbookAllDialog" class="guestbook-all-dialog"><div class="guestbook-all-header"><h2>방명록 전체보기</h2><button id="guestbookAllClose" type="button" aria-label="전체보기 닫기">×</button></div><div id="guestbookAllEntries" class="guestbook-all-entries"></div></dialog></section>
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

function setup(d) { applyTypography(d.typography); $('#app').innerHTML = page(d); document.title = `${d.couple?.groom || '신랑'} & ${d.couple?.bride || '신부'}의 결혼식 초대`; const observer = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -6%' }); document.querySelectorAll('.reveal').forEach((e, i) => { e.style.setProperty('--reveal-delay', `${Math.min(i % 3, 2) * 70}ms`); observer.observe(e); }); document.querySelectorAll('.gallery-thumb').forEach(b => b.addEventListener('click', () => setFeaturedImage(+b.dataset.index))); document.querySelectorAll('.copy-button').forEach(b => b.addEventListener('click', async () => { const item = d.accounts?.groups?.[+b.dataset.group]?.accounts?.[+b.dataset.account]; const text = item?.number; if (!text) return toast('복사할 계좌번호가 없습니다.'); try { if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text); else { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); } toast(`${item.holder || '계좌번호'} 계좌를 복사했어요.`); } catch { toast('복사하지 못했습니다. 다시 시도해 주세요.'); } })); document.querySelectorAll('.map-nav-button').forEach(b => b.addEventListener('click', () => openMapNav(b.dataset.nav, d.location, d.wedding?.venue))); setupGuestbook(); setupAccordion(); setupCountdown(); setupMap(d.location); setupAudio(d.music); }
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
      app: `kakaomap://route?ep=${lat},${lng}&by=CAR`,
      store: isIOS ? 'https://apps.apple.com/kr/app/id304608425' : 'https://play.google.com/store/apps/details?id=net.daum.android.map',
      web: `https://map.kakao.com/link/to/${name},${lat},${lng}`
    },
    tmap: {
      app: `tmap://route?goalname=${name}&goalx=${lng}&goaly=${lat}`,
      store: isIOS ? 'https://apps.apple.com/kr/app/id431589174' : 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku',
      web: null
    }
  };
  const target = targets[service];
  if (!target) return;
  if (!isIOS && !isAndroid) { window.open(target.web || target.store, '_blank', 'noopener'); return; }
  const fallback = target.web || target.store;
  const timer = setTimeout(() => { if (!document.hidden) location.href = fallback; }, 1500);
  window.addEventListener('pagehide', () => clearTimeout(timer), { once: true });
  location.href = target.app;
}

function setupAudio(music) { const btn = $('#musicButton'); if (!music?.enabled || !music.src) { btn.hidden = true; return; } audio = new Audio(music.src); audio.loop = true; audio.volume = .35; const update = playing => { btn.textContent = playing ? 'Ⅱ' : '♪'; btn.setAttribute('aria-label', playing ? '배경 음악 일시 정지' : '배경 음악 재생'); btn.setAttribute('aria-pressed', playing); }; audio.addEventListener('play', () => update(true)); audio.addEventListener('pause', () => update(false)); audio.addEventListener('error', () => { btn.hidden = true; }); audio.play().catch(() => update(false)); btn.addEventListener('click', () => audio.paused ? audio.play().catch(() => toast('음악을 재생할 수 없습니다.')) : audio.pause()); }
$('#shareButton').addEventListener('click', async () => { const w = data?.wedding || {}, title = `${data?.couple?.groom || '신랑'} & ${data?.couple?.bride || '신부'}의 결혼식에 초대합니다`, text = `${weddingDate(w.date).display || ''}, 저희 결혼합니다.`; try { if (navigator.share) await navigator.share({ title, text, url: location.href }); else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(location.href); toast('청첩장 주소를 복사했어요.'); } else { prompt('아래 주소를 복사해 주세요.', location.href); } } catch (e) { if (e.name !== 'AbortError') toast('공유를 완료하지 못했습니다.'); } });

fetch('data/wedding.json').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(d => { data = d; setup(d); }).catch(() => $('#app').innerHTML = '<div class="loading">초대장 정보를 불러오지 못했습니다.</div>');

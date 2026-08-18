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

const $ = (s, p = document) => p.querySelector(s);
const esc = (value = '') => String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
let data, gallery = [], activeImage = 0, audio, touchX = 0;
const toast = message => { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2200); };
const ddaySentence = (iso, groom, bride) => { const wedding = new Date(iso); if (Number.isNaN(wedding)) return ''; const now = new Date(); const inKorea = d => new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })); const a = inKorea(now); const b = inKorea(wedding); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0); const days = Math.round((b - a) / 86400000); const names = `${esc(groom)} <i>&amp;</i> ${esc(bride)}`; if (days === 0) return `오늘은 ${names}의 <b class="dday-count">결혼식</b>이에요`; if (days > 0) return `${names}의 결혼식까지 <b class="dday-count">${days}일</b> 남았어요`; return `${names}가 결혼한 지 <b class="dday-count">${Math.abs(days)}일</b> 되었어요`; };
const weddingDate = iso => { const value = new Date(iso); if (Number.isNaN(value)) return { year: '', month: '', day: '', display: '', weekday: '', time: '' }; const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(value).filter(p => p.type !== 'literal').map(p => [p.type, p.value])); const weekday = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'long' }).format(value); const hour = Number(values.hour); const minute = Number(values.minute); const time = `${values.dayPeriod === 'PM' ? '오후' : '오전'} ${hour}시${minute ? ` ${minute}분` : ''}`; return { year: values.year, month: values.month, day: values.day, display: `${values.year}년 ${Number(values.month)}월 ${Number(values.day)}일`, weekday, time }; };
const weddingCalendar = when => { const year = Number(when.year), month = Number(when.month), eventDay = Number(when.day); if (!year || !month || !eventDay) return ''; const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate(); const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? '<span class="calendar-empty"></span>' : `<span class="calendar-day${index - firstWeekday + 1 === eventDay ? ' calendar-event' : ''}">${index - firstWeekday + 1}</span>`); return `<div class="calendar" aria-label="${when.display} 달력"><p class="calendar-month">${year}. ${String(month).padStart(2, '0')}</p><div class="calendar-weekdays"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div class="calendar-days">${cells.join('')}</div></div>`; };
function page(d) {
  const w = d.wedding || {}, c = d.couple || {}, invitation = d.invitation || {}, when = weddingDate(w.date); gallery = d.gallery || []; return `
<header class="hero"><div class="hero-frame"><div class="hero-illustration"><img src="${esc(d.hero?.image)}" alt="${esc(d.hero?.alt)}" onerror="this.parentElement.classList.add('image-error')"></div><div class="hero-copy"><div class="hero-names"><span>${esc(c.groom)}</span><time><b>${esc(when.month)}</b><i></i><b>${esc(when.day)}</b></time><span>${esc(c.bride)}</span></div><p class="hero-date">${esc(when.year)}.${esc(when.month)}.${esc(when.day)} ${esc(when.weekday).slice(0, 1).toUpperCase()}. ${esc(when.time)}</p><p class="hero-venue">${esc(w.venue)} ${esc(w.hall)}</p></div></div></header>
<section class="section invitation reveal"><p class="section-label">${esc(invitation.label)}</p><h2>${esc(invitation.title)}</h2><div class="prose">${(invitation.paragraphs || []).map(p => `<p>${esc(p)}</p>`).join('')}</div></section>
<section class="section story reveal"><p class="section-label">OUR STORY</p><h2>우리의 시간</h2><ol class="timeline">${(d.story || []).map(x => `<li><time>${esc(x.year)}</time><div><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p></div></li>`).join('')}</ol></section>
<section class="section gallery-section reveal"><p class="section-label">GALLERY</p><h2>우리의 순간</h2><div class="gallery">${gallery.map((x, i) => `<button class="gallery-item" data-index="${i}" aria-label="${i + 1}번째 사진 크게 보기"><img src="${esc(x.src)}" alt="${esc(x.alt)}" loading="lazy"></button>`).join('')}</div></section>
<section class="section info reveal"><p class="section-label">WEDDING DAY</p><h2>${esc(when.display)}<br>${esc(when.weekday)} ${esc(when.time)}</h2>${weddingCalendar(when)}<strong class="dday">${ddaySentence(w.date, c.groom, c.bride)}</strong><div class="countdown" id="countdown" data-target="${esc(w.date)}"><div class="countdown-unit"><span class="countdown-value" data-unit="days">00</span><small>DAYS</small></div><div class="countdown-sep">:</div><div class="countdown-unit"><span class="countdown-value" data-unit="hours">00</span><small>HRS</small></div><div class="countdown-sep">:</div><div class="countdown-unit"><span class="countdown-value" data-unit="minutes">00</span><small>MIN</small></div><div class="countdown-sep">:</div><div class="countdown-unit"><span class="countdown-value" data-unit="seconds">00</span><small>SEC</small></div></div></section>
<section class="section location reveal"><p class="section-label">LOCATION</p><h2>오시는 길</h2><div id="naverMap" class="map" role="img" aria-label="${esc(d.location?.mapAlt || `${w.venue || '예식장'} 주변 지도`)}"><noscript><img class="map" src="${esc(d.location?.mapImage)}" alt="${esc(d.location?.mapAlt || `${w.venue || '예식장'} 주변 약도`)}"></noscript></div><div class="map-nav-buttons"><button type="button" class="map-nav-button" data-nav="naver"><img class="map-nav-icon" src="assets/icons/naver.png" alt="" loading="lazy"><span>네이버지도</span></button><button type="button" class="map-nav-button" data-nav="kakao"><img class="map-nav-icon" src="assets/icons/kakao.png" alt="" loading="lazy"><span>카카오맵</span></button><button type="button" class="map-nav-button" data-nav="tmap"><img class="map-nav-icon" src="assets/icons/tmap.png" alt="" loading="lazy"><span>티맵</span></button></div><p class="address">${esc(w.address)}</p><div class="transit">${(d.location?.transit || []).map(x => `<p><b>${esc(x.label)}</b><span>${esc(x.text)}</span></p>`).join('')}</div></section>
<section class="section accounts reveal"><p class="section-label">WITH LOVE</p><h2>마음 전하실 곳</h2><div class="account-list">${(d.accounts || []).map((group, groupIndex) => `<details class="account-group"><summary><span>${esc(group.side)} 계좌번호</span></summary><div class="account-items"><div class="account-items-inner">${(group.accounts || []).map((account, accountIndex) => `<article class="account-item"><div><h3>${esc(account.holder)}</h3><p>${esc(account.bank)} <b>${esc(account.number)}</b></p></div><button class="copy-button" data-group="${groupIndex}" data-account="${accountIndex}" aria-label="${esc(account.relation)} 계좌번호 복사"><span class="copy-icon">⧉</span>복사</button></article>`).join('')}</div></div></details>`).join('')}</div></section>
<section class="section guestbook reveal"><p class="section-label">GUESTBOOK</p><h2>축하의 마음을<br>남겨주세요</h2><p>정성스러운 마음으로 준비 중인 공간입니다.</p><button id="guestbookButton" class="outline-button">축하 메시지 남기기</button></section>
<footer class="thanks reveal"><span>Thank you for celebrating with us</span><h2>${esc(c.groom)} <i>&amp;</i> ${esc(c.bride)}</h2><p>${esc(when.display)}</p></footer>`;
}
function openLightbox(index) { if (!gallery.length) return; activeImage = (index + gallery.length) % gallery.length; const item = gallery[activeImage]; $('#lightboxImage').src = item.src; $('#lightboxImage').alt = item.alt; $('#lightboxCount').textContent = `${activeImage + 1} / ${gallery.length}`; $('#lightbox').classList.add('open'); $('#lightbox').setAttribute('aria-hidden', 'false'); document.body.classList.add('locked'); $('.lightbox-close').focus(); }
function closeLightbox() { $('#lightbox').classList.remove('open'); $('#lightbox').setAttribute('aria-hidden', 'true'); document.body.classList.remove('locked'); }
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

function setup(d) { $('#app').innerHTML = page(d); document.title = `${d.couple?.groom || '신랑'} & ${d.couple?.bride || '신부'}의 결혼식 초대`; const observer = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -6%' }); document.querySelectorAll('.reveal').forEach((e, i) => { e.style.setProperty('--reveal-delay', `${Math.min(i % 3, 2) * 70}ms`); observer.observe(e); }); document.querySelectorAll('.gallery-item').forEach(b => b.addEventListener('click', () => openLightbox(+b.dataset.index))); document.querySelectorAll('.copy-button').forEach(b => b.addEventListener('click', async () => { const item = d.accounts?.[+b.dataset.group]?.accounts?.[+b.dataset.account]; const text = item?.number; if (!text) return toast('복사할 계좌번호가 없습니다.'); try { if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text); else { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); } toast(`${item.holder || '계좌번호'} 계좌를 복사했어요.`); } catch { toast('복사하지 못했습니다. 다시 시도해 주세요.'); } })); $('#guestbookButton').addEventListener('click', () => toast('방명록은 따뜻하게 준비 중이에요.')); document.querySelectorAll('.map-nav-button').forEach(b => b.addEventListener('click', () => openMapNav(b.dataset.nav, d.location, d.wedding?.venue))); setupAccordion(); setupCountdown(); setupMap(d.location); setupAudio(d.music); }
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
$('.lightbox-close').addEventListener('click', closeLightbox); $('.lightbox-prev').addEventListener('click', () => openLightbox(activeImage - 1)); $('.lightbox-next').addEventListener('click', () => openLightbox(activeImage + 1)); $('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeLightbox() }); document.addEventListener('keydown', e => { if (!$('#lightbox').classList.contains('open')) return; if (e.key === 'Escape') closeLightbox(); if (e.key === 'ArrowLeft') openLightbox(activeImage - 1); if (e.key === 'ArrowRight') openLightbox(activeImage + 1); }); $('#lightbox').addEventListener('touchstart', e => touchX = e.changedTouches[0].screenX, { passive: true }); $('#lightbox').addEventListener('touchend', e => { const dx = e.changedTouches[0].screenX - touchX; if (Math.abs(dx) > 45) openLightbox(activeImage + (dx > 0 ? -1 : 1)); }, { passive: true });
fetch('data/wedding.json').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(d => { data = d; setup(d); }).catch(() => $('#app').innerHTML = '<div class="loading">초대장 정보를 불러오지 못했습니다.</div>');

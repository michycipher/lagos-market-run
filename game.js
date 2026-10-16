const START_NG = 'https://start.ng';
const API = 'https://api.start.ng';
const GAME_NAME = location.hostname.endsWith('.start.ng') ? location.hostname.split('.')[0] : 'lagos-market-dash';

const MARKET_STAGES = [
  { name:'Balogun Market', short:'Balogun', sign:'FABRICS · LAGOS ISLAND', left:'ANKARA', right:'LACE', sky:'#173243', glow:'#e85d45' },
  { name:'Mushin Market', short:'Mushin', sign:'AUTO PARTS · MUSHIN', left:'SPARES', right:'TOKUNBO', sky:'#3f2b35', glow:'#ff8b3d' },
  { name:'Yaba Market', short:'Yaba', sign:'TECH · YABA', left:'PHONES', right:'TEJUOSHO', sky:'#183a42', glow:'#31b78c' },
  { name:'Tejuosho Market', short:'Tejuosho', sign:'FASHION · YABA', left:'KICKS', right:'TEXTILES', sky:'#33304a', glow:'#ffb454' },
  { name:'Oyingbo Market', short:'Oyingbo', sign:'FOODSTUFF · EBUTE METTA', left:'PEPPER', right:'YAM', sky:'#3f3329', glow:'#e85d45' },
  { name:'Oshodi Market', short:'Oshodi', sign:'THE BUS STOP MARKET', left:'BAGS', right:'SNEAKERS', sky:'#34302a', glow:'#d8fd71' },
  { name:'Mile 12 Market', short:'Mile 12', sign:'FRESH PRODUCE · KETU', left:'TOMATO', right:'PLANTAIN', sky:'#30422f', glow:'#ffb454' },
  { name:'Computer Village', short:'Computer Village', sign:'GADGETS · IKEJA', left:'IPHONE', right:'REPAIR', sky:'#20384c', glow:'#55c7ff' },
  { name:'Ladipo Market', short:'Ladipo', sign:'MOTOR PARTS · MUSHIN', left:'TOYOTA', right:'ENGINES', sky:'#433129', glow:'#e85d45' },
  { name:'Alaba International', short:'Alaba', sign:'ELECTRONICS · OJO', left:'TVS', right:'SOLAR', sky:'#243b45', glow:'#31b78c' },
  { name:'Idumota Market', short:'Idumota', sign:'WHOLESALE · LAGOS ISLAND', left:'SHOES', right:'CLOTHES', sky:'#3e2e42', glow:'#ff6b95' },
  { name:'Jankara Market', short:'Jankara', sign:'HERBS · LAGOS ISLAND', left:'ADIRE', right:'SPICES', sky:'#3c3424', glow:'#d8fd71' },
  { name:'Epe Fish Market', short:'Epe Fish', sign:'SEAFOOD · EPE', left:'FISH', right:'CRABS', sky:'#1b3d4e', glow:'#55c7ff' },
  { name:'Ajah Market', short:'Ajah', sign:'COASTAL MARKET · AJAH', left:'FRUIT', right:'BASKETS', sky:'#3d2d35', glow:'#ffb454' },
  { name:'Ikotun Market', short:'Ikotun', sign:'NORTH LAGOS · IKOTUN', left:'PROVISIONS', right:'KIOSK', sky:'#293b31', glow:'#31b78c' },
  { name:'Igando Market', short:'Igando', sign:'COMMUNITY MARKET · IGANDO', left:'GRAINS', right:'CLOTH', sky:'#403229', glow:'#e85d45' },
  { name:'Lekki Market', short:'Lekki', sign:'ARTS · CRAFTS · LEKKI', left:'BEADS', right:'WOODWORK', sky:'#1c3b42', glow:'#d8fd71' },
  { name:'Agbalata Market', short:'Agbalata', sign:'BADAGRY MARKET', left:'SEAFOOD', right:'BASKETS', sky:'#3c2d2a', glow:'#ff8b3d' },
  { name:'Sangotedo Market', short:'Sangotedo', sign:'LAST STOP · SANGOTEDO', left:'SUYA', right:'MAMA PUT', sky:'#26333d', glow:'#ffb454' }
];

let connectFramePromise;
let currentIdentity = null;
let soundOn = true;
let audioContext;

function connectFrame() {
  connectFramePromise ??= new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.src = `${START_NG}/connect`;
    frame.hidden = true;
    frame.onload = () => resolve(frame);
    frame.onerror = reject;
    document.body.append(frame);
  });
  return connectFramePromise;
}

async function askStartNg(message, replyType, timeoutMs = 1600) {
  try {
    const frame = await connectFrame();
    return await new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2);
      const finish = (reply) => { clearTimeout(timer); removeEventListener('message', onMessage); resolve(reply); };
      const timer = setTimeout(() => finish(null), timeoutMs);
      function onMessage(event) {
        if (event.origin !== START_NG || event.source !== frame.contentWindow) return;
        if (event.data?.type === replyType && event.data.requestId === requestId) finish(event.data);
      }
      addEventListener('message', onMessage);
      frame.contentWindow.postMessage({ ...message, requestId }, START_NG);
    });
  } catch { return null; }
}

const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const laneX = [315, 480, 645];
const playerY = 425;
const state = { screen:'ready', lane:1, targetLane:1, distance:0, lanterns:0, speed:260, elapsed:0, objects:[], lastTime:0, best:Number(localStorage.getItem('neon-market-best') || 0), spawnTimer:0, shake:0, marketIndex:0, stageBannerTimer:0 };

const $ = (selector) => document.querySelector(selector);
const distanceValue = $('#distance-value');
const lanternValue = $('#lantern-value');
const bestValue = $('#best-value');
const stageValue = $('#stage-value');
const runStatus = $('#run-status');
const titleOverlay = $('#title-overlay');
const gameoverOverlay = $('#gameover-overlay');
const pauseBadge = $('#pause-badge');
const stageBanner = $('#stage-banner');
const stageName = $('#stage-name');
const marketRoute = $('#market-route');

function stageForDistance(distance) {
  return Math.min(MARKET_STAGES.length - 1, Math.floor(distance / 250));
}

function currentMarket() {
  return MARKET_STAGES[state.marketIndex] || MARKET_STAGES[0];
}

function renderMarketRoute() {
  marketRoute.replaceChildren(...MARKET_STAGES.map((market, index) => {
    const item = document.createElement('li');
    item.textContent = market.name;
    item.dataset.stage = String(index);
    return item;
  }));
}

function updateMarketStage(force = false) {
  const nextIndex = stageForDistance(state.distance);
  if (!force && nextIndex === state.marketIndex) return;
  state.marketIndex = nextIndex;
  const market = currentMarket();
  stageValue.textContent = market.short;
  stageName.textContent = market.name;
  stageBanner.classList.remove('hidden');
  state.stageBannerTimer = force ? 1.2 : 2.2;
  document.querySelectorAll('.market-route li').forEach((item) => item.classList.toggle('current', Number(item.dataset.stage) === state.marketIndex));
}

function fallbackFace() {
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="#252d49"/><circle cx="50" cy="42" r="20" fill="#d99572"/><path d="M29 39c4-25 40-30 47-2-13-9-33-7-47 2Z" fill="#292039"/><path d="M35 69c6-9 24-9 30 0" fill="none" stroke="#ffb454" stroke-width="5" stroke-linecap="round"/></svg>`);
}

function updateIdentity(reply) {
  const player = reply?.user ?? reply?.guest;
  currentIdentity = { ...player, signedIn: Boolean(reply?.user) };
  $('#player-face').src = player?.face || fallbackFace();
  $('#player-name').textContent = player?.name || 'Guest';
  $('#player-account').textContent = reply?.user?.account ? `@${reply.user.account}` : 'Play as guest';
  $('#sign-in-button').hidden = Boolean(reply?.user);
}

async function loadIdentity() {
  const reply = await askStartNg({ type:'startng:whoami' }, 'startng:user');
  updateIdentity(reply || { guest:{ name:'Guest', style:{} } });
}

function signIn() {
  const returnTo = `${location.origin}${location.pathname}`;
  location.href = `${START_NG}/?return_to=${encodeURIComponent(returnTo)}`;
}

function setupAudio() {
  if (!soundOn) return;
  audioContext ??= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine'; oscillator.frequency.value = 420;
  gain.gain.setValueAtTime(.045, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .09);
  oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + .1);
}

function move(direction) {
  if (state.screen !== 'playing') return;
  state.targetLane = Math.max(0, Math.min(2, state.targetLane + direction));
  setupAudio();
}

function pauseToggle() {
  if (state.screen === 'playing') { state.screen = 'paused'; pauseBadge.classList.remove('hidden'); runStatus.textContent = 'Paused'; }
  else if (state.screen === 'paused') { state.screen = 'playing'; pauseBadge.classList.add('hidden'); runStatus.textContent = 'Dodging the rush'; state.lastTime = performance.now(); canvas.focus(); }
}

function startRun() {
  state.screen = 'playing'; state.lane = 1; state.targetLane = 1; state.distance = 0; state.lanterns = 0; state.speed = 260; state.elapsed = 0; state.objects = []; state.spawnTimer = .35; state.lastTime = performance.now(); state.marketIndex = 0;
  updateMarketStage(true);
  titleOverlay.classList.add('hidden'); gameoverOverlay.classList.add('hidden'); pauseBadge.classList.add('hidden'); runStatus.textContent = 'Dodging the rush'; canvas.focus(); setupAudio();
}

function endRun() {
  state.screen = 'gameover'; state.shake = .2;
  const distance = Math.floor(state.distance);
  if (distance > state.best) { state.best = distance; localStorage.setItem('neon-market-best', String(distance)); }
  $('#final-distance').textContent = `${distance}m`; $('#final-lanterns').textContent = String(state.lanterns);
  $('#gameover-title').textContent = distance > 700 ? 'That was a legendary shift.' : 'The market wins this round.';
  $('#save-message').textContent = currentIdentity?.signedIn ? 'Sending your best run to the start.ng board…' : 'Your best run is saved locally. Sign in to enter the global board.';
  gameoverOverlay.classList.remove('hidden'); runStatus.textContent = 'Run complete'; setupAudio();
  saveScore(distance, state.lanterns);
  loadLeaderboard();
}

async function saveScore(distance, lanterns) {
  const saved = await askStartNg({ type:'startng:score', stats:{ distance, lanterns } }, 'startng:scoreSaved');
  if (saved?.ok) $('#save-message').textContent = saved.result?.improved ? `New best! You are #${saved.result.rank}.` : `Run logged. Your board rank is #${saved.result.rank}.`;
}

async function loadLeaderboard() {
  const list = $('#leaderboard-list');
  let entries = [];
  try {
    const response = await fetch(`${API}/games/${GAME_NAME}/leaderboard?limit=5`);
    if (response.ok) entries = await response.json();
  } catch { /* Local play still works when the board is unavailable. */ }
  if (!entries.length) { list.innerHTML = '<li class="board-empty">No global runs yet — make the first one.</li>'; return; }
  list.replaceChildren(...entries.map((entry) => {
    const item = document.createElement('li');
    item.innerHTML = `<span class="rank">#${entry.rank}</span><span class="board-name">${escapeHtml(entry.name)}</span><span class="board-score">${entry.stats?.distance ?? entry.score ?? 0}m</span>`;
    return item;
  }));
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character])); }

function spawnObject() {
  const lane = Math.floor(Math.random() * 3);
  const roll = Math.random();
  const kind = roll < .34 ? 'suya' : roll < .57 ? 'danfo' : roll < .77 ? 'eyo' : 'handcart';
  state.objects.push({ lane, y:205, kind, wobble:Math.random() * Math.PI * 2, speedMultiplier:.94 + Math.random() * .14 });
}

function update(delta) {
  if (state.screen !== 'playing') return;
  state.elapsed += delta; state.distance += state.speed * delta * .12; state.speed = Math.min(620, 260 + state.distance * .19 + state.marketIndex * 9);
  updateMarketStage();
  if (state.stageBannerTimer > 0) { state.stageBannerTimer -= delta; if (state.stageBannerTimer <= 0) stageBanner.classList.add('hidden'); }
  state.spawnTimer -= delta;
  if (state.spawnTimer <= 0) { spawnObject(); state.spawnTimer = Math.max(.3, .82 - state.distance / 5000 - state.marketIndex * .018) + Math.random() * .2; }
  state.lane += (state.targetLane - state.lane) * Math.min(1, delta * 12);
  for (const object of state.objects) { object.y += state.speed * delta * object.speedMultiplier; object.wobble += delta * 5; }
  for (let index = state.objects.length - 1; index >= 0; index -= 1) {
    const object = state.objects[index];
    const closeEnough = object.y > playerY - 42 && object.y < playerY + 34 && Math.abs(object.lane - state.lane) < .42;
    if (closeEnough) { if (object.kind === 'suya') { state.lanterns += 1; state.objects.splice(index,1); setupAudio(); } else { endRun(); return; } }
    else if (object.y > H + 60) state.objects.splice(index,1);
  }
  distanceValue.textContent = `${Math.floor(state.distance)}m`; lanternValue.textContent = String(state.lanterns); bestValue.textContent = `${Math.max(state.best, Math.floor(state.distance))}m`;
}

function roundRect(x,y,w,h,r,fill,stroke) { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); if (fill) { ctx.fillStyle=fill; ctx.fill(); } if (stroke) { ctx.strokeStyle=stroke; ctx.stroke(); } }
function roadLaneX(lane, y) {
  const progress = Math.max(0, Math.min(1, (y - 201) / (H - 201)));
  const horizon = [456, 480, 504][lane];
  const foreground = laneX[lane];
  return horizon + (foreground - horizon) * progress;
}
function roadScale(y) { return .38 + Math.max(0, Math.min(1, (y - 201) / (H - 201))) * .9; }

function drawBackground() {
  const market = currentMarket();
  const sky = ctx.createLinearGradient(0,0,0,H); sky.addColorStop(0,market.sky); sky.addColorStop(.48,'#63402f'); sky.addColorStop(1,'#101a1c'); ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,212,133,.92)'; ctx.beginPath(); ctx.arc(770,88,31,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(13,25,31,.72)'; ctx.fillRect(0,173,W,4);
  for (let i=0;i<12;i+=1) { const x=18+i*86; const height=38+(i%4)*20; ctx.fillStyle=i%2?'#1c3841':'#20333b'; ctx.fillRect(x,173-height,66,height); ctx.fillStyle=i%3?'#ffd27d':'#d8fd71'; ctx.globalAlpha=.7; for(let window=0;window<3;window+=1) ctx.fillRect(x+10+window*18,185-height,8,11); ctx.globalAlpha=1; }
  drawStall(26,170,172,market.glow,'#f6bd45',market.left); drawStall(754,168,180,'#1e8a77','#ffb454',market.right);
  ctx.fillStyle='#0c1618'; ctx.beginPath(); ctx.moveTo(176,540); ctx.lineTo(354,190); ctx.lineTo(606,190); ctx.lineTo(784,540); ctx.closePath(); ctx.fill();
  const road = ctx.createLinearGradient(0,190,0,540); road.addColorStop(0,'#38504d'); road.addColorStop(1,'#172426'); ctx.fillStyle=road; ctx.beginPath(); ctx.moveTo(354,190); ctx.lineTo(606,190); ctx.lineTo(784,540); ctx.lineTo(176,540); ctx.closePath(); ctx.fill();
  const offset = (state.distance * 1.5) % 54; ctx.strokeStyle='rgba(255,210,125,.48)'; ctx.lineWidth=3; ctx.setLineDash([28,25]); ctx.lineDashOffset=-offset; for (const x of [394,566]) { ctx.beginPath(); ctx.moveTo(480,195); ctx.lineTo(x,540); ctx.stroke(); } ctx.setLineDash([]);
  ctx.strokeStyle='rgba(216,253,113,.42)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(354,190); ctx.lineTo(176,540); ctx.moveTo(606,190); ctx.lineTo(784,540); ctx.stroke();
  ctx.fillStyle='rgba(255,239,197,.82)'; ctx.font='700 10px monospace'; ctx.fillText(market.sign,330,218); ctx.fillStyle='rgba(255,239,197,.78)'; ctx.font='500 10px monospace'; ctx.fillText('LAGOS MARKET ROUTE · LAST BUS HOME',28,31); ctx.fillText(`${Math.floor(state.speed)} KM/H`,W-86,31);
}

function drawStall(x,y,width,awningColor,signColor,label) {
  ctx.fillStyle='rgba(8,16,18,.55)'; ctx.fillRect(x+10,y+16,width,80); ctx.fillStyle='#3c2e27'; ctx.fillRect(x+18,y+42,width-36,58); ctx.fillStyle=awningColor; ctx.beginPath(); ctx.moveTo(x,y+10); ctx.lineTo(x+width,y+10); ctx.lineTo(x+width-15,y+43); ctx.lineTo(x+15,y+43); ctx.closePath(); ctx.fill(); ctx.strokeStyle='rgba(255,235,180,.32)'; ctx.lineWidth=2; for(let stripe=x+18; stripe<x+width-10; stripe+=28){ctx.beginPath();ctx.moveTo(stripe,y+12);ctx.lineTo(stripe+12,y+41);ctx.stroke();} ctx.fillStyle=signColor; ctx.font='700 11px monospace'; ctx.fillText(label,x+28,y+72); ctx.fillStyle='#ffd27d'; ctx.fillRect(x+25,y+82,7,7); ctx.fillRect(x+47,y+82,7,7); ctx.fillRect(x+69,y+82,7,7);
}

function drawSuya(object) {
  const x=roadLaneX(object.lane, object.y); const y=object.y + Math.sin(object.wobble)*2; const scale=roadScale(object.y); ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale); ctx.shadowBlur=18; ctx.shadowColor='#ff8b3d';
  ctx.fillStyle='rgba(10,16,17,.55)'; ctx.beginPath(); ctx.ellipse(0,24,30,8,0,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0; ctx.fillStyle='#d8d0bc'; ctx.beginPath(); ctx.ellipse(0,13,30,8,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#f6f0db'; ctx.beginPath(); ctx.ellipse(0,10,27,7,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#c49855'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-26,-22); ctx.lineTo(27,11); ctx.moveTo(-14,-28); ctx.lineTo(32,2); ctx.stroke();
  const chunks=[[-17,-16,7,6],[-5,-10,8,7],[8,-3,7,7],[20,5,6,6]]; chunks.forEach(([chunkX,chunkY,width,height],index)=>{ ctx.fillStyle=index%2?'#8e3a24':'#aa4925'; ctx.beginPath(); ctx.roundRect(chunkX,chunkY,width,height,2); ctx.fill(); ctx.fillStyle='rgba(255,210,125,.68)'; ctx.fillRect(chunkX+2,chunkY+2,width-4,1); });
  ctx.fillStyle='#b67b3a'; ctx.font='700 7px monospace'; ctx.fillText('SUYA',-16,31); ctx.fillStyle='#e85d45'; for(let pepper=0;pepper<8;pepper+=1){ctx.fillRect(-20+pepper*5,-18+(pepper%3)*7,2,2);} ctx.restore();
}
function drawDanfo(object) {
  const x=roadLaneX(object.lane, object.y); const y=object.y; const scale=roadScale(object.y); ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
  ctx.fillStyle='rgba(10,16,17,.6)'; ctx.beginPath(); ctx.ellipse(0,26,42,9,0,0,Math.PI*2); ctx.fill();
  roundRect(-36,-30,72,48,8,'#d7b64a'); roundRect(-30,-24,60,24,4,'#254453');
  ctx.fillStyle='#b7e7e4'; ctx.fillRect(-24,-20,17,13); ctx.fillRect(7,-20,17,13); ctx.fillStyle='#f7e7a1'; ctx.fillRect(-30,1,60,8); ctx.fillStyle='#e85d45'; ctx.fillRect(-30,10,60,5); ctx.fillStyle='#2d8b68'; ctx.fillRect(-30,15,60,4);
  ctx.fillStyle='#151e22'; ctx.beginPath(); ctx.arc(-23,20,8,0,Math.PI*2); ctx.arc(23,20,8,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#8d9aa0'; ctx.beginPath(); ctx.arc(-23,20,3,0,Math.PI*2); ctx.arc(23,20,3,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#101d22'; ctx.font='700 8px monospace'; ctx.fillText('DANFO',-21,-35); ctx.fillStyle='#ffd27d'; ctx.fillRect(-31,-3,3,7); ctx.fillRect(28,-3,3,7); ctx.restore();
}
function drawEyo(object) {
  const x=roadLaneX(object.lane, object.y); const y=object.y; const scale=roadScale(object.y); ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
  ctx.fillStyle='rgba(10,16,17,.55)'; ctx.beginPath(); ctx.ellipse(0,28,26,8,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#f9f7e9'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(20,-42); ctx.lineTo(30,28); ctx.stroke(); ctx.fillStyle='#d8fd71'; ctx.beginPath(); ctx.arc(30,-45,7,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#f9f7e9'; ctx.beginPath(); ctx.moveTo(-16,18); ctx.lineTo(-24,-17); ctx.quadraticCurveTo(-22,-38,0,-42); ctx.quadraticCurveTo(22,-38,24,-17); ctx.lineTo(16,18); ctx.quadraticCurveTo(0,27,-16,18); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#d8d2bc'; ctx.beginPath(); ctx.arc(0,-48,12,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#f9f7e9'; ctx.beginPath(); ctx.moveTo(-17,-51); ctx.lineTo(-11,-70); ctx.lineTo(0,-80); ctx.lineTo(11,-70); ctx.lineTo(17,-51); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#2b3b43'; ctx.beginPath(); ctx.arc(-4,-49,2,0,Math.PI*2); ctx.arc(4,-49,2,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#e85d45'; ctx.fillRect(-10,-36,20,3); ctx.fillStyle='#d7b64a'; ctx.font='700 7px monospace'; ctx.fillText('EYO',-11,35); ctx.restore();
}
function drawHandcart(object) {
  const x=roadLaneX(object.lane, object.y); const y=object.y; const scale=roadScale(object.y); ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale); ctx.fillStyle='rgba(10,16,17,.55)'; ctx.beginPath(); ctx.ellipse(0,22,35,7,0,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#c98f52'; ctx.lineWidth=5; ctx.strokeRect(-27,-18,54,31); ctx.beginPath(); ctx.moveTo(-27,-18); ctx.lineTo(-38,-34); ctx.stroke(); ctx.fillStyle='#e85d45'; ctx.fillRect(-20,-14,40,8); ctx.fillStyle='#151e22'; ctx.beginPath(); ctx.arc(-18,18,7,0,Math.PI*2); ctx.arc(18,18,7,0,Math.PI*2); ctx.fill(); ctx.restore();
}
function drawRunner() {
  const style = currentIdentity?.style || {}; const lower=Math.floor(state.lane); const upper=Math.ceil(state.lane); const progress=state.lane-lower; const x=laneX[lower]+(laneX[upper]-laneX[lower])*progress; ctx.save(); ctx.translate(x,playerY); ctx.shadowBlur=22; ctx.shadowColor=style.primaryColor || '#d8fd71';
  ctx.fillStyle=style.secondaryColor || '#283252'; ctx.beginPath(); ctx.roundRect(-23,18,20,35,9); ctx.roundRect(3,18,20,35,9); ctx.fill(); ctx.fillStyle=style.primaryColor || '#d8fd71'; ctx.beginPath(); ctx.roundRect(-31,-16,62,48,17); ctx.fill(); ctx.fillStyle=style.skinColor || '#d99572'; ctx.beginPath(); ctx.arc(0,-41,22,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
  const hair=style.hairColor || '#292039'; ctx.fillStyle=hair; if (style.hair === 'afro' || style.hair === 'dreads') { for(let i=-2;i<=2;i+=1){ctx.beginPath();ctx.arc(i*8,-57-Math.abs(i)*2,11,0,Math.PI*2);ctx.fill();} } else if (style.hair !== 'bald') { ctx.beginPath();ctx.arc(0,-51,23,Math.PI,Math.PI*2);ctx.fill(); if(style.hair==='ponytail'){ctx.beginPath();ctx.arc(24,-49,9,0,Math.PI*2);ctx.fill();} }
  if(style.hat && style.hat !== 'none'){ctx.fillStyle=style.hat==='crown'?'#ffb454':'#27304b'; ctx.beginPath();ctx.roundRect(-25,-64,50,10,5);ctx.fill(); if(style.hat==='crown'){ctx.beginPath();ctx.moveTo(-17,-63);ctx.lineTo(-11,-76);ctx.lineTo(0,-65);ctx.lineTo(10,-76);ctx.lineTo(17,-63);ctx.closePath();ctx.fill();}}
  ctx.fillStyle='#111729'; ctx.beginPath();ctx.arc(-8,-41,2.5,0,Math.PI*2);ctx.arc(8,-41,2.5,0,Math.PI*2);ctx.fill();
  if(style.accessory==='glasses'){ctx.strokeStyle='#111729';ctx.lineWidth=2;ctx.strokeRect(-16,-48,13,10);ctx.strokeRect(3,-48,13,10);ctx.beginPath();ctx.moveTo(-3,-44);ctx.lineTo(3,-44);ctx.stroke();} if(style.accessory==='earrings'){ctx.fillStyle='#ffb454';ctx.beginPath();ctx.arc(-20,-32,3,0,Math.PI*2);ctx.arc(20,-32,3,0,Math.PI*2);ctx.fill();} if(style.accessory==='scarf'){ctx.fillStyle='#e85d45';ctx.fillRect(-22,-25,44,8);} if(style.accessory==='backpack'){ctx.fillStyle=style.secondaryColor||'#283252';ctx.fillRect(-36,-9,9,26);ctx.fillRect(27,-9,9,26);} ctx.fillStyle='#ffd27d'; ctx.fillRect(-18,52,14,4); ctx.fillRect(5,52,14,4); ctx.restore();
}

function draw() {
  drawBackground();
  for (const object of state.objects) {
    if (object.kind === 'suya') drawSuya(object);
    else if (object.kind === 'danfo') drawDanfo(object);
    else if (object.kind === 'eyo') drawEyo(object);
    else drawHandcart(object);
  }
  drawRunner();
  if (state.shake > 0) state.shake -= .016;
}
function frame(time) { const delta=Math.min(.04,(time-state.lastTime)/1000 || 0); state.lastTime=time; update(delta); draw(); requestAnimationFrame(frame); }

function handleKeyDown(event) {
  const key=event.key.toLowerCase();
  if (event.key==='ArrowLeft' || key==='a' || event.key==='ArrowRight' || key==='d') { event.preventDefault(); event.stopPropagation(); move(event.key==='ArrowLeft' || key==='a' ? -1 : 1); return; }
  if (key==='p') { event.preventDefault(); pauseToggle(); return; }
  if (event.key==='Enter' && (state.screen==='ready' || state.screen==='gameover')) { event.preventDefault(); startRun(); }
}
window.addEventListener('keydown', handleKeyDown, { capture:true });
canvas.addEventListener('pointerdown', () => canvas.focus());
function laneFromMouse(event) {
  const rect = canvas.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  return Math.max(0, Math.min(2, Math.floor(ratio * 3)));
}
canvas.addEventListener('mousemove', (event) => {
  if (state.screen === 'playing') state.targetLane = laneFromMouse(event);
});
canvas.addEventListener('click', (event) => {
  if (state.screen === 'playing') { state.targetLane = laneFromMouse(event); setupAudio(); }
});
$('#start-button').addEventListener('click', startRun); $('#restart-button').addEventListener('click', startRun); $('#sign-in-button').addEventListener('click', signIn); $('#leaderboard-button').addEventListener('click', () => $('#board-card').scrollIntoView({ behavior:'smooth', block:'center' })); $('#refresh-board').addEventListener('click', loadLeaderboard); $('#mobile-pause').addEventListener('click', pauseToggle); document.querySelectorAll('[data-lane]').forEach((button) => { button.addEventListener('click', () => { canvas.focus(); move(button.dataset.lane==='left' ? -1 : 1); }); button.addEventListener('pointerdown', (event) => event.preventDefault()); });
$('#sound-button').addEventListener('click', () => { soundOn=!soundOn; $('#sound-button').textContent=soundOn?'Sound on':'Sound off'; });
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadIdentity(); }); window.addEventListener('focus', loadIdentity);
renderMarketRoute();
document.querySelector('.market-route li')?.classList.add('current');
loadIdentity(); loadLeaderboard(); bestValue.textContent=`${state.best}m`; requestAnimationFrame(frame);

const START_NG = 'https://start.ng';
const API = 'https://api.start.ng';
const GAME_NAME = location.hostname.endsWith('.start.ng') ? location.hostname.split('.')[0] : 'lagos-market-run';

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
const state = { screen:'ready', lane:1, targetLane:1, distance:0, lanterns:0, speed:260, elapsed:0, objects:[], lastTime:0, best:Number(localStorage.getItem('lagos-market-run-best') || 0), spawnTimer:0, shake:0, marketIndex:0, stageBannerTimer:0 };

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
  if (distance > state.best) { state.best = distance; localStorage.setItem('lagos-market-run-best', String(distance)); }
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
  ctx.fillStyle='#bf572f'; ctx.fillRect(0,0,W,H);
  for (let band=0; band<7; band+=1) { ctx.fillStyle=band%2 ? '#c96537' : '#ba522e'; ctx.fillRect(0,band*86,W,86); }
  ctx.fillStyle='rgba(255,219,154,.17)'; for (let line=0; line<7; line+=1) ctx.fillRect(0,line*86+73,W,4);
  ctx.fillStyle='#f5c56b'; ctx.beginPath(); ctx.arc(790,86,38,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#202020'; ctx.lineWidth=4; ctx.stroke();
  drawMarketBuilding(18,120,122,105,'#236b8c'); drawMarketBuilding(820,106,118,115,'#e0a62c');
  drawRoadStrip(0,55,960,92,'#2f3635',18); drawRoadStrip(0,205,960,82,'#343938',18);
  drawStreetSign(42,164,market.sign); drawStreetSign(704,160,market.short.toUpperCase() + ' MARKET');
  drawStall(28,287,176,market.glow,'#f4ca3b',market.left); drawStall(754,280,180,'#197a9d','#f4ca3b',market.right);
  ctx.fillStyle='#85402d'; ctx.beginPath(); ctx.moveTo(175,540); ctx.lineTo(345,295); ctx.lineTo(615,295); ctx.lineTo(785,540); ctx.closePath(); ctx.fill();
  const road = ctx.createLinearGradient(0,295,0,540); road.addColorStop(0,'#4e5046'); road.addColorStop(1,'#262c2c'); ctx.fillStyle=road; ctx.beginPath(); ctx.moveTo(345,295); ctx.lineTo(615,295); ctx.lineTo(785,540); ctx.lineTo(175,540); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#f4e2b5'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(345,295); ctx.lineTo(175,540); ctx.moveTo(615,295); ctx.lineTo(785,540); ctx.stroke();
  const offset = (state.distance * 1.5) % 58; ctx.strokeStyle='#f9e7b8'; ctx.lineWidth=4; ctx.setLineDash([28,30]); ctx.lineDashOffset=-offset; for (const x of [405,555]) { ctx.beginPath(); ctx.moveTo(480,300); ctx.lineTo(x,540); ctx.stroke(); } ctx.setLineDash([]);
  ctx.fillStyle='#202020'; ctx.font='900 11px monospace'; ctx.fillText('LAGOS MARKET RUN · ' + market.short.toUpperCase(),28,32); ctx.fillText(`${Math.floor(state.speed)} KM/H`,W-90,32);
}

function drawMarketBuilding(x,y,width,height,color) {
  ctx.fillStyle='rgba(33,24,20,.34)'; ctx.fillRect(x+8,y+9,width,height); ctx.fillStyle=color; ctx.fillRect(x,y,width,height); ctx.strokeStyle='#202020'; ctx.lineWidth=3; ctx.strokeRect(x,y,width,height); ctx.fillStyle='#f4ca3b'; for (let row=0;row<2;row+=1) for (let column=0;column<3;column+=1) ctx.fillRect(x+12+column*31,y+18+row*30,12,10);
}
function drawRoadStrip(x,y,width,height,roadColor,markOffset) {
  ctx.fillStyle='#d99058'; ctx.fillRect(x,y,width,height); ctx.strokeStyle='#202020'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(x,y+3); ctx.lineTo(x+width,y+3); ctx.moveTo(x,y+height-3); ctx.lineTo(x+width,y+height-3); ctx.stroke(); ctx.fillStyle=roadColor; ctx.fillRect(x,y+14,width,height-28); ctx.strokeStyle='#f9e7b8'; ctx.lineWidth=3; ctx.setLineDash([34,26]); ctx.lineDashOffset=-(state.distance+markOffset)%60; ctx.beginPath(); ctx.moveTo(x,y+height/2); ctx.lineTo(x+width,y+height/2); ctx.stroke(); ctx.setLineDash([]);
}
function drawStreetSign(x,y,label) {
  ctx.fillStyle='#202020'; ctx.fillRect(x+4,y+10,5,42); ctx.fillRect(x+label.length*6+25,y+10,5,42); ctx.fillStyle='#f4ca3b'; ctx.fillRect(x,y,label.length*6+30,28); ctx.strokeStyle='#202020'; ctx.lineWidth=3; ctx.strokeRect(x,y,label.length*6+30,28); ctx.fillStyle='#202020'; ctx.font='900 9px monospace'; ctx.fillText(label,x+8,y+18);
}
function drawStall(x,y,width,awningColor,signColor,label) {
  ctx.fillStyle='rgba(33,24,20,.4)'; ctx.fillRect(x+10,y+17,width,90); ctx.fillStyle='#5a3426'; ctx.fillRect(x+18,y+43,width-36,64); ctx.strokeStyle='#202020'; ctx.lineWidth=3; ctx.strokeRect(x+18,y+43,width-36,64); ctx.fillStyle=awningColor; ctx.beginPath(); ctx.moveTo(x,y+10); ctx.lineTo(x+width,y+10); ctx.lineTo(x+width-15,y+44); ctx.lineTo(x+15,y+44); ctx.closePath(); ctx.fill(); ctx.strokeStyle='#202020'; ctx.lineWidth=3; ctx.stroke(); ctx.strokeStyle='rgba(255,240,194,.5)'; ctx.lineWidth=2; for(let stripe=x+18; stripe<x+width-10; stripe+=28){ctx.beginPath();ctx.moveTo(stripe,y+12);ctx.lineTo(stripe+12,y+41);ctx.stroke();} ctx.fillStyle=signColor; ctx.font='900 11px monospace'; ctx.fillText(label,x+26,y+75); ctx.fillStyle='#f4ca3b'; ctx.fillRect(x+25,y+88,8,8); ctx.fillRect(x+49,y+88,8,8); ctx.fillRect(x+73,y+88,8,8);
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
  ctx.fillStyle='rgba(10,16,17,.6)'; ctx.beginPath(); ctx.ellipse(0,28,46,10,0,0,Math.PI*2); ctx.fill();
  ctx.lineWidth=4; roundRect(-38,-31,76,50,9,'#efbd32','#202020'); roundRect(-32,-25,64,25,4,'#246079','#202020');
  ctx.fillStyle='#b9e9e7'; ctx.fillRect(-25,-21,18,14); ctx.fillRect(7,-21,18,14); ctx.fillStyle='#f8e5a6'; ctx.fillRect(-32,1,64,8); ctx.fillStyle='#d64b32'; ctx.fillRect(-32,10,64,6); ctx.fillStyle='#2e8f62'; ctx.fillRect(-32,16,64,4);
  ctx.fillStyle='#151e22'; ctx.beginPath(); ctx.arc(-24,21,9,0,Math.PI*2); ctx.arc(24,21,9,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#8d9aa0'; ctx.beginPath(); ctx.arc(-24,21,3,0,Math.PI*2); ctx.arc(24,21,3,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#202020'; ctx.font='900 8px monospace'; ctx.fillText('DANFO',-21,-37); ctx.fillStyle='#f4ca3b'; ctx.fillRect(-33,-3,4,8); ctx.fillRect(29,-3,4,8); ctx.restore();
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

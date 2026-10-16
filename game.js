const START_NG = 'https://start.ng';
const API = 'https://api.start.ng';
const GAME_NAME = location.hostname.endsWith('.start.ng') ? location.hostname.split('.')[0] : 'neon-market-dash';

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
const state = { screen:'ready', lane:1, targetLane:1, distance:0, lanterns:0, speed:260, elapsed:0, objects:[], lastTime:0, best:Number(localStorage.getItem('neon-market-best') || 0), spawnTimer:0, shake:0 };

const $ = (selector) => document.querySelector(selector);
const distanceValue = $('#distance-value');
const lanternValue = $('#lantern-value');
const bestValue = $('#best-value');
const runStatus = $('#run-status');
const titleOverlay = $('#title-overlay');
const gameoverOverlay = $('#gameover-overlay');
const pauseBadge = $('#pause-badge');

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
  state.screen = 'playing'; state.lane = 1; state.targetLane = 1; state.distance = 0; state.lanterns = 0; state.speed = 260; state.elapsed = 0; state.objects = []; state.spawnTimer = .2; state.lastTime = performance.now();
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
  const isLantern = Math.random() > .38;
  state.objects.push({ lane, y:-30, kind:isLantern ? 'lantern' : 'barrier', wobble:Math.random() * Math.PI * 2 });
}

function update(delta) {
  if (state.screen !== 'playing') return;
  state.elapsed += delta; state.distance += state.speed * delta * .12; state.speed = Math.min(520, 260 + state.distance * .16);
  state.spawnTimer -= delta;
  if (state.spawnTimer <= 0) { spawnObject(); state.spawnTimer = Math.max(.44, .92 - state.distance / 2200) + Math.random() * .26; }
  state.lane += (state.targetLane - state.lane) * Math.min(1, delta * 12);
  for (const object of state.objects) { object.y += state.speed * delta; object.wobble += delta * 5; }
  for (let index = state.objects.length - 1; index >= 0; index -= 1) {
    const object = state.objects[index];
    const closeEnough = object.y > playerY - 42 && object.y < playerY + 34 && Math.abs(object.lane - state.lane) < .42;
    if (closeEnough) { if (object.kind === 'lantern') { state.lanterns += 1; state.objects.splice(index,1); setupAudio(); } else { endRun(); return; } }
    else if (object.y > H + 60) state.objects.splice(index,1);
  }
  distanceValue.textContent = `${Math.floor(state.distance)}m`; lanternValue.textContent = String(state.lanterns); bestValue.textContent = `${Math.max(state.best, Math.floor(state.distance))}m`;
}

function roundRect(x,y,w,h,r,fill,stroke) { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); if (fill) { ctx.fillStyle=fill; ctx.fill(); } if (stroke) { ctx.strokeStyle=stroke; ctx.stroke(); } }
function drawBackground() {
  const sky = ctx.createLinearGradient(0,0,0,H); sky.addColorStop(0,'#182d3b'); sky.addColorStop(.48,'#63382d'); sky.addColorStop(1,'#101a1c'); ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,212,133,.92)'; ctx.beginPath(); ctx.arc(770,88,31,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(13,25,31,.72)'; ctx.fillRect(0,173,W,4);
  for (let i=0;i<12;i+=1) { const x=18+i*86; const height=38+(i%4)*20; ctx.fillStyle=i%2?'#1c3841':'#20333b'; ctx.fillRect(x,173-height,66,height); ctx.fillStyle=i%3?'#ffd27d':'#d8fd71'; ctx.globalAlpha=.7; for(let window=0;window<3;window+=1) ctx.fillRect(x+10+window*18,185-height,8,11); ctx.globalAlpha=1; }
  drawStall(26,170,172,'#e85d45','#f6bd45','MAMA PUT'); drawStall(754,168,180,'#1e8a77','#ffb454','SUYA');
  ctx.fillStyle='#0c1618'; ctx.beginPath(); ctx.moveTo(176,540); ctx.lineTo(354,190); ctx.lineTo(606,190); ctx.lineTo(784,540); ctx.closePath(); ctx.fill();
  const road = ctx.createLinearGradient(0,190,0,540); road.addColorStop(0,'#38504d'); road.addColorStop(1,'#172426'); ctx.fillStyle=road; ctx.beginPath(); ctx.moveTo(354,190); ctx.lineTo(606,190); ctx.lineTo(784,540); ctx.lineTo(176,540); ctx.closePath(); ctx.fill();
  const offset = (state.distance * 1.5) % 54; ctx.strokeStyle='rgba(255,210,125,.48)'; ctx.lineWidth=3; ctx.setLineDash([28,25]); ctx.lineDashOffset=-offset; for (const x of [394,566]) { ctx.beginPath(); ctx.moveTo(480,195); ctx.lineTo(x,540); ctx.stroke(); } ctx.setLineDash([]);
  ctx.strokeStyle='rgba(216,253,113,.42)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(354,190); ctx.lineTo(176,540); ctx.moveTo(606,190); ctx.lineTo(784,540); ctx.stroke();
  ctx.fillStyle='rgba(255,239,197,.78)'; ctx.font='500 10px monospace'; ctx.fillText('LAGOS NIGHT MARKET · LAST BUS HOME',28,31); ctx.fillStyle='rgba(255,239,197,.62)'; ctx.fillText(`${Math.floor(state.speed)} KM/H`,W-86,31);
}

function drawStall(x,y,width,awningColor,signColor,label) {
  ctx.fillStyle='rgba(8,16,18,.55)'; ctx.fillRect(x+10,y+16,width,80); ctx.fillStyle='#3c2e27'; ctx.fillRect(x+18,y+42,width-36,58); ctx.fillStyle=awningColor; ctx.beginPath(); ctx.moveTo(x,y+10); ctx.lineTo(x+width,y+10); ctx.lineTo(x+width-15,y+43); ctx.lineTo(x+15,y+43); ctx.closePath(); ctx.fill(); ctx.strokeStyle='rgba(255,235,180,.32)'; ctx.lineWidth=2; for(let stripe=x+18; stripe<x+width-10; stripe+=28){ctx.beginPath();ctx.moveTo(stripe,y+12);ctx.lineTo(stripe+12,y+41);ctx.stroke();} ctx.fillStyle=signColor; ctx.font='700 11px monospace'; ctx.fillText(label,x+28,y+72); ctx.fillStyle='#ffd27d'; ctx.fillRect(x+25,y+82,7,7); ctx.fillRect(x+47,y+82,7,7); ctx.fillRect(x+69,y+82,7,7);
}

function drawLantern(object) {
  const x = laneX[object.lane]; const y=object.y + Math.sin(object.wobble)*3; ctx.save(); ctx.translate(x,y); ctx.shadowBlur=24; ctx.shadowColor='#ffb454'; ctx.strokeStyle='#ffd27d'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-14,-15); ctx.lineTo(14,15); ctx.stroke(); ctx.fillStyle='#ff8b3d'; ctx.beginPath(); ctx.arc(0,0,11,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0; ctx.fillStyle='#fff0bd'; ctx.beginPath(); ctx.arc(-3,-3,4,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#2d8b68'; ctx.fillRect(-16,-20,8,5); ctx.restore();
}
function drawBarrier(object) { const x=laneX[object.lane]; const y=object.y; ctx.save(); ctx.translate(x,y); roundRect(-36,-19,72,39,8,'#d7b64a'); roundRect(-28,-13,56,20,4,'#274653'); ctx.fillStyle='#f2d879'; ctx.fillRect(-18,-9,14,12); ctx.fillRect(4,-9,14,12); ctx.fillStyle='#e85d45'; ctx.fillRect(-33,7,66,7); ctx.fillStyle='#101d22'; ctx.font='700 8px monospace'; ctx.fillText('DANFO',-20,-24); ctx.fillStyle='#f6bd45'; ctx.fillRect(-30,20,14,5); ctx.fillRect(16,20,14,5); ctx.restore(); }
function drawRunner() {
  const style = currentIdentity?.style || {}; const lower=Math.floor(state.lane); const upper=Math.ceil(state.lane); const progress=state.lane-lower; const x=laneX[lower]+(laneX[upper]-laneX[lower])*progress; ctx.save(); ctx.translate(x,playerY); ctx.shadowBlur=22; ctx.shadowColor=style.primaryColor || '#d8fd71';
  ctx.fillStyle=style.secondaryColor || '#283252'; ctx.beginPath(); ctx.roundRect(-23,18,20,35,9); ctx.roundRect(3,18,20,35,9); ctx.fill(); ctx.fillStyle=style.primaryColor || '#d8fd71'; ctx.beginPath(); ctx.roundRect(-31,-16,62,48,17); ctx.fill(); ctx.fillStyle=style.skinColor || '#d99572'; ctx.beginPath(); ctx.arc(0,-41,22,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
  const hair=style.hairColor || '#292039'; ctx.fillStyle=hair; if (style.hair === 'afro' || style.hair === 'dreads') { for(let i=-2;i<=2;i+=1){ctx.beginPath();ctx.arc(i*8,-57-Math.abs(i)*2,11,0,Math.PI*2);ctx.fill();} } else if (style.hair !== 'bald') { ctx.beginPath();ctx.arc(0,-51,23,Math.PI,Math.PI*2);ctx.fill(); if(style.hair==='ponytail'){ctx.beginPath();ctx.arc(24,-49,9,0,Math.PI*2);ctx.fill();} }
  if(style.hat && style.hat !== 'none'){ctx.fillStyle=style.hat==='crown'?'#ffb454':'#27304b'; ctx.beginPath();ctx.roundRect(-25,-64,50,10,5);ctx.fill(); if(style.hat==='crown'){ctx.beginPath();ctx.moveTo(-17,-63);ctx.lineTo(-11,-76);ctx.lineTo(0,-65);ctx.lineTo(10,-76);ctx.lineTo(17,-63);ctx.closePath();ctx.fill();}}
  ctx.fillStyle='#111729'; ctx.beginPath();ctx.arc(-8,-41,2.5,0,Math.PI*2);ctx.arc(8,-41,2.5,0,Math.PI*2);ctx.fill();
  if(style.accessory==='glasses'){ctx.strokeStyle='#111729';ctx.lineWidth=2;ctx.strokeRect(-16,-48,13,10);ctx.strokeRect(3,-48,13,10);ctx.beginPath();ctx.moveTo(-3,-44);ctx.lineTo(3,-44);ctx.stroke();} if(style.accessory==='earrings'){ctx.fillStyle='#ffb454';ctx.beginPath();ctx.arc(-20,-32,3,0,Math.PI*2);ctx.arc(20,-32,3,0,Math.PI*2);ctx.fill();} if(style.accessory==='scarf'){ctx.fillStyle='#e85d45';ctx.fillRect(-22,-25,44,8);} if(style.accessory==='backpack'){ctx.fillStyle=style.secondaryColor||'#283252';ctx.fillRect(-36,-9,9,26);ctx.fillRect(27,-9,9,26);} ctx.fillStyle='#ffd27d'; ctx.fillRect(-18,52,14,4); ctx.fillRect(5,52,14,4); ctx.restore();
}

function draw() { drawBackground(); for (const object of state.objects) { if (object.kind==='lantern') drawLantern(object); else drawBarrier(object); } drawRunner(); if (state.shake>0) state.shake-=.016; }
function frame(time) { const delta=Math.min(.04,(time-state.lastTime)/1000 || 0); state.lastTime=time; update(delta); draw(); requestAnimationFrame(frame); }

function handleKeyDown(event) {
  const key=event.key.toLowerCase();
  if (event.key==='ArrowLeft' || key==='a' || event.key==='ArrowRight' || key==='d') { event.preventDefault(); event.stopPropagation(); move(event.key==='ArrowLeft' || key==='a' ? -1 : 1); return; }
  if (key==='p') { event.preventDefault(); pauseToggle(); return; }
  if (event.key==='Enter' && (state.screen==='ready' || state.screen==='gameover')) { event.preventDefault(); startRun(); }
}
window.addEventListener('keydown', handleKeyDown, { capture:true });
canvas.addEventListener('pointerdown', () => canvas.focus());
$('#start-button').addEventListener('click', startRun); $('#restart-button').addEventListener('click', startRun); $('#sign-in-button').addEventListener('click', signIn); $('#leaderboard-button').addEventListener('click', () => $('#board-card').scrollIntoView({ behavior:'smooth', block:'center' })); $('#refresh-board').addEventListener('click', loadLeaderboard); $('#mobile-pause').addEventListener('click', pauseToggle); document.querySelectorAll('[data-lane]').forEach((button) => { button.addEventListener('click', () => { canvas.focus(); move(button.dataset.lane==='left' ? -1 : 1); }); button.addEventListener('pointerdown', (event) => event.preventDefault()); });
$('#sound-button').addEventListener('click', () => { soundOn=!soundOn; $('#sound-button').textContent=soundOn?'Sound on':'Sound off'; });
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadIdentity(); }); window.addEventListener('focus', loadIdentity);
loadIdentity(); loadLeaderboard(); bestValue.textContent=`${state.best}m`; requestAnimationFrame(frame);

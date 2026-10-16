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
  else if (state.screen === 'paused') { state.screen = 'playing'; pauseBadge.classList.add('hidden'); runStatus.textContent = 'Night shift in progress'; state.lastTime = performance.now(); }
}

function startRun() {
  state.screen = 'playing'; state.lane = 1; state.targetLane = 1; state.distance = 0; state.lanterns = 0; state.speed = 260; state.elapsed = 0; state.objects = []; state.spawnTimer = .2; state.lastTime = performance.now();
  titleOverlay.classList.add('hidden'); gameoverOverlay.classList.add('hidden'); pauseBadge.classList.add('hidden'); runStatus.textContent = 'Night shift in progress'; setupAudio();
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
    const closeEnough = object.y > playerY - 34 && object.y < playerY + 28 && Math.abs(object.lane - state.lane) < .34;
    if (closeEnough) { if (object.kind === 'lantern') { state.lanterns += 1; state.objects.splice(index,1); setupAudio(); } else { endRun(); return; } }
    else if (object.y > H + 60) state.objects.splice(index,1);
  }
  distanceValue.textContent = `${Math.floor(state.distance)}m`; lanternValue.textContent = String(state.lanterns); bestValue.textContent = `${Math.max(state.best, Math.floor(state.distance))}m`;
}

function roundRect(x,y,w,h,r,fill,stroke) { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); if (fill) { ctx.fillStyle=fill; ctx.fill(); } if (stroke) { ctx.strokeStyle=stroke; ctx.stroke(); } }
function drawBackground() {
  const sky = ctx.createLinearGradient(0,0,0,H); sky.addColorStop(0,'#121a36'); sky.addColorStop(.55,'#11152b'); sky.addColorStop(1,'#080c16'); ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#202d52'; ctx.fillRect(0,170,W,2);
  for (let i=0;i<11;i+=1) { const x=40+i*94; const height=36+(i%4)*17; ctx.fillStyle=i%2?'#17233f':'#1c2746'; ctx.fillRect(x,170-height,70,height); ctx.fillStyle=i%3?'#ffb454':'#d8fd71'; ctx.globalAlpha=.6; ctx.fillRect(x+12,180-height,8,12); ctx.fillRect(x+33,180-height,8,12); ctx.fillRect(x+54,180-height,8,12); ctx.globalAlpha=1; }
  ctx.fillStyle='#0a0f1e'; ctx.beginPath(); ctx.moveTo(180,540); ctx.lineTo(350,185); ctx.lineTo(610,185); ctx.lineTo(780,540); ctx.closePath(); ctx.fill();
  const road = ctx.createLinearGradient(0,200,0,540); road.addColorStop(0,'#1c2744'); road.addColorStop(1,'#0c1223'); ctx.fillStyle=road; ctx.beginPath(); ctx.moveTo(350,185); ctx.lineTo(610,185); ctx.lineTo(780,540); ctx.lineTo(180,540); ctx.closePath(); ctx.fill();
  const offset = (state.distance * 1.3) % 48; ctx.strokeStyle='rgba(216,253,113,.38)'; ctx.lineWidth=2; for (const x of [400,480,560]) { ctx.beginPath(); ctx.moveTo(x,210); ctx.lineTo(x,540); ctx.stroke(); }
  ctx.strokeStyle='rgba(255,180,84,.32)'; ctx.setLineDash([24,24]); ctx.lineDashOffset=-offset; for (const x of [397,563]) { ctx.beginPath(); ctx.moveTo(x,205); ctx.lineTo(x,540); ctx.stroke(); } ctx.setLineDash([]);
  ctx.fillStyle='rgba(216,253,113,.5)'; ctx.font='500 10px DM Mono'; ctx.fillText('NIGHT MARKET / BLOCK 07',32,32); ctx.fillStyle='rgba(255,255,255,.42)'; ctx.fillText(`${Math.floor(state.speed)} KM/H`,W-97,32);
}

function drawLantern(object) {
  const x = laneX[object.lane]; const y=object.y + Math.sin(object.wobble)*3; ctx.save(); ctx.translate(x,y); ctx.shadowBlur=22; ctx.shadowColor='#ffb454'; ctx.fillStyle='#ffb454'; ctx.beginPath(); ctx.arc(0,0,11,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0; ctx.fillStyle='#fff0bd'; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#ffcf6a'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(0,-12,6,Math.PI,0); ctx.stroke(); ctx.restore();
}
function drawBarrier(object) { const x=laneX[object.lane]; const y=object.y; ctx.save(); ctx.translate(x,y); roundRect(-29,-19,58,38,8,'#ff6b95'); ctx.fillStyle='#61214c'; ctx.fillRect(-18,-8,36,6); ctx.fillRect(-18,4,36,6); ctx.fillStyle='#ffb454'; ctx.beginPath(); ctx.arc(0,-25,5,0,Math.PI*2); ctx.fill(); ctx.restore(); }
function drawRunner() {
  const style = currentIdentity?.style || {}; const x=laneX[Math.round(state.lane)]; ctx.save(); ctx.translate(x,playerY); ctx.shadowBlur=22; ctx.shadowColor=style.primaryColor || '#d8fd71';
  ctx.fillStyle=style.secondaryColor || '#283252'; ctx.beginPath(); ctx.roundRect(-23,18,20,35,9); ctx.roundRect(3,18,20,35,9); ctx.fill(); ctx.fillStyle=style.primaryColor || '#d8fd71'; ctx.beginPath(); ctx.roundRect(-31,-16,62,48,17); ctx.fill(); ctx.fillStyle=style.skinColor || '#d99572'; ctx.beginPath(); ctx.arc(0,-41,22,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
  const hair=style.hairColor || '#292039'; ctx.fillStyle=hair; if (style.hair === 'afro' || style.hair === 'dreads') { for(let i=-2;i<=2;i+=1){ctx.beginPath();ctx.arc(i*8,-57-Math.abs(i)*2,11,0,Math.PI*2);ctx.fill();} } else if (style.hair !== 'bald') { ctx.beginPath();ctx.arc(0,-51,23,Math.PI,Math.PI*2);ctx.fill(); if(style.hair==='ponytail'){ctx.beginPath();ctx.arc(24,-49,9,0,Math.PI*2);ctx.fill();} }
  if(style.hat && style.hat !== 'none'){ctx.fillStyle=style.hat==='crown'?'#ffb454':'#27304b'; ctx.beginPath();ctx.roundRect(-25,-64,50,10,5);ctx.fill(); if(style.hat==='crown'){ctx.beginPath();ctx.moveTo(-17,-63);ctx.lineTo(-11,-76);ctx.lineTo(0,-65);ctx.lineTo(10,-76);ctx.lineTo(17,-63);ctx.closePath();ctx.fill();}}
  ctx.fillStyle='#111729'; ctx.beginPath();ctx.arc(-8,-41,2.5,0,Math.PI*2);ctx.arc(8,-41,2.5,0,Math.PI*2);ctx.fill();
  if(style.accessory==='glasses'){ctx.strokeStyle='#111729';ctx.lineWidth=2;ctx.strokeRect(-16,-48,13,10);ctx.strokeRect(3,-48,13,10);ctx.beginPath();ctx.moveTo(-3,-44);ctx.lineTo(3,-44);ctx.stroke();} if(style.accessory==='earrings'){ctx.fillStyle='#ffb454';ctx.beginPath();ctx.arc(-20,-32,3,0,Math.PI*2);ctx.arc(20,-32,3,0,Math.PI*2);ctx.fill();} if(style.accessory==='scarf'){ctx.fillStyle='#ff6b95';ctx.fillRect(-22,-25,44,8);} if(style.accessory==='backpack'){ctx.fillStyle=style.secondaryColor||'#283252';ctx.fillRect(-36,-9,9,26);ctx.fillRect(27,-9,9,26);} ctx.restore();
}

function draw() { drawBackground(); for (const object of state.objects) { if (object.kind==='lantern') drawLantern(object); else drawBarrier(object); } drawRunner(); if (state.shake>0) state.shake-=.016; }
function frame(time) { const delta=Math.min(.04,(time-state.lastTime)/1000 || 0); state.lastTime=time; update(delta); draw(); requestAnimationFrame(frame); }

document.addEventListener('keydown', (event) => { if (event.key==='ArrowLeft'||event.key.toLowerCase()==='a') move(-1); if (event.key==='ArrowRight'||event.key.toLowerCase()==='d') move(1); if(event.key.toLowerCase()==='p') pauseToggle(); if(event.key==='Enter' && state.screen==='ready') startRun(); if(event.key==='Enter' && state.screen==='gameover') startRun(); });
$('#start-button').addEventListener('click', startRun); $('#restart-button').addEventListener('click', startRun); $('#sign-in-button').addEventListener('click', signIn); $('#leaderboard-button').addEventListener('click', () => $('#board-card').scrollIntoView({ behavior:'smooth', block:'center' })); $('#refresh-board').addEventListener('click', loadLeaderboard); $('#mobile-pause').addEventListener('click', pauseToggle); document.querySelectorAll('[data-lane]').forEach((button) => button.addEventListener('click', () => move(button.dataset.lane==='left' ? -1 : 1)));
$('#sound-button').addEventListener('click', () => { soundOn=!soundOn; $('#sound-button').textContent=soundOn?'Sound on':'Sound off'; });
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadIdentity(); }); window.addEventListener('focus', loadIdentity);
loadIdentity(); loadLeaderboard(); bestValue.textContent=`${state.best}m`; requestAnimationFrame(frame);

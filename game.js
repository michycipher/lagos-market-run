import * as THREE from './vendor/three.module.js';

const START_NG = 'https://start.ng';
const API = 'https://api.start.ng';
const GAME_NAME = location.hostname.endsWith('.start.ng') ? location.hostname.split('.')[0] : 'lagos-market-run';
const $ = (selector) => document.querySelector(selector);
const MARKETS = [
  ['Balogun Market','ANKARA & LACE','#d45532'],['Mushin Market','SPARES & SUYA','#1d8d78'],
  ['Yaba Market','TECH & THRIFT','#336dba'],['Tejuosho Market','FASHION STOP','#a251a0'],
  ['Oyingbo Market','FRESH FOOD','#d57329'],['Oshodi Market','BUS STOP HUSTLE','#238d72'],
  ['Mile 12 Market','PEPPER & PLANTAIN','#c44e2f'],['Computer Village','PHONES & GADGETS','#297b9a'],
  ['Ladipo Market','MOTOR PARTS','#bd792c'],['Alaba International','ELECTRONICS','#2c907b'],
  ['Idumota Market','WHOLESALE','#934c80'],['Jankara Market','ADIRE & SPICES','#bd6b30'],
  ['Epe Fish Market','FRESH SEAFOOD','#327da1'],['Ajah Market','COASTAL HUSTLE','#de7540'],
  ['Ikotun Market','PROVISIONS','#42835c'],['Igando Market','GRAINS & CLOTH','#a9613b'],
  ['Lekki Market','ART & CRAFT','#218b86'],['Agbalata Market','BADAGRY BASKETS','#cf7a36'],
  ['Sangotedo Market','LAST STOP, MORE SUYA','#a76135']
];
const STEP_X = 1.55, STEP_Z = 2.4, BOUND = 6;
const state = { screen:'ready', row:0, column:0, furthest:0, hops:0, suya:0, market:0, time:0,
  hop:null, queued:null, pointerTarget:null, bannerUntil:0, best:Number(localStorage.getItem('lagos-market-run-best-3d') || 0) };
let identity = { name:'Guest', style:{} }, signedIn = false, soundOn = true, audio;
let framePromise, player, limbs, cameraZ=6, previousTime=0;
const rows = new Map(), vehicles = [], walkers = [], collectibles = [], obstacles = [];
const materialCache = new Map(), geometryCache = new Map();
const canvas = $('#game-canvas');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'high-performance' }); }
catch { $('#render-error').classList.remove('hidden'); $('#loading').classList.add('hidden'); throw new Error('WebGL 2 unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor('#c46134');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#c46134');
scene.fog = new THREE.Fog('#c46134',65,115);
const camera = new THREE.OrthographicCamera(-16,16,10,-10,.1,160);
const hemi = new THREE.HemisphereLight('#fff6df','#8b613c',2.5); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff2d4',3.2); sun.position.set(-12,22,10);
sun.castShadow = true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-26;sun.shadow.camera.right=26;
sun.shadow.camera.top=26;sun.shadow.camera.bottom=-26;sun.shadow.camera.near=.1;sun.shadow.camera.far=65;
sun.shadow.normalBias=.03;sun.shadow.bias=-.0003;sun.shadow.radius=3; scene.add(sun,sun.target);
const world = new THREE.Group(); scene.add(world);

function mat(color) {
  if (!materialCache.has(color)) materialCache.set(color,new THREE.MeshLambertMaterial({ color, flatShading:true }));
  return materialCache.get(color);
}
function geometry(key, create) {
  if (!geometryCache.has(key)) geometryCache.set(key,create());
  return geometryCache.get(key);
}
function mesh(parent,geom,color,x=0,y=0,z=0) {
  const obj=new THREE.Mesh(geom,mat(color)); obj.position.set(x,y,z);obj.castShadow=true;obj.receiveShadow=true; parent.add(obj);return obj;
}
function box(parent,w,h,d,color,x=0,y=0,z=0) { return mesh(parent,geometry(`b:${w},${h},${d}`,()=>new THREE.BoxGeometry(w,h,d)),color,x,y,z); }
function sphere(parent,r,color,x=0,y=0,z=0,sx=1,sy=1,sz=1) {
  const obj=mesh(parent,geometry(`s:${r}`,()=>new THREE.SphereGeometry(r,12,9)),color,x,y,z);obj.scale.set(sx,sy,sz);return obj;
}
function cylinder(parent,r1,r2,h,color,x=0,y=0,z=0,sides=10) {
  return mesh(parent,geometry(`c:${r1},${r2},${h},${sides}`,()=>new THREE.CylinderGeometry(r1,r2,h,sides)),color,x,y,z);
}
function sign(parent,text,x,y,z,width=3.2,color='#f7ce45') {
  const c=document.createElement('canvas');c.width=512;c.height=128;
  const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,512,128);ctx.strokeStyle='#302920';ctx.lineWidth=14;ctx.strokeRect(0,0,512,128);
  ctx.fillStyle='#29251d';ctx.font=`900 ${text.length>21?27:35}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,67,478);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  const obj=new THREE.Mesh(geometry('sign',()=>new THREE.PlaneGeometry(1,1)),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
  obj.scale.set(width,width/4,1);obj.position.set(x,y,z);parent.add(obj);parent.userData.textures??=[];parent.userData.textures.push(texture);return obj;
}

// A jointed 3D avatar: the start.ng style controls body, clothes, hair, hat and accessories.
function createCharacter(style={}, scale=1) {
  const root=new THREE.Group(), body=new THREE.Group();root.add(body);root.scale.setScalar(scale);
  const skin=style.skinColor||'#8d5524', top=style.primaryColor||'#f7b731',bottom=style.secondaryColor||'#5f3dc4',hair=style.hairColor||'#17120f';
  const female=style.body!=='male';
  sphere(body,.29,top,0,1.05,0,female?1:1.12,1.5,.72);
  cylinder(body,.13,.17,.17,skin,0,1.47,0);
  sphere(body,.28,skin,0,1.73,0,.88,1.07,.9);
  sphere(body,.065,skin,-.25,1.73,0);sphere(body,.065,skin,.25,1.73,0);
  // Face looks toward local +Z; rotation follows each hop.
  sphere(body,.025,'#211a15',-.087,1.77,.232);sphere(body,.025,'#211a15',.087,1.77,.232);
  sphere(body,.045,skin,0,1.7,.255,.8,.7,1);
  const mouth=box(body,.09,.013,.015,'#7c3d24',0,1.63,.241);
  if (style.hair!=='bald') {
    sphere(body,.29,hair,0,1.93,-.025,1.03,.62,1);
    const type=style.hair||'afro';
    if(type==='afro'||type==='dreads') {
      sphere(body,.36,hair,0,2.02,-.03,1.07,.91,1);
      for(let i=0;i<7;i++){const a=i*Math.PI*2/7;sphere(body,.13,hair,Math.cos(a)*.27,2.04+Math.sin(a)*.08,Math.sin(a)*.22);}
    } else if(type==='bun') sphere(body,.19,hair,0,2.18,-.1);
    else if(type==='ponytail') {sphere(body,.14,hair,0,1.94,-.31);cylinder(body,.09,.035,.4,hair,0,1.66,-.36);}
    else if(type==='braids') for(const side of [-1,1]) cylinder(body,.065,.035,.62,hair,side*.23,1.67,-.11);
  }
  const joints={};
  for(const side of [-1,1]) {
    const arm=new THREE.Group();arm.position.set(side*.32,1.35,0);body.add(arm);
    cylinder(arm,.085,.075,.32,top,0,-.11,0);cylinder(arm,.065,.055,.4,skin,0,-.42,0);sphere(arm,.075,skin,0,-.64,0);
    const leg=new THREE.Group();leg.position.set(side*.13,.7,0);body.add(leg);
    cylinder(leg,.105,.075,.59,bottom,0,-.25,0);box(leg,.17,.12,.27,'#332b25',0,-.57,.047);
    joints[side<0?'leftArm':'rightArm']=arm;joints[side<0?'leftLeg':'rightLeg']=leg;
  }
  if(style.accessory==='earrings') for(const side of [-1,1]) sphere(body,.044,'#ffd23d',side*.27,1.64,.02);
  if(style.accessory==='glasses') {for(const side of [-1,1])box(body,.13,.075,.035,'#282824',side*.09,1.77,.256);box(body,.05,.025,.04,'#282824',0,1.77,.26);}
  if(style.accessory==='scarf') {cylinder(body,.19,.2,.11,'#df523c',0,1.43,0);box(body,.13,.4,.07,'#df523c',.13,1.15,.23);}
  if(style.accessory==='backpack') box(body,.42,.49,.2,'#397b74',0,1.1,-.26);
  if(style.accessory==='beard') sphere(body,.15,hair,0,1.56,.13,1,.6,.8);
  if(style.hat&&style.hat!=='none') {
    const hat=style.hat;
    if(hat==='crown') {cylinder(body,.28,.28,.14,'#ffd23d',0,2.12,0);for(let i=0;i<6;i++){const a=i*Math.PI/3;cylinder(body,0,.075,.18,'#ffd23d',Math.cos(a)*.22,2.26,Math.sin(a)*.22,4);}}
    else if(hat==='tophat'||hat==='top hat') {cylinder(body,.36,.36,.06,'#282827',0,2.1,0);cylinder(body,.24,.24,.35,'#282827',0,2.29,0);}
    else {sphere(body,.3,top,0,2.06,0,1,.6,1);if(hat==='cap')box(body,.34,.04,.3,top,0,2.08,.22);}
  }
  root.userData={body,joints,mouth};return root;
}
function updatePlayer() {
  const old=player;player=createCharacter(identity.style);limbs=player.userData.joints;
  if(old){player.position.copy(old.position);player.rotation.copy(old.rotation);scene.remove(old);}scene.add(player);
  if(state.screen==='ready')player.rotation.y=.1;
}

function wheels(parent,length,width) {
  const list=[];
  for(const x of [-length*.33,length*.33])for(const z of [-width*.49,width*.49]) {
    const wheel=cylinder(parent,.29,.29,.16,'#20211f',x,.31,z,12);wheel.rotation.x=Math.PI/2;list.push(wheel);
    const hub=cylinder(parent,.105,.105,.17,'#66655c',x,.31,z,10);hub.rotation.x=Math.PI/2;
  }return list;
}
function makeVehicle(kind='danfo',color='#eebd24') {
  const g=new THREE.Group();let length;
  if(kind==='danfo') {
    length=4.1;box(g,4.1,.91,1.65,color,0,.9,0);box(g,3.85,.7,1.6,color,-.1,1.58,0);box(g,3.3,.08,1.32,'#bd8f25',-.1,1.98,0);
    for(const z of [-.811,.811]) {
      box(g,3.55,.47,.025,'#253936',-.08,1.63,z);
      for(let i=0;i<5;i++)box(g,.055,.49,.04,color,-1.65+i*.72,1.63,z);
      box(g,4.12,.11,.034,'#23251e',0,1.02,z*1.03);box(g,4.12,.085,.034,'#23251e',0,.69,z*1.03);
    }
    box(g,.026,.48,1.38,'#8baba5',2.06,1.58,0);box(g,.06,.18,1.14,'#252824',2.1,.8,0);
    for(const z of [-.59,.59])box(g,.07,.17,.23,'#fff2b2',2.11,1.01,z);
    box(g,4.25,.13,1.74,'#33352e',0,.51,0);box(g,.1,.21,.34,'#fff0c9',2.14,.56,0);
    // Passenger door is a recessed panel, attached to the vehicle.
    box(g,.82,.88,.035,'#d6a41d',.95,1.15,.845);box(g,.65,.37,.04,'#304b46',.95,1.58,.87);
  } else if(kind==='keke') {
    length=2.4;box(g,2.4,.63,1.4,color,0,.72,0);box(g,1.65,.16,1.45,'#242820',-.26,1.83,0);
    for(const x of [-1,.48])for(const z of [-.63,.63])box(g,.055,.93,.055,'#242820',x,1.36,z);
    box(g,.06,.52,1.17,'#8ab0a8',.53,1.36,0);box(g,.74,.54,1.15,color,.93,1.02,0);
    for(const z of [-.72,.72])box(g,2.35,.09,.025,'#f5c72d',0,.81,z);
  } else {
    length=2;box(g,1.65,.23,.4,'#cf4434',0,.66,0);box(g,.45,.38,.42,'#242725',-.3,.95,0);box(g,.06,.65,.08,'#33352b',.64,1.12,0);
    const rider=createCharacter({body:'male',primaryColor:color,secondaryColor:'#33382e',hair:'short'},.62);rider.position.set(-.12,.44,0);rider.rotation.y=Math.PI/2;g.add(rider);
  }
  const wheelList=wheels(g,length,kind==='okada'?.45:kind==='keke'?1.4:1.65);
  g.userData={length,wheels:wheelList,kind};return g;
}
function makeEyo() {
  const g=new THREE.Group();cylinder(g,.18,.5,1.5,'#fff7df',0,.85,0,12);sphere(g,.23,'#fff8e9',0,1.69,0);
  cylinder(g,.51,.51,.045,'#fff8e9',0,1.99,0);cylinder(g,.04,.23,.4,'#fff8e9',0,2.16,0);
  for(const x of [-.08,.08])sphere(g,.025,'#302f26',x,1.75,.2);
  const staff=cylinder(g,.026,.026,2.1,'#b79b54',.52,1.05,0,8);staff.rotation.z=-.13;
  for(const x of [-.27,.27]){const arm=cylinder(g,.06,.1,.65,'#fff7df',x,1.28,0);arm.rotation.z=x<0?.7:-.7;}
  return g;
}
function makeSuya() {
  const g=new THREE.Group();const tray=cylinder(g,.36,.3,.055,'#ddd2b6',0,.12,0,12);tray.scale.z=.68;
  for(let s=0;s<2;s++) {
    const skewer=cylinder(g,.015,.015,.91,'#c99f60',(s-.5)*.21,.24,0,6);skewer.rotation.x=Math.PI/2;
    for(let i=0;i<4;i++){const meat=box(g,.19,.14,.15,i%2?'#7b3c22':'#aa4a26',(s-.5)*.21,.26,-.26+i*.17);meat.rotation.y=(i%2)*.3;box(g,.12,.018,.025,'#dc873b',(s-.5)*.21,.34,-.26+i*.17);}
  }
  for(let i=0;i<3;i++) sphere(g,.065,'#e3d2a9',.21,.21,.1+i*.08,1,.3,1);
  return g;
}
function barrel(parent,x,z) {
  cylinder(parent,.39,.39,.95,'#297f9d',x,.5,z,12);
  cylinder(parent,.41,.41,.09,'#226c87',x,.17,z,12);cylinder(parent,.41,.41,.09,'#226c87',x,.78,z,12);
  cylinder(parent,.29,.29,.035,'#194b5d',x,1,z,12);
}
function stall(parent,x,z,index) {
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  const market=MARKETS[Math.min(18,Math.floor(Math.max(0,index)/20))],accent=market[2];
  for(const px of [-1.2,1.2])for(const pz of [-.65,.65])box(g,.09,2.35,.09,'#695034',px,1.18,pz);
  const roof=box(g,2.9,.15,1.95,accent,0,2.45,0);roof.rotation.x=-.11;
  for(let i=0;i<5;i++)box(g,.23,.16,1.95,'#f7c96c',-1.25+i*.57,2.51,0);
  box(g,2.65,.12,1.6,'#895637',0,1.02,0);box(g,2.5,.85,1.32,'#9a653c',0,.53,0);
  const label=index%8===0?'MAMA PUT':index%4===0?'SUYA SPOT':market[1];sign(g,label,0,1.87,.77,2.35);
  for(let i=0;i<6;i++)sphere(g,.13,i%2?'#d84526':'#7d9a3b',-.95+i*.37,1.17,.12,1,.7,1);
}
function tree(parent,x,z) {
  cylinder(parent,.1,.15,2,'#785333',x,1,z,7);sphere(parent,1,'#63833b',x,2.5,z,1,.8,1);
  sphere(parent,.7,'#7c9647',x+.4,2.85,z-.2);
}
function safeRow(index) { return index<=1 || index%5===0 || index%5===1; }
function random(index,salt=0) { const v=Math.sin(index*127.1+salt*311.7+42.3)*43758.5453;return v-Math.floor(v); }

function addRow(index) {
  const group=new THREE.Group();group.position.z=-index*STEP_Z;group.userData.index=index;world.add(group);rows.set(index,group);
  const safe=safeRow(index), z=-index*STEP_Z;
  const floor=box(group,120,.18,STEP_Z+.01,safe?(index%2?'#c56636':'#bf592e'):'#49483e',0,-.1,0);floor.castShadow=false;
  if(!safe) {
    for(let x=-29;x<=29;x+=3.8){const dash=box(group,1.65,.018,.065,'#fff0c8',x,.004,0);dash.castShadow=false;}
    const direction=index%2?1:-1,kind=index%4===0?'keke':index%3===0?'okada':'danfo';
    const speed=(2.2+random(index,4)*1.5)*(1+Math.min(18,Math.floor(index/20))*.07);
    const count=index<8?2:3;
    for(let v=0;v<count;v++) {
      const obj=makeVehicle(kind,kind==='danfo'?'#edb91c':v%2?'#258c48':'#237cb0');
      obj.position.set(-25+v*(50/count)+random(index,7)*5,0,z);obj.rotation.y=direction<0?Math.PI:0;world.add(obj);
      vehicles.push({obj,row:index,direction,speed,length:obj.userData.length});
    }
  } else {
    // Kerbs sit at ground level between actual roads, with clear open walking space.
    for(const edge of [-1,1]) if(!safeRow(index+edge))box(group,120,.09,.12,'#e6c999',0,.015,edge*-STEP_Z/2);
    for(const side of [-1,1]) {
      if(index%5===0){stall(group,side*(12+random(index,3)*2),0,index);tree(group,side*18,.3);}
      if(index%5===1)barrel(group,side*11,.25);
    }
    if(index>5&&index%10===5) {
      const obj=makeEyo();obj.position.set((random(index,6)-.5)*13,0,z);world.add(obj);walkers.push({obj,row:index,direction:index%2?1:-1,speed:.7+Math.floor(index/20)*.04});
    }
    if(index>2&&index%5===1) {
      const column=(Math.floor(random(index,8)*9)-4);barrel(group,column*STEP_X,.1);obstacles.push({row:index,column});
    }
    if(index%20===0) {
      const market=MARKETS[Math.min(18,Math.floor(Math.max(0,index)/20))];
      box(group,.12,2.8,.12,'#735539',-8,1.4,-.8);box(group,.12,2.8,.12,'#735539',-4,1.4,-.8);
      sign(group,market[0].toUpperCase(),-6,2.52,-.8,4.5);sign(group,market[1],-6,1.85,-.8,3.25,'#f5e4be');
    }
  }
  if(index>=1&&index%2===1) {
    const column=index===1?0:Math.floor(random(index,2)*9)-4;
    if(!obstacles.some(o=>o.row===index&&o.column===column)) {
      const obj=makeSuya();obj.position.set(column*STEP_X,.3,z);world.add(obj);collectibles.push({obj,row:index,column,collected:false});
    }
  }
}
function discardRow(index) {
  const group=rows.get(index);if(!group)return;
  group.traverse(obj=>{for(const t of obj.userData.textures||[])t.dispose();if(obj.material?.map)obj.material.dispose();});
  world.remove(group);rows.delete(index);
  for(const list of [vehicles,walkers,collectibles])for(let i=list.length-1;i>=0;i--)if(list[i].row===index){world.remove(list[i].obj);list.splice(i,1);}
  for(let i=obstacles.length-1;i>=0;i--)if(obstacles[i].row===index)obstacles.splice(i,1);
}
function ensureWorld() {
  for(let r=Math.max(-4,state.furthest-7);r<=state.furthest+20;r++)if(!rows.has(r))addRow(r);
  for(const r of rows.keys())if(r<state.furthest-7)discardRow(r);
}

function playTone(frequency=430,length=.065) {
  if(!soundOn)return;
  try {audio??=new AudioContext();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(frequency,audio.currentTime);o.frequency.exponentialRampToValueAtTime(frequency*.72,audio.currentTime+length);g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+length);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+length);}catch{/* Audio is optional. */}
}
function refreshHUD() {
  $('#hops-value').textContent=state.hops;$('#suya-value').textContent=state.suya;
  $('#market-value').textContent=MARKETS[state.market][0];$('#stage-value').textContent=`${String(state.market+1).padStart(2,'0')} / 19`;
  $('#best-value').textContent=`${state.best} hops`;
  document.querySelectorAll('#market-route li').forEach((li,i)=>li.classList.toggle('current',i===state.market));
  // These canvas attributes also make current movement and score inspectable to assistive tools.
  canvas.dataset.row=state.row;canvas.dataset.column=state.column;canvas.dataset.screen=state.screen;
}
function startRun() {
  for(const r of [...rows.keys()])discardRow(r);
  Object.assign(state,{screen:'playing',row:0,column:0,furthest:0,hops:0,suya:0,market:0,hop:null,queued:null,pointerTarget:null,bannerUntil:0});
  player.position.set(0,0,0);player.rotation.set(0,Math.PI,0);cameraZ=-1;
  ensureWorld();
  for(const id of ['title-overlay','gameover-overlay','pause-overlay','stage-banner'])$('#'+id).classList.add('hidden');
  $('#move-hint').classList.remove('hidden');$('#touch-controls').classList.remove('hidden');
  $('#pause-button').textContent='Ⅱ';$('#pause-button').setAttribute('aria-label','Pause game');
  refreshHUD();canvas.focus();playTone();
}
function move(direction) {
  if(state.screen!=='playing')return;
  if(state.hop){state.queued=direction;return;}
  const dx=direction==='left'?-1:direction==='right'?1:0,drow=direction==='up'?1:direction==='down'?-1:0;
  const column=state.column+dx,row=state.row+drow;
  if(column<-BOUND||column>BOUND||row<Math.max(0,state.furthest-5)||obstacles.some(o=>o.row===row&&o.column===column)) {playTone(160);state.pointerTarget=null;return;}
  state.hop={from:player.position.clone(),to:new THREE.Vector3(column*STEP_X,0,-row*STEP_Z),time:0,duration:drow?.23:.19,row,column};
  player.rotation.y=dx>0?Math.PI/2:dx<0?-Math.PI/2:drow>0?Math.PI:0;
  playTone(350+random(row,column)*110);
}
function finishRun(reason) {
  if(state.screen!=='playing')return;state.screen='gameover';state.hop=null;state.queued=null;state.pointerTarget=null;
  state.best=Math.max(state.best,state.hops);localStorage.setItem('lagos-market-run-best-3d',state.best);
  $('#gameover-title').textContent=reason==='eyo'?'Give Eyo some space!':'Mind the '+reason+'!';
  $('#final-hops').textContent=state.hops;$('#final-suya').textContent=state.suya;
  $('#save-message').textContent=signedIn?'Saving your market run…':'Best saved on this device. Sign in for the global board.';
  $('#gameover-overlay').classList.remove('hidden');$('#move-hint').classList.add('hidden');$('#touch-controls').classList.add('hidden');$('#stage-banner').classList.add('hidden');
  player.rotation.z=-.35;playTone(120,.25);refreshHUD();saveScore();
}
function togglePause() {
  if(state.screen==='playing'){state.screen='paused';$('#pause-overlay').classList.remove('hidden');$('#pause-button').setAttribute('aria-label','Resume game');$('#pause-button').textContent='▶';}
  else if(state.screen==='paused'){state.screen='playing';$('#pause-overlay').classList.add('hidden');$('#pause-button').setAttribute('aria-label','Pause game');$('#pause-button').textContent='Ⅱ';canvas.focus();}
  refreshHUD();
}
function enterMarket() {
  const next=Math.min(18,Math.floor(state.furthest/20));
  if(next===state.market)return;state.market=next;state.bannerUntil=state.time+2.6;
  $('#stage-name').textContent=MARKETS[next][0];$('#stage-banner').classList.remove('hidden');playTone(740,.15);
}
function update(delta) {
  const animated=state.screen==='playing'||state.screen==='ready';
  if(animated) {
    state.time+=delta;
    for(const vehicle of vehicles) {
      vehicle.obj.position.x+=vehicle.direction*vehicle.speed*delta;
      if(vehicle.obj.position.x>32)vehicle.obj.position.x=-32;
      if(vehicle.obj.position.x<-32)vehicle.obj.position.x=32;
      for(const wheel of vehicle.obj.userData.wheels)wheel.rotation.y+=delta*vehicle.speed;
    }
    for(const w of walkers){w.obj.position.x+=w.direction*w.speed*delta;if(Math.abs(w.obj.position.x)>9)w.direction*=-1;w.obj.rotation.z=Math.sin(state.time*4)*.035;}
    for(const c of collectibles)if(!c.collected){c.obj.rotation.y=state.time*.65;c.obj.position.y=.25+Math.sin(state.time*3+c.row)*.07;}
  }
  if(state.screen==='playing') {
    if(state.hop) {
      const hop=state.hop;hop.time+=delta;const t=Math.min(1,hop.time/hop.duration),smooth=t*t*(3-2*t);
      player.position.lerpVectors(hop.from,hop.to,smooth);player.position.y=Math.sin(t*Math.PI)*.46;
      const swing=Math.sin(t*Math.PI*2)*.6;limbs.leftLeg.rotation.x=swing;limbs.rightLeg.rotation.x=-swing;limbs.leftArm.rotation.x=-swing;limbs.rightArm.rotation.x=swing;
      limbs.leftArm.rotation.z=-Math.sin(t*Math.PI)*.3;limbs.rightArm.rotation.z=Math.sin(t*Math.PI)*.3;
      if(t===1) {
        state.row=hop.row;state.column=hop.column;state.hop=null;
        state.furthest=Math.max(state.furthest,state.row);state.hops=state.furthest;
        for(const limb of Object.values(limbs))limb.rotation.set(0,0,0);
        if(state.hops>=3)$('#move-hint').classList.add('hidden');
        enterMarket();ensureWorld();refreshHUD();
      }
    }
    // Collision uses actual 3D ground positions, including during a hop.
    for(const v of vehicles)if(Math.abs(v.obj.position.z-player.position.z)<.7&&Math.abs(v.obj.position.x-player.position.x)<v.length/2+.2){finishRun(v.obj.userData.kind);break;}
    if(state.screen==='playing')for(const w of walkers)if(Math.abs(w.obj.position.z-player.position.z)<.65&&Math.abs(w.obj.position.x-player.position.x)<.65){finishRun('eyo');break;}
    if(state.screen==='playing') {
      for(const c of collectibles)if(!c.collected&&Math.abs(c.obj.position.z-player.position.z)<.65&&Math.abs(c.obj.position.x-player.position.x)<.65){c.collected=true;c.obj.visible=false;state.suya++;playTone(900,.11);refreshHUD();}
      if(!state.hop) {
        if(state.queued){const next=state.queued;state.queued=null;move(next);}
        else if(state.pointerTarget) {
          const target=state.pointerTarget;
          if(target.column!==state.column)move(target.column>state.column?'right':'left');
          else if(target.row!==state.row)move(target.row>state.row?'up':'down');
          else state.pointerTarget=null;
        }
      }
    }
    if(state.bannerUntil&&state.time>state.bannerUntil){$('#stage-banner').classList.add('hidden');state.bannerUntil=0;}
  }
  if(state.screen==='ready') { player.position.y=Math.sin(state.time*2)*.025; }
  const desiredZ=-state.furthest*STEP_Z+(state.screen==='ready'?6:-4.2);
  cameraZ=THREE.MathUtils.damp(cameraZ,desiredZ,5,delta);
  camera.position.set(8.8,16,cameraZ+21);camera.lookAt(0,0,cameraZ);
  sun.position.set(-12,22,cameraZ+10);sun.target.position.set(0,0,cameraZ);sun.target.updateMatrixWorld();
}
function resize() {
  const width=innerWidth,height=innerHeight,aspect=width/height;
  const viewHeight=aspect<.8?27:aspect>1.8?19:23;
  camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
}
function frame(time) {
  const delta=Math.min(.035,(time-previousTime)/1000||0);previousTime=time;
  update(delta);renderer.render(scene,camera);requestAnimationFrame(frame);
}

// Shared start.ng identity and scores; all origin and frame checks are retained.
function connectFrame() {
  framePromise??=new Promise((resolve,reject)=>{const iframe=document.createElement('iframe');iframe.src=START_NG+'/connect';iframe.hidden=true;iframe.onload=()=>resolve(iframe);iframe.onerror=reject;document.body.append(iframe);});return framePromise;
}
async function askStartNg(message,replyType) {
  try {
    const iframe=await connectFrame();return await new Promise(resolve=>{
      const requestId=Math.random().toString(36).slice(2);
      const done=reply=>{clearTimeout(timer);removeEventListener('message',onMessage);resolve(reply);};
      function onMessage(event){if(event.origin===START_NG&&event.source===iframe.contentWindow&&event.data?.type===replyType&&event.data.requestId===requestId)done(event.data);}
      const timer=setTimeout(()=>done(null),3000);addEventListener('message',onMessage);iframe.contentWindow.postMessage({...message,requestId},START_NG);
    });
  }catch{return null;}
}
async function loadIdentity() {
  const reply=await askStartNg({type:'startng:whoami'},'startng:user');const next=reply?.user??reply?.guest;
  if(next){identity=next;signedIn=!!reply.user;updatePlayer();}
  $('#player-name').textContent=identity.name||'Guest';$('#player-account').textContent=signedIn?'@'+identity.account:'Market explorer';
  if(identity.face)$('#player-face').src=identity.face;
  else $('#player-face').src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#f6c928"/><circle cx="40" cy="38" r="20" fill="#8d5524"/><ellipse cx="40" cy="22" rx="23" ry="14" fill="#17120f"/><path d="M12 80V68Q40 45 68 68V80" fill="#f7b731"/></svg>');
  $('#sign-in-button').hidden=signedIn;
  $('#welcome').textContent=signedIn?`Welcome, ${identity.name}! Let's hit the market.`:'Your market adventure starts here.';
}
async function saveScore() {
  if(!signedIn)return;
  const result=await askStartNg({type:'startng:score',stats:{distance:Math.round(state.hops*12.5),lanterns:state.suya}},'startng:scoreSaved');
  $('#save-message').textContent=result?.ok?`Best run saved. You're #${result.result?.rank??'—'} on the board.`:'Run saved on this device. The global board is unavailable.';
}
async function loadLeaderboard() {
  const list=$('#leaderboard-list');list.replaceChildren();const loading=document.createElement('li');loading.textContent='Loading the legends…';list.append(loading);
  try {const response=await fetch(`${API}/games/${GAME_NAME}/leaderboard?limit=8`);if(!response.ok)throw Error('Board unavailable');const entries=await response.json();
    list.replaceChildren(...entries.map(entry=>{const li=document.createElement('li'),name=document.createElement('span'),score=document.createElement('strong');name.textContent=`#${entry.rank} ${entry.name}`;score.textContent=`${entry.stats?.distance??entry.score??0}m · ${entry.stats?.lanterns??0} suya`;li.append(name,score);return li;}));
    if(!entries.length){loading.textContent='Be the first Lagos market legend.';list.append(loading);}
  }catch{loading.textContent='The board is taking a market break. Try again.';}
}

const keyMap={ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};
window.addEventListener('keydown',event=>{
  if(document.querySelector('dialog[open]'))return;
  const key=event.key.length===1?event.key.toLowerCase():event.key;
  if(keyMap[key]){event.preventDefault();state.pointerTarget=null;move(keyMap[key]);}
  else if(key==='p'||key==='Escape'){event.preventDefault();togglePause();}
  else if(key==='Enter'&&(state.screen==='ready'||state.screen==='gameover'))startRun();
},{capture:true});
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0),intersection=new THREE.Vector3();
let pointerStart=null;
canvas.addEventListener('pointerdown',event=>{canvas.focus();pointerStart={x:event.clientX,y:event.clientY};});
canvas.addEventListener('pointerup',event=>{
  if(!pointerStart||state.screen!=='playing'){pointerStart=null;return;}
  const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;pointerStart=null;
  if(Math.max(Math.abs(dx),Math.abs(dy))>24){state.pointerTarget=null;move(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy<0?'up':'down');return;}
  const rect=canvas.getBoundingClientRect();mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);
  if(raycaster.ray.intersectPlane(ground,intersection)) {
    const column=Math.max(-BOUND,Math.min(BOUND,Math.round(intersection.x/STEP_X))),row=Math.max(Math.max(0,state.furthest-5),Math.min(state.row+4,Math.round(-intersection.z/STEP_Z)));
    state.pointerTarget={column,row};
  }
});
canvas.addEventListener('pointercancel',()=>{pointerStart=null;});
for(const b of document.querySelectorAll('[data-move]'))b.addEventListener('pointerdown',event=>{event.preventDefault();state.pointerTarget=null;move(b.dataset.move);});
$('#start-button').onclick=startRun;$('#restart-button').onclick=startRun;$('#pause-button').onclick=togglePause;$('#resume-button').onclick=togglePause;
$('#home-button').onclick=()=>{state.screen='ready';state.hop=null;player.rotation.set(0,0,0);$('#gameover-overlay').classList.add('hidden');$('#title-overlay').classList.remove('hidden');refreshHUD();};
$('#sound-button').onclick=()=>{soundOn=!soundOn;$('#sound-button').textContent=soundOn?'♫':'♪';$('#sound-button').setAttribute('aria-label',soundOn?'Mute sound':'Unmute sound');$('#sound-button').style.opacity=soundOn?1:.55;};
$('#sign-in-button').onclick=()=>{location.href=`${START_NG}/?return_to=${encodeURIComponent(location.origin+location.pathname)}`;};
let resumeAfterDialog=false;
for(const b of document.querySelectorAll('[data-open]'))b.onclick=()=>{resumeAfterDialog=state.screen==='playing';if(resumeAfterDialog)togglePause();$('#'+b.dataset.open).showModal();if(b.dataset.open==='board-dialog')loadLeaderboard();};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',()=>{if(resumeAfterDialog&&state.screen==='paused')togglePause();resumeAfterDialog=false;});
$('#refresh-board').onclick=loadLeaderboard;
MARKETS.forEach(m=>{const li=document.createElement('li');li.textContent=m[0];$('#market-route').append(li);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(state.screen==='playing')togglePause();}else loadIdentity();});
window.addEventListener('focus',loadIdentity);window.addEventListener('resize',resize);
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(state.screen==='playing')togglePause();$('#render-error').textContent='The 3D view was interrupted. Reload the page to reopen the market.';$('#render-error').classList.remove('hidden');});
updatePlayer();ensureWorld();resize();refreshHUD();loadIdentity();$('#loading').classList.add('hidden');requestAnimationFrame(frame);

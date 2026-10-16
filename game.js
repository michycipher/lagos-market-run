import * as THREE from './vendor/three.module.js';
import { MarketAudio } from './market-audio.js?v=market-run3';

const START_NG = 'https://start.ng';
const API = 'https://api.start.ng';
const GAME_NAME = location.hostname.endsWith('.start.ng') ? location.hostname.split('.')[0] : 'lagos-market-run';
const $ = (selector) => document.querySelector(selector);
const MARKETS = [
  ['Balogun Market','ANKARA, SHOES & BAGS','#d45532',['clothes','shoes','bags','clothes']],
  ['Mushin Market','FOODSTUFF & PROVISIONS','#1d8d78',['onions','meat','grains','tomatoes']],
  ['Yaba Market','OKRIKA & SNEAKERS','#336dba',['clothes','shoes','books','bags']],
  ['Tejuosho Market','MALL, FABRICS & OKRIKA','#a251a0',['clothes','bags','shoes','clothes']],
  ['Oyingbo Market','FOODSTUFF & FRESH FISH','#d57329',['meat','fish','grains','onions']],
  ['Oshodi Market','CLOTHES & EVERYDAY FINDS','#238d72',['shoes','clothes','bags','tomatoes']],
  ['Mile 12 Market','TOMATOES, PEPPER & ONIONS','#c44e2f',['tomatoes','peppers','onions','yam']],
  ['Computer Village','PHONES & GADGETS','#297b9a',['phones','laptops','phones','speakers']],
  ['Ladipo Market','MOTOR SPARE PARTS','#bd792c',['tyres','engines','batteries','tyres']],
  ['Alaba International','ELECTRONICS & APPLIANCES','#2c907b',['televisions','speakers','laptops','televisions']],
  ['Idumota Market','TEXTILES & WHOLESALE','#934c80',['clothes','bags','provisions','shoes']],
  ['Jankara Market','ADIRE, HERBS & BEADS','#bd6b30',['clothes','herbs','beads','herbs']],
  ['Epe Fish Market','FRESH & SMOKED FISH','#327da1',['fish','fish','crabs','fish']],
  ['Ajah Market','FRESH FOOD & PROVISIONS','#de7540',['tomatoes','onions','provisions','meat']],
  ['Ikotun Market','PROVISIONS & HOUSEHOLD','#42835c',['provisions','grains','clothes','onions']],
  ['Igando Market','GRAINS & FRESH PRODUCE','#a9613b',['grains','yam','peppers','tomatoes']],
  ['Lekki Market','ART, CRAFTS & BEADS','#218b86',['art','baskets','beads','art']],
  ['Agbalata Market','BADAGRY FOOD & BASKETS','#cf7a36',['fish','grains','baskets','yam']],
  ['Sangotedo Market','FRESH FOOD & SUYA','#a76135',['meat','peppers','provisions','onions']]
];
const LANE_WIDTH=2.25, SEGMENT_LENGTH=16, STAGE_LENGTH=250, WATER_PRICE=20;
const state={screen:'ready',distance:0,lane:0,suya:0,money:0,water:0,market:0,time:0,speed:6.6,stride:0,lastFoot:0,bannerUntil:0,
  best:Number(localStorage.getItem('lagos-market-run-best-distance')||0)};
let identity={name:'Guest',style:{}},signedIn=false;
const soundtrack=new MarketAudio();
let framePromise,player,limbs,cameraZ=4,previousTime=0,lastHud=-1;
const rows=new Map(),vehicles=[],traders=[],collectibles=[],moneyDrops=[],waterHawkers=[],obstacles=[],shopkeepers=[];
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
  // Face looks toward local +Z; the runner faces down the market aisle.
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
  const g=new THREE.Group();
  // Eyo is kept in the traditional all-white masquerade palette: flowing robe,
  // covered face and tall white crown, with only dark mask details and a wood staff.
  const robe=cylinder(g,.38,.7,1.8,'#f8f3e6',0,.92,0,12);robe.scale.z=.72;
  for(const x of [-.36,.36]){const hem=box(g,.25,.1,.55,'#d8ccb3',x,.1,0);hem.rotation.z=x<0?.12:-.12;}
  const veil=sphere(g,.4,'#fffaf0',0,1.76,0,.9,1.2,.8);
  const mask=box(g,.48,.52,.18,'#fffdf5',0,1.75,.16);mask.rotation.z=.02;
  box(g,.32,.08,.04,'#282620',0,1.89,.27);
  const eyes=[];for(const x of [-.11,.11])eyes.push(sphere(g,.043,'#171713',x,1.82,.27,1,.8,.65));
  const mouth=box(g,.2,.06,.04,'#28231e',0,1.63,.28);mouth.rotation.z=-.05;
  // A tall white crowned headdress makes Eyo readable while staying natural.
  cylinder(g,.52,.38,.12,'#fffaf0',0,2.08,0,12);cylinder(g,.33,.16,.5,'#f5eedf',0,2.35,0,10);
  for(const x of [-.22,0,.22]){const spike=cylinder(g,0,.09,.42,'#eee4d1',x,2.67,0,5);spike.rotation.z=x*.55;}
  const staff=cylinder(g,.035,.055,2.6,'#5b3b27',.62,1.24,0,8);staff.rotation.z=-.2;
  const staffTop=sphere(g,.14,'#d2a64d',.84,2.52,0,.8,1.25,.8);
  const arms=[];for(const x of [-.34,.34]){const arm=cylinder(g,.08,.12,.82,'#f8f3e6',x,1.25,0);arm.rotation.z=x<0?.95:-.95;arms.push(arm);}
  g.userData.scare={robe,veil,eyes,arms,staff,staffTop,mouth};
  g.scale.setScalar(1.05);
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
function makeMoney() {
  const g=new THREE.Group();const coin=cylinder(g,.25,.25,.07,'#f1bf36',0,.15,0,16);coin.rotation.x=Math.PI/2;
  const inner=ring(g,.15,.025,'#fff0a8',0,.19,.04);inner.rotation.x=Math.PI/2;
  sign(g,'₦',0,.23,.055,.4,'#f1bf36');return g;
}
function makeWaterHawker() {
  const g=createCharacter({body:'female',primaryColor:'#e2a52e',secondaryColor:'#2b6583',hair:'bun'},.9);
  const tray=box(g,1.05,.13,.7,'#e4d9bb',0,2.14,0);tray.rotation.z=.02;
  for(let i=0;i<5;i++){const bag=box(g,.14,.28,.12,i%2?'#9bd8e8':'#d5f4f0',-.4+i*.2,2.34,0);bag.rotation.z=(i-2)*.08;}
  g.userData.goods='pure-water';return g;
}
function addMoneyDrop(index,z,lane) {
  const obj=makeMoney();obj.position.set(lane*LANE_WIDTH,.34,z);world.add(obj);
  moneyDrops.push({obj,segment:index,z,lane,collected:false,value:20});
}
function addWaterHawker(index,z,lane) {
  const side=index%2?-1:1,obj=makeWaterHawker();obj.position.set(side*4.9,0,z);obj.rotation.y=side<0?Math.PI/2:-Math.PI/2;world.add(obj);
  const marker=new THREE.Group();sign(marker,'PURE WATER ₦20',lane*LANE_WIDTH,2.7,z,2.7,'#aee6e9');marker.visible=false;world.add(marker);
  waterHawkers.push({obj,segment:index,z,lane,side,from:side*4.9,target:lane*LANE_WIDTH,phase:0,warning:false,bought:false,marker});
}
function barrel(parent,x,z) {
  cylinder(parent,.39,.39,.95,'#297f9d',x,.5,z,12);
  cylinder(parent,.41,.41,.09,'#226c87',x,.17,z,12);cylinder(parent,.41,.41,.09,'#226c87',x,.78,z,12);
  cylinder(parent,.29,.29,.035,'#194b5d',x,1,z,12);
}
function tree(parent,x,z) {
  cylinder(parent,.1,.15,2,'#785333',x,1,z,7);sphere(parent,1,'#63833b',x,2.5,z,1,.8,1);
  sphere(parent,.7,'#7c9647',x+.4,2.85,z-.2);
}
function random(index,salt=0) { const v=Math.sin(index*127.1+salt*311.7+42.3)*43758.5453;return v-Math.floor(v); }
let lastShout=-99;
function shout(text,gap=2.2) {
  if(state.time<lastShout+gap)return;
  lastShout=state.time;soundtrack.voice(text,{rate:1.18,pitch:.96});
}
const shopNames={clothes:['MAMA TITI ANKARA','LACE & ASO EBI','BISI TEXTILES'],shoes:['CHIKA SHOES','SNEAKER CORNER'],bags:['BOLA BAGS','LEATHER HOUSE'],
  onions:['ALHAJA ONIONS'],tomatoes:['FRESH TOMATOES'],peppers:['ATA RODO'],meat:['BABA BUTCHER','SUYA SPOT'],grains:['RICE, BEANS & GARRI'],fish:['EJA TUTU','FRESH FISH'],yam:['YAM DEPOT'],
  phones:['PHONE PLAZA'],laptops:['LAPTOP REPAIRS'],speakers:['SOUND & SOLAR'],televisions:['TV & ELECTRONICS'],tyres:['TOKUNBO TYRES'],engines:['ENGINE SPARES'],batteries:['BATTERY DEPOT'],
  books:['BOOKS & MORE'],provisions:['MAMA PUT PROVISIONS'],herbs:['HERBS & SPICES'],beads:['ILEKE BEADS'],art:['WOOD & ADIRE ART'],baskets:['HANDWOVEN BASKETS'],crabs:['FRESH CRABS']};
function ring(parent,r,t,color,x,y,z) { const obj=mesh(parent,geometry(`torus:${r},${t}`,()=>new THREE.TorusGeometry(r,t,6,12)),color,x,y,z);return obj; }
function basket(parent,x,y,z,type='tomatoes') {
  const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
  cylinder(g,.48,.36,.38,'#9e6d3d',0,.19,0,10);
  for(let band=0;band<3;band++){const r=ring(g,.4+band*.022,.022,'#d2a362',0,.09+band*.13,0);r.rotation.x=Math.PI/2;}
  if(type==='grains') {cylinder(g,.46,.4,.1,'#e0c890',0,.41,0,12);for(let i=0;i<7;i++)sphere(g,.07,'#e8d6ab',Math.cos(i*2.4)*.27,.46,Math.sin(i*2.4)*.27,1,.35,1);return;}
  const color=type==='onions'?'#b66e91':type==='peppers'?'#da3825':type==='herbs'?'#518b35':'#dc4b2e';
  for(let i=0;i<9;i++){const a=i*2.4,px=Math.cos(a)*.27,pz=Math.sin(a)*.27,py=.4+(i>5?.13:0);
    const produce=sphere(g,.14,color,px,py,pz,type==='peppers'?.55:1,type==='peppers'?1.6:.92,type==='peppers'?.55:1);
    if(type==='peppers')produce.rotation.z=.8;
    cylinder(g,.015,.023,.07,type==='onions'?'#dbc49b':'#36733b',px,py+.13,pz,5);
  }
}
function shirt(parent,x,y,z,color,pattern=false) {
  box(parent,.44,.55,.1,color,x,y,z);for(const side of [-1,1]){const sleeve=box(parent,.22,.22,.11,color,x+side*.27,y+.15,z);sleeve.rotation.z=side*.45;}
  cylinder(parent,.07,.07,.05,'#e8d1a7',x,y+.29,z,8);
  if(pattern)for(let i=0;i<6;i++)box(parent,.055,.06,.015,i%2?'#edc84f':'#234d58',x-.13+(i%3)*.13,y-.12+Math.floor(i/3)*.18,z+.06);
}
function merchandise(parent,type,variant=0) {
  const g=new THREE.Group();parent.add(g);g.userData.goods=type;
  const colours=['#d24f35','#236e87','#dea62a','#4c916c','#9c4c9a','#ede0b6'];
  if(type==='clothes') {
    for(const x of [-1.1,1.1]){cylinder(g,.035,.035,2,'#6a6458',x,1.1,.65);box(g,.38,.05,.38,'#6a6458',x,.1,.65);}
    const rail=cylinder(g,.035,.035,2.3,'#6a6458',0,2.08,.65);rail.rotation.z=Math.PI/2;
    for(let i=0;i<4;i++){shirt(g,-.84+i*.56,1.58,.68,colours[(i+variant)%6],true);const hanger=ring(g,.055,.012,'#ae9d83',-.84+i*.56,1.99,.68);}
    for(let i=0;i<5;i++)cylinder(g,.12,.12,.7,colours[(i+variant)%6],-.85+i*.4,.73,-.22,10);
  } else if(type==='shoes') {
    for(let shelf=0;shelf<3;shelf++) {box(g,2.45,.08,.65,'#754c31',0,.45+shelf*.5,.15);
      for(let i=0;i<4;i++){const x=-.85+i*.57,y=.54+shelf*.5;box(g,.31,.06,.46,'#e5d5b2',x,y,.15);sphere(g,.17,colours[(i+variant+shelf)%6],x,y+.12,.12,.85,.65,1.2);}}
  } else if(type==='bags') {
    for(let shelf=0;shelf<2;shelf++){box(g,2.5,.1,.55,'#885333',0,.6+shelf*.78,.2);
      for(let i=0;i<4;i++){const x=-.88+i*.58,y=.86+shelf*.78;box(g,.4,.42,.21,colours[(i+shelf+variant)%6],x,y,.2);ring(g,.11,.025,'#69452f',x,y+.28,.2);box(g,.055,.06,.02,'#edc653',x,y,.317);}}
  } else if(['tomatoes','onions','peppers','grains','herbs'].includes(type)) {
    for(let i=0;i<3;i++)basket(g,-.85+i*.85,.28,.38,type);box(g,2.8,.32,.85,'#895838',0,.2,.38);
    for(let i=0;i<2;i++)basket(g,-.55+i*1.1,0,1.1,type);
  } else if(type==='meat') {
    box(g,2.6,.15,1,'#9c653e',0,.8,.3);box(g,1,.08,.6,'#ddbc83',.6,.92,.3);
    for(let i=0;i<4;i++)sphere(g,.19,'#9e4b37',-.9+i*.4,1,.3,1.2,.5,1);
    const rail=box(g,2.5,.06,.06,'#797568',0,2.05,.12);
    for(let i=0;i<3;i++){cylinder(g,.016,.016,.3,'#888779',-.8+i*.8,1.87,.12);sphere(g,.2,'#ad5c42',-.8+i*.8,1.55,.12,.8,1.6,.9);}
    const grill=box(g,1.05,.55,.7,'#383a32',-.55,.5,1.1);for(let i=0;i<5;i++)box(g,.04,.035,.7,'#b4a17b',-.95+i*.19,.8,1.1);
    for(let i=0;i<3;i++)sphere(g,.08,'#d17b36',-.85+i*.3,.84,1.1,1.3,.6,.6);
  } else if(type==='fish'||type==='crabs') {
    box(g,2.55,.18,.95,'#87b7b9',0,.72,.3);box(g,2.35,.04,.8,'#e3e3cd',0,.83,.3);
    for(let i=0;i<5;i++){const x=-.9+i*.45;sphere(g,.16,type==='fish'?'#68888b':'#c06437',x,.96,.28,1.4,.45,.7);
      if(type==='fish'){const tail=cylinder(g,0,.13,.18,'#68888b',x-.27,.96,.28,3);tail.rotation.z=Math.PI/2;sphere(g,.02,'#222b29',x+.16,1,.34);}
      else for(const side of [-1,1])for(let j=0;j<2;j++){const leg=box(g,.14,.02,.02,'#b9572f',x+side*.2,.92,.2+j*.16);leg.rotation.y=side*.6;}}
  } else if(type==='yam') {
    for(let i=0;i<9;i++){const tuber=sphere(g,.16,'#927043',-.9+(i%5)*.43,.2+Math.floor(i/5)*.22,.4+(i%2)*.2,1,1,2.3);tuber.rotation.x=1.2;}
  } else if(['phones','laptops','televisions','speakers'].includes(type)) {
    box(g,2.6,.12,.9,'#6e6755',0,.65,.25);
    if(type==='speakers'){for(const x of [-.75,.75]){box(g,.6,1.3,.5,'#252c2b',x,1.3,.2);for(const y of [.98,1.54])cylinder(g,.17,.17,.055,'#607077',x,y,.48).rotation.x=Math.PI/2;}}
    else if(type==='televisions'){box(g,2,1.13,.12,'#202d32',0,1.4,.3);box(g,1.8,.92,.02,'#337e92',0,1.4,.375);box(g,.5,.05,.35,'#2a3334',0,.8,.3);}
    else for(let i=0;i<4;i++){const x=-.85+i*.57;box(g,.4,type==='phones'?.62:.38,.06,'#252f35',x,1.05,.25);box(g,.33,type==='phones'?.51:.3,.02,'#4aa3b4',x,1.05,.29);if(type==='laptops')box(g,.45,.035,.4,'#8f9da0',x,.85,.46);}
  } else if(type==='tyres') {
    for(let i=0;i<4;i++){const tyre=ring(g,.35,.12,'#30322e',-.9+(i%2)*1.05,.5+Math.floor(i/2)*.65,.3);tyre.rotation.y=i*.12;}
  } else if(type==='engines'||type==='batteries') {
    box(g,2.5,.15,1,'#745438',0,.6,.25);for(let i=0;i<3;i++){box(g,.55,.5,.45,type==='engines'?'#7c8482':'#323e39',-.8+i*.8,.93,.2);box(g,.36,.08,.28,'#ceab3e',-.8+i*.8,1.22,.2);if(type==='engines')for(let j=0;j<3;j++)cylinder(g,.06,.06,.3,'#b4b6a8',-.96+i*.8+j*.15,1.35,.2);}
  } else if(type==='beads') {
    box(g,2.4,.08,.6,'#81573a',0,.7,.25);for(let i=0;i<5;i++){const necklace=ring(g,.19,.045,colours[i],-.95+i*.46,1.2,.3);}
  } else if(type==='art') {
    for(let i=0;i<3;i++){const x=-.85+i*.85;box(g,.7,1.2,.08,'#77472c',x,1,.25);box(g,.57,1.04,.02,colours[(i+variant)%6],x,1,.31);sphere(g,.19,'#e3bd69',x,1.15,.34,1,1.7,.08);}
  } else if(type==='baskets') {
    for(let i=0;i<5;i++){const x=-.9+(i%3)*.85,z=.2+Math.floor(i/3)*.7;cylinder(g,.32,.23,.54,'#b58a4d',x,.3,z,10);const r=ring(g,.34,.03,'#e0be79',x,.57,z);r.rotation.x=Math.PI/2;}
  } else {
    for(let shelf=0;shelf<3;shelf++){box(g,2.5,.08,.5,'#87673d',0,.45+shelf*.45,.2);for(let i=0;i<6;i++)box(g,.28,.34,.25,colours[(i+shelf+variant)%6],-1.05+i*.41,.65+shelf*.45,.2);}
  }
  return g;
}
function stall(parent,side,z,index,slot) {
  const g=new THREE.Group();g.position.set(side*6.6,0,z);g.rotation.y=side<0?.58:-.58;parent.add(g);
  const market=MARKETS[Math.min(18,Math.floor(Math.max(0,index*SEGMENT_LENGTH-z)/STAGE_LENGTH))];
  const variant=index*2+slot+(side>0?1:0),type=market[3][((variant%4)+4)%4];g.userData.goods=type;
  const wall=['#b69362','#a96b46','#d6bb87'][Math.abs(variant)%3];
  box(g,3.5,2.8,.18,wall,0,1.4,-.6);box(g,3.5,.2,2.1,market[2],0,2.9,.2);
  for(let i=0;i<6;i++){box(g,.25,.08,2.1,'#ecd5a5',-1.5+i*.6,3.02,.2);}
  for(const x of [-1.65,1.65])box(g,.09,2.8,.09,'#755036',x,1.4,1.05);
  sign(g,shopNames[type][Math.abs(variant)%shopNames[type].length],0,2.5,1.12,3.3);
  merchandise(g,type,Math.abs(variant));
  const keeper=createCharacter({body:variant%2?'female':'male',primaryColor:['#d97735','#1c8d78','#a44768'][Math.abs(variant)%3],secondaryColor:'#454335',hair:variant%2?'bun':'short'},.86);
  keeper.position.set(1.2,0,.3);g.add(keeper);shopkeepers.push({obj:keeper,segment:index,phase:random(index,slot+3)*6});
  if(variant%3===0){const umbrella=cylinder(g,0,1.4,.45,market[2],0,3.3,1.5,8);cylinder(g,.035,.035,3.1,'#68523a',0,1.5,1.5);}
}
function makeCart(goods='clothes') {
  const g=new THREE.Group();box(g,1.1,.48,1.15,'#8a5a34',0,.55,0);for(const x of [-.51,.51])for(const z of [-.4,.4]){const w=cylinder(g,.18,.18,.1,'#2f332c',x,.24,z);w.rotation.z=Math.PI/2;}
  for(let i=0;i<3;i++){box(g,.8,.16,.7,['#d56c37','#3e8994','#d6b65f'][i],0,.86+i*.16,0);}
  for(const x of [-.45,.45])box(g,.045,.5,.045,'#5f4c38',x,.9,.7);
  return g;
}
function addBlocker(index,z,lane,kind='cart') {
  const stage=Math.min(18,Math.floor(-z/STAGE_LENGTH));let obj;
  if(kind==='trader') {
    const side=lane<0?-1:lane>0?1:index%2?-1:1;
    obj=createCharacter({body:index%2?'female':'male',primaryColor:index%2?'#ae487a':'#2c8a88',secondaryColor:'#b28b48',hair:index%2?'bun':'short'});
    const goods=MARKETS[stage][3][index%4];
    if(goods==='clothes')shirt(obj,0,1.05,.42,'#dc8e33',true);
    else if(goods==='bags'){box(obj,.5,.35,.25,'#ae693d',0,1,.4);ring(obj,.13,.025,'#69452d',0,1.25,.4);}
    else {const tray=box(obj,.7,.1,.4,'#b78c51',0,1.04,.37);for(let i=0;i<3;i++)sphere(obj,.09,goods==='onions'?'#b66e91':'#da4a2b',-.2+i*.2,1.15,.37);}
    obj.position.set(side*4.9,0,z);obj.rotation.y=side<0?Math.PI/2:-Math.PI/2;
    const marker=new THREE.Group();const light=cylinder(marker,.42,.42,.025,'#edbd39',lane*LANE_WIDTH,.02,z,12);world.add(marker);
    const call=goods==='clothes'?'FINE ANKARA!':goods==='shoes'?'TRY THESE SHOES!':goods==='bags'?'FINE BAGS!':'CUSTOMER, COME!';
    sign(marker,call,lane*LANE_WIDTH,2.65,z,2.5,'#fff0cb');marker.visible=false;
    obj.userData.goods=goods;traders.push({obj,segment:index,z,lane,side,from:side*4.9,target:lane*LANE_WIDTH,phase:0,warning:false,marker,swerve:index%3!==0});
  } else if(kind==='eyo') {obj=makeEyo();obj.position.set(lane*LANE_WIDTH,0,z);obstacles.push({obj,segment:index,z,lane,baseX:lane*LANE_WIDTH,width:.48,depth:.58,kind:'Eyo masquerade'});}
  else {obj=makeCart(MARKETS[stage][3][index%4]);obj.position.set(lane*LANE_WIDTH,0,z);obstacles.push({obj,segment:index,z,lane,width:.65,depth:.75,kind:'stock trolley'});}
  world.add(obj);return obj;
}
function tejuoshoScene(group,index) {
  // Tejuosho reads as a structured shopping complex behind the open-air stalls.
  if(index%2===0)for(const side of [-1,1]){
    const mall=new THREE.Group();mall.userData.kind='tejuosho-mall';mall.position.set(side*8.5,0,0);group.add(mall);
    box(mall,3.8,4.6,14,'#d9c4a5',0,2.3,0);box(mall,3.5,.18,13.8,'#b54e45',0,4.58,0);
    for(const floor of [1.45,3.1]){
      box(mall,3.5,.1,13.7,'#8e6d5c',0,floor,0);
      for(let i=0;i<5;i++){box(mall,.5,.78,.05,side<0?'#79b9bd':'#6ea2ad',-1.25+i*.62,floor+.48,7.08);box(mall,.5,.78,.05,side<0?'#79b9bd':'#6ea2ad',-1.25+i*.62,floor+.48,-7.08);}
    }
    for(const x of [-1.65,1.65])box(mall,.14,4.4,.14,'#6d5145',x,2.3,7.08);
    sign(mall,'TEJUOSHO MALL',0,4.05,7.16,3.2,'#f3c737');
  }
  if(index%4===0){
    const bridge=new THREE.Group();bridge.userData.kind='tejuosho-footbridge';bridge.position.set(-10.5,0,0);group.add(bridge);
    box(bridge,5.4,.42,1.25,'#d6c7ad',0,4.35,0);box(bridge,5.4,.12,1.25,'#7e5d4d',0,4.85,0);
    for(const x of [-2.35,-1.55,-.75,.05,.85,1.65,2.35])box(bridge,.08,.55,.08,'#735548',x,4.62,.52);
    box(bridge,.12,4.2,.12,'#6d5145',-2.55,2.1,0);box(bridge,.12,4.2,.12,'#6d5145',2.55,2.1,0);
    const leftSteps=box(bridge,1.35,1.2,1.1,'#a57958',-3.2,1.1,0);leftSteps.rotation.z=-.25;
    const rightSteps=box(bridge,1.35,1.2,1.1,'#a57958',3.2,1.1,0);rightSteps.rotation.z=.25;
    sign(bridge,'YABA FOOTBRIDGE',0,5.2,.68,2.7,'#f3c737');
  }
  if(index%2===0){
    for(const side of [-1,1]){box(group,3.2,.08,1.2,'#8a563a',side*5.15,1.18,2.8);box(group,.1,2.3,.1,'#594231',side*3.8,1.2,2.8);box(group,.1,2.3,.1,'#594231',side*6.5,1.2,2.8);}
    sign(group,'OUTSIDE MARKET',0,3.5,2.8,3.0,'#ef9b43');
  }
}
function addRoadCrossing(index,z) {
  const row=rows.get(index);if(row){
    box(row,9.3,.08,2.8,'#4f504c',0,.05,0);
    for(let x=-3.8;x<=3.8;x+=1.25)box(row,.62,.1,2.55,'#f0dfb0',x,.12,0);
    sign(row,'LOOK LEFT • LOOK RIGHT',0,2.35,1.55,3.2,'#f4d34f');
  }
  const obj=makeVehicle(index%2?'keke':'danfo',index%2?'#228f5b':'#edb91c');obj.position.set(-18,0,z);obj.rotation.y=0;world.add(obj);
  vehicles.push({obj,segment:index,speed:7.2+Math.min(3,state.market*.25),crossing:true});
  obstacles.push({obj,segment:index,z,lane:0,width:1.1,depth:1.35,kind:'road traffic',crossing:true});
}
function addRow(index) {
  const group=new THREE.Group();group.position.z=-index*SEGMENT_LENGTH;group.userData.index=index;world.add(group);rows.set(index,group);
  const stage=Math.min(18,Math.floor(Math.max(0,index*SEGMENT_LENGTH)/STAGE_LENGTH)),market=MARKETS[stage];
  const ground=box(group,80,.16,SEGMENT_LENGTH+.02,'#b68a57',0,-.12,0);ground.castShadow=false;
  const aisle=box(group,9,.14,SEGMENT_LENGTH+.02,index%2?'#c47d49':'#ce8751',0,-.07,0);aisle.castShadow=false;
  // Market paving and shop drainage define a continuous aisle, not road crossings.
  for(const side of [-1,1]){box(group,.16,.08,SEGMENT_LENGTH,'#8a7658',side*4.5,-.02,0);for(const z of [-6,-2,2,6])box(group,.22,.025,1.1,'#544f42',side*4.5,.03,z);}
  for(let z=-7;z<8;z+=2){const joint=box(group,8.7,.008,.025,'#b97a49',0,.008,z);joint.castShadow=false;}
  for(const side of [-1,1])for(let slot=0;slot<2;slot++)stall(group,side,-4+slot*8,index,slot);
  if(stage===3)tejuoshoScene(group,index);
  // Service road runs beside the shops. Vehicles never drive through the runner's aisle.
  box(group,4.2,.1,SEGMENT_LENGTH+.02,'#55534a',-12.7,-.04,0);box(group,.2,.12,SEGMENT_LENGTH,'#dec495',-10.5,.02,0);
  for(const z of [-6,0,6])box(group,.06,.018,2,'#e8d6ac',-12.7,.02,z);
  if(index%2===0){const obj=makeVehicle(index%2?'keke':'danfo',index%2?'#228f5b':'#edb91c');obj.position.set(-12.7,0,-index*SEGMENT_LENGTH);obj.rotation.y=Math.PI/2;world.add(obj);vehicles.push({obj,segment:index,speed:4.8+stage*.22});}
  if(index%5===0&&stage>=2){const obj=makeVehicle('danfo',index%3?'#d94d32':'#e8b51c');obj.position.set(-12.7,0,-index*SEGMENT_LENGTH-7);obj.rotation.y=Math.PI/2;world.add(obj);vehicles.push({obj,segment:index,speed:5.9+stage*.2});}
  if(index>6&&(index+stage)%7===0)addRoadCrossing(index,-index*SEGMENT_LENGTH);
  if(index%2===0){tree(group,10,-5);box(group,2.5,.6,1.5,'#b79b6d',10,.3,2);}
  if(index>=2){
    // Keep the opening seller on the left so the starting lane always has a clean pass.
    const lane=index===2?-1:Math.floor(random(index,2)*3)-1;
    const kind=index===2||random(index,4)<.52?'trader':index%7===0?'eyo':'cart';
    addBlocker(index,-index*SEGMENT_LENGTH-1,lane,kind);
    if(stage>=2||index%3===0){const lane2=lane===1?-1:1;addBlocker(index,-index*SEGMENT_LENGTH-1,lane2,index%5===0?'trader':'cart');}
  }
  const trailLane=index===0?0:Math.floor(random(index,7)*3)-1;
  for(let i=0;i<3;i++){const obj=makeSuya();const z=-index*SEGMENT_LENGTH-5-i*2.7;obj.position.set(trailLane*LANE_WIDTH,.34,z);world.add(obj);collectibles.push({obj,segment:index,z,lane:trailLane,collected:false});}
  if(index>0&&index%6===0)addMoneyDrop(index,-index*SEGMENT_LENGTH-7,Math.floor(random(index,17)*3)-1);
  if(index>3&&index%7===0)addWaterHawker(index,-index*SEGMENT_LENGTH-2,Math.floor(random(index,19)*3)-1);
  if(index%4===0){
    const g=new THREE.Group();g.position.set(0,0,0);group.add(g);
    // Shop-front signs stay beside the aisle; nothing spans or blocks the camera.
    box(g,.09,3.3,.09,'#6a5338',-4.7,1.65,4);
    const label=sign(g,market[0].toUpperCase(),-4.7,3.25,4,3.3);label.rotation.y=.3;
  }
}
function discardRow(index) {
  const group=rows.get(index);if(!group)return;
  group.traverse(obj=>{for(const t of obj.userData.textures||[])t.dispose();if(obj.material?.map)obj.material.dispose();});
  world.remove(group);rows.delete(index);
  for(const list of [vehicles,traders,collectibles,moneyDrops,waterHawkers,obstacles])for(let i=list.length-1;i>=0;i--)if(list[i].segment===index){world.remove(list[i].obj);if(list[i].marker){list[i].marker.traverse(o=>{for(const t of o.userData.textures||[])t.dispose();if(o.material?.map)o.material.dispose();});world.remove(list[i].marker);}list.splice(i,1);}
  for(let i=shopkeepers.length-1;i>=0;i--)if(shopkeepers[i].segment===index)shopkeepers.splice(i,1);
}
function ensureWorld() {
  const segment=Math.floor(state.distance/SEGMENT_LENGTH);
  for(let r=Math.max(-2,segment-2);r<=segment+5;r++)if(!rows.has(r))addRow(r);
  for(const r of rows.keys())if(r<segment-2)discardRow(r);
}

function refreshHUD() {
  $('#distance-value').textContent=Math.floor(state.distance);$('#suya-value').textContent=state.suya;$('#money-value').textContent=state.money;$('#water-value').textContent=state.water;
  $('#market-value').textContent=MARKETS[state.market][0];$('#stage-value').textContent=`${String(state.market+1).padStart(2,'0')} / 19`;
  $('#best-value').textContent=`${state.best}m`;
  document.querySelectorAll('#market-route li').forEach((li,i)=>li.classList.toggle('current',i===state.market));
  canvas.dataset.distance=state.distance.toFixed(1);canvas.dataset.lane=state.lane;canvas.dataset.screen=state.screen;
  canvas.dataset.music=soundtrack.running&&soundtrack.enabled?'playing':'paused';canvas.dataset.market=MARKETS[state.market][0];canvas.dataset.money=state.money;canvas.dataset.water=state.water;
  $('#sound-button').style.opacity=soundtrack.enabled?1:.5;
}
function startRun() {
  for(const r of [...rows.keys()])discardRow(r);
  Object.assign(state,{screen:'playing',distance:0,lane:0,suya:0,money:0,water:0,market:0,speed:6.6,stride:0,lastFoot:0,bannerUntil:0});
  lastShout=-99;
  player.position.set(0,0,0);player.rotation.set(0,Math.PI,0);cameraZ=-4;
  ensureWorld();
  for(const id of ['title-overlay','gameover-overlay','pause-overlay','stage-banner'])$('#'+id).classList.add('hidden');
  $('#move-hint').classList.remove('hidden');$('#touch-controls').classList.remove('hidden');
  $('#pause-button').textContent='Ⅱ';$('#pause-button').setAttribute('aria-label','Pause game');
  soundtrack.start(0);refreshHUD();canvas.focus();
}
function move(direction) {
  if(state.screen!=='playing')return;
  const lane=THREE.MathUtils.clamp(state.lane+(direction==='left'?-1:1),-1,1);
  if(lane!==state.lane){state.lane=lane;soundtrack.effect('dodge');refreshHUD();}
}
function finishRun(reason) {
  if(state.screen!=='playing')return;state.screen='gameover';
  state.best=Math.max(state.best,Math.floor(state.distance));localStorage.setItem('lagos-market-run-best-distance',state.best);
  $('#gameover-title').textContent=reason==='trader'?'Customer, come back!':reason==='Eyo masquerade'?'Eyo is chasing you!':reason==='water hawker'?'The hawker blocked your hustle!':reason==='road traffic'?'Traffic caught you!':'Watch the '+reason+'!';
  $('#final-distance').textContent=`${Math.floor(state.distance)}m`;$('#final-suya').textContent=state.suya;$('#final-money').textContent=`₦${state.money}`;
  $('#save-message').textContent=signedIn?'Saving your market run…':'Best saved on this device. Sign in for the global board.';
  $('#gameover-overlay').classList.remove('hidden');$('#move-hint').classList.add('hidden');$('#touch-controls').classList.add('hidden');$('#stage-banner').classList.add('hidden');
  player.rotation.z=-.25;soundtrack.effect('crash');setTimeout(()=>{if(state.screen==='gameover'){soundtrack.pause();refreshHUD();}},360);refreshHUD();saveScore();
}
function togglePause() {
  if(state.screen==='playing'){state.screen='paused';soundtrack.pause();$('#pause-overlay').classList.remove('hidden');$('#pause-button').setAttribute('aria-label','Resume game');$('#pause-button').textContent='▶';}
  else if(state.screen==='paused'){state.screen='playing';soundtrack.start(state.market);$('#pause-overlay').classList.add('hidden');$('#pause-button').setAttribute('aria-label','Pause game');$('#pause-button').textContent='Ⅱ';canvas.focus();}
  refreshHUD();
}
function enterMarket() {
  const next=Math.min(18,Math.floor(state.distance/STAGE_LENGTH));
  if(next===state.market)return;state.market=next;state.bannerUntil=state.time+2.6;
  $('#stage-name').textContent=MARKETS[next][0];$('#stage-banner').classList.remove('hidden');soundtrack.market=next;soundtrack.effect('stage');
}
function throwWater() {
  if(state.screen!=='playing'||state.water<1)return false;
  const target=obstacles.filter(o=>o.kind==='Eyo masquerade'&&!o.fleeing).sort((a,b)=>Math.abs(a.obj.position.z-player.position.z)-Math.abs(b.obj.position.z-player.position.z))[0];
  if(!target||Math.abs(target.obj.position.z-player.position.z)>18)return false;
  state.water--;target.fleeing=true;target.chasing=false;target.stunned=1.2;target.obj.position.z=-state.distance-1.4;
  soundtrack.effect('water');shout('EYO DON RUN! WATER NO DEY FEAR YOU!',1);refreshHUD();return true;
}
function interact() {
  if(state.screen!=='playing')return;
  const hawker=waterHawkers.find(item=>!item.bought&&Math.abs(-item.z-state.distance)<3.4&&Math.abs(item.obj.position.x-player.position.x)<1.1);
  if(hawker){
    if(state.money>=WATER_PRICE){state.money-=WATER_PRICE;state.water++;hawker.bought=true;hawker.obj.visible=false;hawker.marker.visible=false;soundtrack.effect('purchase');shout('THANK YOU! PURE WATER FOR YOUR JOURNEY!',1);refreshHUD();}
    else {soundtrack.effect('warn');shout('CUSTOMER! BRING MONEY FIRST!',1);}
    return;
  }
  throwWater();
}
function update(delta) {
  const animated=state.screen==='playing'||state.screen==='ready';
  if(animated) {
    state.time+=delta;
    for(const vehicle of vehicles) {
      if(vehicle.crossing){vehicle.obj.position.x+=vehicle.speed*delta;if(vehicle.obj.position.x>18)vehicle.obj.position.x=-18;}
      else {vehicle.obj.position.z-=vehicle.speed*delta;if(vehicle.obj.position.z<-state.distance-65)vehicle.obj.position.z=-state.distance+25;}
      for(const wheel of vehicle.obj.userData.wheels)wheel.rotation.y+=delta*vehicle.speed;
    }
    for(const seller of shopkeepers){seller.obj.userData.joints.rightArm.rotation.z=-.45+Math.sin(state.time*2+seller.phase)*.28;seller.obj.rotation.y=Math.sin(state.time*.8+seller.phase)*.12;}
    for(const c of collectibles)if(!c.collected){c.obj.rotation.y=state.time*.65;c.obj.position.y=.25+Math.sin(state.time*3+c.segment)*.07;}
    for(const coin of moneyDrops)if(!coin.collected){coin.obj.rotation.y=state.time*1.7;coin.obj.position.y=.3+Math.sin(state.time*4+coin.segment)*.08;}
  }
  if(state.screen==='playing') {
    state.speed=Math.min(12.8,6.6+state.market*.34+state.distance*.0024);state.distance+=state.speed*delta;
    const oldX=player.position.x;player.position.x=THREE.MathUtils.damp(oldX,state.lane*LANE_WIDTH,13,delta);player.position.z=-state.distance;
    state.stride+=delta*(10.5+Math.min(2.5,(state.speed-6.6)*.5));const gait=Math.sin(state.stride);
    player.position.y=.035+Math.abs(Math.sin(state.stride))*.065;
    player.rotation.y=Math.PI+(player.position.x-oldX)*1.1;player.rotation.z=THREE.MathUtils.damp(player.rotation.z,(state.lane*LANE_WIDTH-player.position.x)*-.085,10,delta);
    player.userData.body.rotation.x=-.12;
    limbs.leftLeg.rotation.x=gait*.72;limbs.rightLeg.rotation.x=-gait*.72;
    limbs.leftArm.rotation.x=-gait*.7;limbs.rightArm.rotation.x=gait*.7;limbs.leftArm.rotation.z=-.13;limbs.rightArm.rotation.z=.13;
    const foot=Math.floor(state.stride/Math.PI);if(foot!==state.lastFoot){state.lastFoot=foot;soundtrack.effect('footstep');}
    enterMarket();ensureWorld();
    for(const trader of traders) {
      const ahead=-trader.z-state.distance;
      if(ahead<26&&ahead>-3&&!trader.warning){trader.warning=true;trader.marker.visible=true;soundtrack.effect('warn');const lines=trader.obj.userData.goods==='clothes'?['FINE ANKARA! OYA COME!','CUSTOMER, HOLD THIS CLOTH!']:trader.obj.userData.goods==='bags'?['FINE BAGS! DON PASS ME!','BUY THIS ONE, CUSTOMER!']:['CUSTOMER! COME AND BUY!','NO LOOKING, BUY SOMETHING!'];shout(lines[trader.segment%lines.length]);}
      if(ahead<21&&ahead>-3)trader.phase=Math.min(1,trader.phase+delta*.75);
      if(trader.phase>.55&&trader.swerve&&ahead<13)trader.target=THREE.MathUtils.clamp((Math.round(player.position.x/LANE_WIDTH)+(Math.sin(state.time*4+trader.segment)>0?1:-1))*LANE_WIDTH,-LANE_WIDTH,LANE_WIDTH);
      const ease=trader.phase*trader.phase*(3-2*trader.phase);trader.obj.position.x=THREE.MathUtils.lerp(trader.from,trader.target,ease);
      trader.obj.userData.joints.rightArm.rotation.z=-.8+Math.sin(state.time*5)*.25;
      trader.obj.rotation.z=trader.swerve?.12*Math.sin(state.time*9+trader.segment):0;
      trader.obj.userData.joints.leftLeg.rotation.x=trader.phase<1?Math.sin(state.time*8)*.35:0;
      trader.obj.userData.joints.rightLeg.rotation.x=-trader.obj.userData.joints.leftLeg.rotation.x;
      if(ahead<-3)trader.marker.visible=false;
      if(Math.abs(trader.z-player.position.z)<.66&&Math.abs(trader.obj.position.x-player.position.x)<.58){finishRun('trader');break;}
    }
    if(state.screen==='playing')for(const hawker of waterHawkers){
      const ahead=-hawker.z-state.distance;
      if(hawker.bought)continue;
      if(ahead<30&&ahead>-3&&!hawker.warning){hawker.warning=true;hawker.marker.visible=true;soundtrack.effect('warn');shout('COME AND BUY PURE WATER! CARRY AM!',1.6);}
      if(ahead<20&&ahead>-3)hawker.phase=Math.min(1,hawker.phase+delta*.9);
      const ease=hawker.phase*hawker.phase*(3-2*hawker.phase);hawker.obj.position.x=THREE.MathUtils.lerp(hawker.from,hawker.target,ease);hawker.obj.userData.joints.rightArm.rotation.z=-.7+Math.sin(state.time*7)*.28;
      if(ahead<-3)hawker.marker.visible=false;
      if(Math.abs(hawker.z-player.position.z)<.72&&Math.abs(hawker.obj.position.x-player.position.x)<.62){finishRun('water hawker');break;}
    }
    if(state.screen==='playing')for(const o of obstacles)if(o.kind==='Eyo masquerade'){
      const ahead=-o.obj.position.z-state.distance;
      if(o.fleeing){o.obj.position.z-=delta*(10+state.market*.3);o.z=o.obj.position.z;continue;}
      if(ahead<23&&ahead>-5&&!o.chasing){o.chasing=true;soundtrack.effect('eyo');shout('EYO DEY CHASE YOU! RUN!',1.4);}
      // Eyo advances down its own lane, but never tracks the player's lane.
      // One clean dodge is enough to pass; the scare comes from its speed and animation.
      if(o.chasing&&!o.stunned){o.obj.position.z+=delta*(5.2+state.market*.3);o.obj.position.x=o.baseX+Math.sin(state.time*2.5+o.segment)*.16;o.obj.rotation.z=Math.sin(state.time*10)*.12;o.obj.userData.scare.arms.forEach((arm,i)=>arm.rotation.z=(i?-1:1)*(.95+Math.sin(state.time*12)*.25));o.z=o.obj.position.z;}
      if(o.stunned){o.stunned-=delta;o.obj.position.z-=delta*12;o.z=o.obj.position.z;if(o.stunned<=0)o.fleeing=true;}
    }
    if(state.screen==='playing')for(const o of obstacles)if(!o.fleeing&&Math.abs(o.obj.position.z-player.position.z)<o.depth+.25&&Math.abs(o.obj.position.x-player.position.x)<o.width+.22){finishRun(o.kind);break;}
    if(state.screen==='playing')for(const c of collectibles)if(!c.collected&&Math.abs(c.z-player.position.z)<.65&&Math.abs(c.obj.position.x-player.position.x)<.65){c.collected=true;c.obj.visible=false;state.suya++;soundtrack.effect('collect');refreshHUD();}
    if(state.screen==='playing')for(const coin of moneyDrops)if(!coin.collected&&Math.abs(coin.z-player.position.z)<.68&&Math.abs(coin.obj.position.x-player.position.x)<.68){coin.collected=true;coin.obj.visible=false;state.money+=coin.value;soundtrack.effect('money');shout('NA MONEY! HOLD AM WELL!',1);refreshHUD();}
    if(state.distance>24)$('#move-hint').classList.add('hidden');
    if(Math.floor(state.distance)!==lastHud){lastHud=Math.floor(state.distance);refreshHUD();}
    if(state.bannerUntil&&state.time>state.bannerUntil){$('#stage-banner').classList.add('hidden');state.bannerUntil=0;}
  }
  if(state.screen==='ready') {player.position.y=Math.sin(state.time*2)*.025;player.userData.body.rotation.x=0;}
  const desiredZ=-state.distance+(state.screen==='ready'?4:-6.5);
  cameraZ=THREE.MathUtils.damp(cameraZ,desiredZ,5,delta);
  camera.position.set(5.5,14,cameraZ+21);camera.lookAt(0,.6,cameraZ);
  sun.position.set(-12,22,cameraZ+10);sun.target.position.set(0,0,cameraZ);sun.target.updateMatrixWorld();
}
function resize() {
  const width=innerWidth,height=innerHeight,aspect=width/height;
  const viewHeight=aspect<.8?27:aspect>1.8?19:22;
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
  $('#welcome').textContent=signedIn?`${identity.name}, Balogun's fabric sellers are ready for you.`:"Balogun's fabric sellers are ready for you.";
}
async function saveScore() {
  if(!signedIn)return;
  const result=await askStartNg({type:'startng:score',stats:{distance:Math.floor(state.distance),lanterns:state.suya,money:state.money}},'startng:scoreSaved');
  $('#save-message').textContent=result?.ok?`Best run saved. You're #${result.result?.rank??'—'} on the board.`:'Run saved on this device. The global board is unavailable.';
}
async function loadLeaderboard() {
  const list=$('#leaderboard-list');list.replaceChildren();const loading=document.createElement('li');loading.textContent='Loading the legends…';list.append(loading);
  try {const response=await fetch(`${API}/games/${GAME_NAME}/leaderboard?limit=8`);if(!response.ok)throw Error('Board unavailable');const entries=await response.json();
    list.replaceChildren(...entries.map(entry=>{const li=document.createElement('li'),name=document.createElement('span'),score=document.createElement('strong');name.textContent=`#${entry.rank} ${entry.name}`;score.textContent=`${entry.stats?.distance??entry.score??0}m · ${entry.stats?.lanterns??0} suya`;li.append(name,score);return li;}));
    if(!entries.length){loading.textContent='Be the first Lagos market legend.';list.append(loading);}
  }catch{loading.textContent='The board is taking a market break. Try again.';}
}

const keyMap={ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};
window.addEventListener('keydown',event=>{
  if(document.querySelector('dialog[open]'))return;
  const key=event.key.length===1?event.key.toLowerCase():event.key;
  if(keyMap[key]){event.preventDefault();if(!event.repeat)move(keyMap[key]);}
  else if(key===' '||key==='e'){event.preventDefault();if(!event.repeat)interact();}
  else if(key==='p'||key==='Escape'){event.preventDefault();togglePause();}
  else if(key==='Enter'&&(state.screen==='ready'||state.screen==='gameover'))startRun();
},{capture:true});
let pointerStart=null;
function steerPointer(event) {
  if(state.screen!=='playing')return;
  const rect=canvas.getBoundingClientRect(),ratio=(event.clientX-rect.left)/rect.width;
  state.lane=ratio<.36?-1:ratio>.64?1:0;refreshHUD();
}
canvas.addEventListener('pointermove',event=>{if(event.pointerType==='mouse')steerPointer(event);});
canvas.addEventListener('pointerdown',event=>{canvas.focus();pointerStart={x:event.clientX,y:event.clientY};if(event.pointerType==='mouse')steerPointer(event);});
canvas.addEventListener('pointerup',event=>{
  if(!pointerStart||state.screen!=='playing'){pointerStart=null;return;}
  const dx=event.clientX-pointerStart.x;pointerStart=null;
  if(Math.abs(dx)>24){move(dx>0?'right':'left');return;}
  steerPointer(event);
});
canvas.addEventListener('pointercancel',()=>{pointerStart=null;});
for(const b of document.querySelectorAll('[data-move]'))b.addEventListener('pointerdown',event=>{event.preventDefault();move(b.dataset.move);});
for(const b of document.querySelectorAll('[data-action="interact"]'))b.addEventListener('pointerdown',event=>{event.preventDefault();interact();});
$('#start-button').onclick=startRun;$('#restart-button').onclick=startRun;$('#pause-button').onclick=togglePause;$('#resume-button').onclick=togglePause;
$('#home-button').onclick=()=>{state.screen='ready';soundtrack.pause();player.rotation.set(0,0,0);$('#gameover-overlay').classList.add('hidden');$('#title-overlay').classList.remove('hidden');refreshHUD();};
$('#sign-in-button').onclick=()=>{location.href=`${START_NG}/?return_to=${encodeURIComponent(location.origin+location.pathname)}`;};
let resumeAfterDialog=false;
for(const b of document.querySelectorAll('[data-open]'))b.onclick=()=>{resumeAfterDialog=state.screen==='playing';if(resumeAfterDialog)togglePause();$('#'+b.dataset.open).showModal();if(b.dataset.open==='board-dialog')loadLeaderboard();};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',()=>{if(resumeAfterDialog&&state.screen==='paused')togglePause();resumeAfterDialog=false;});
$('#music-volume').oninput=event=>{soundtrack.setVolumes(Number(event.target.value)/100,soundtrack.effectsVolume);$('#music-level').textContent=event.target.value+'%';};
$('#effects-volume').oninput=event=>{soundtrack.setVolumes(soundtrack.musicVolume,Number(event.target.value)/100);$('#effects-level').textContent=event.target.value+'%';};
$('#audio-toggle').onclick=()=>{soundtrack.setEnabled(!soundtrack.enabled);$('#audio-toggle').textContent=soundtrack.enabled?'Mute all sound':'Enable sound';refreshHUD();};
$('#preview-music').onclick=()=>{soundtrack.start(state.market);$('#preview-music').textContent='Music playing ♫';};
$('#sound-dialog').addEventListener('close',()=>{if(state.screen!=='playing')soundtrack.pause();$('#preview-music').textContent='Preview the market groove';});
$('#music-volume').value=Math.round(soundtrack.musicVolume*100);$('#music-level').textContent=Math.round(soundtrack.musicVolume*100)+'%';
$('#effects-volume').value=Math.round(soundtrack.effectsVolume*100);$('#effects-level').textContent=Math.round(soundtrack.effectsVolume*100)+'%';
$('#audio-toggle').textContent=soundtrack.enabled?'Mute all sound':'Enable sound';
$('#refresh-board').onclick=loadLeaderboard;
MARKETS.forEach(m=>{const li=document.createElement('li');li.textContent=m[0];$('#market-route').append(li);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(state.screen==='playing')togglePause();}else loadIdentity();});
window.addEventListener('focus',loadIdentity);window.addEventListener('resize',resize);
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(state.screen==='playing')togglePause();$('#render-error').textContent='The 3D view was interrupted. Reload the page to reopen the market.';$('#render-error').classList.remove('hidden');});
updatePlayer();ensureWorld();resize();refreshHUD();loadIdentity();$('#loading').classList.add('hidden');requestAnimationFrame(frame);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';
import { MarketAudio } from '../market-audio.js';

// Exercise the real scene and gameplay without a GPU; only browser surfaces are stubbed.
const elements=new Map();
function element() {
  return {dataset:{},children:[],userData:{},style:{},classList:{add(){},remove(){},toggle(){}},
    append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},
    addEventListener(){},setAttribute(){},focus(){},getBoundingClientRect(){return {left:0,top:0,width:1000,height:700};},
    getContext(){return {fillRect(){},strokeRect(){},fillText(){}}}};
}
const document={querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);},
  querySelectorAll(){return [];},createElement:element,body:element(),addEventListener(){}};
class Renderer { constructor(){this.shadowMap={};}setPixelRatio(){}setClearColor(){}setSize(){}render(){} }
const context=vm.createContext({THREE:{...THREE,WebGLRenderer:Renderer},MarketAudio,document,location:{hostname:'localhost'},
  localStorage:{getItem(){return null;},setItem(){}},devicePixelRatio:1,innerWidth:1000,innerHeight:700,
  window:{addEventListener(){}},requestAnimationFrame(){},addEventListener(){},removeEventListener(){},
  setTimeout,clearTimeout,console});
const source=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8').replace(/^import .*?;\n/gm,'');
vm.runInContext(source,context);
const run=code=>vm.runInContext(code,context);
function tick(count=30){for(let i=0;i<count;i++)run('update(.01)');}
run('soundtrack.enabled=false;startRun()');
tick(100);assert.ok(run('state.distance')>6,'running advances without any forward key');
assert.ok(run('state.suya')>=1,'running through a skewer trail collects suya');
assert.ok(run('player.position.y')<.11,'gait stays grounded instead of hopping');
assert.ok(Math.abs(run('limbs.leftLeg.rotation.x'))>.05,'legs animate continuously');
run("move('right')");tick();assert.equal(run('state.lane'),1);assert.ok(run('player.position.x')>2,'right input makes a smooth lane dodge');
run("move('left')");tick();assert.equal(run('state.lane'),0);
run("move('left');move('left')");tick();assert.equal(run('state.lane'),-1,'lane boundary clamps input');
run('togglePause()');const time=run('state.time');tick();assert.equal(run('state.time'),time,'pause freezes traffic and animation');run('togglePause()');
run('startRun();steerPointer({clientX:900})');tick();assert.equal(run('state.lane'),1,'mouse steers across the aisle');
run('steerPointer({clientX:100})');tick();assert.equal(run('state.lane'),-1);
run('startRun();state.distance=249.95;player.position.z=-249.95');tick(2);assert.equal(run('state.market'),1,'250m unlocks Mushin');
const goods=code=>run(`(()=>{const found=new Set();${code}.traverse(o=>{if(o.userData.goods)found.add(o.userData.goods)});return [...found]})()`);
run('startRun()');assert.deepEqual([...goods('rows.get(0)')].sort(),['bags','clothes','shoes'],'Balogun has actual fashion inventory');
run('state.distance=256;ensureWorld()');assert.ok(goods('rows.get(16)').includes('meat'),'Mushin renders food stalls instead of fashion');
run('state.distance=1505;ensureWorld()');assert.ok(goods('rows.get(94)').includes('onions'),'Mile 12 renders produce');
run('state.distance=750;ensureWorld()');assert.ok(run("(()=>{let mall=0,bridge=0;rows.get(48)?.traverse(o=>{if(o.userData.kind==='tejuosho-mall')mall++;if(o.userData.kind==='tejuosho-footbridge')bridge++});return mall===2&&bridge===1})()"),'Tejuosho renders a mall frontage and footbridge');
run('startRun();state.money=20;addWaterHawker(8,-1,0);const h=waterHawkers.at(-1);h.z=-1;h.from=0;h.target=0;h.obj.position.set(0,0,-1);interact()');assert.equal(run('state.money'),0,'pure water costs scarce cash');assert.equal(run('state.water'),1,'pure water can be bought from a hawker');
run('startRun();addBlocker(10,-6,0,"eyo");const e=obstacles.at(-1);e.obj.position.z=-6;e.z=-6;state.water=1;throwWater()');assert.equal(run('state.water'),0,'throwing pure water consumes one sachet');assert.equal(run('e.fleeing'),true,'pure water makes the chasing Eyo flee');
run('startRun();state.distance=13');tick(50);assert.ok(run('traders[0].warning'),'shopkeeper warns before stepping out');assert.ok(run('Math.abs(traders[0].obj.position.x)')<4.9,'shopkeeper physically steps into the aisle');
run('startRun();const t=traders[0];t.z=0;t.obj.position.set(0,0,0);t.from=0;t.target=0');tick(1);
assert.equal(run('state.screen'),'gameover','contact with a trader ends a run');
run('startRun();const cart=addBlocker(3,0,0);');tick(1);assert.equal(run('state.screen'),'gameover','stock trolleys block the runner');
run('startRun();addBlocker(3,0,0,"eyo")');tick(1);assert.equal(run('state.screen'),'gameover','Eyo remains a physical obstacle');
run('startRun();for(let r=1;r<100;r++){state.distance=r*SEGMENT_LENGTH;ensureWorld()}');
assert.ok(run('rows.size')<=8,'endless generation prunes old market segments');
assert.ok(run('vehicles.filter(v=>!v.crossing).every(v=>v.obj.position.x===-12.7)'),'service-road traffic stays beside the shops');
assert.ok(run('vehicles.some(v=>v.crossing)'),'later scenes add traffic at market road crossings');
assert.ok(run('traders.every(t=>t.segment>=97)'),'old traders are pruned with their shops');
console.log('PASS: automatic grounded running, animation, keyboard/mouse dodges, collection, pause, 250m unlock, real market inventories, stepping traders, cart/Eyo collisions, parallel road, bounded world');

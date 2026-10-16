import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';

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
const context=vm.createContext({THREE:{...THREE,WebGLRenderer:Renderer},document,location:{hostname:'localhost'},
  localStorage:{getItem(){return null;},setItem(){}},devicePixelRatio:1,innerWidth:1000,innerHeight:700,
  window:{addEventListener(){}},requestAnimationFrame(){},addEventListener(){},removeEventListener(){},
  setTimeout,clearTimeout,console});
const source=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8').replace(/^import .*?;\n/,'');
vm.runInContext(source,context);
const run=code=>vm.runInContext(code,context);
function tick(count=30){for(let i=0;i<count;i++)run('update(.01)');}
run('soundOn=false;startRun()');
run("move('up')");tick();assert.equal(run('state.row'),1);assert.equal(run('state.hops'),1);
assert.equal(run('state.suya'),1,'the visible starter skewer is collectible');
run("move('right')");tick();assert.equal(run('state.column'),1);
run("move('down')");tick();assert.equal(run('state.row'),0);assert.equal(run('state.hops'),1,'backtracking cannot inflate score');
run("move('left')");tick();assert.equal(run('state.column'),0);
run("move('left');move('right')");tick(50);assert.equal(run('state.column'),0,'rapid input queues one follow-up hop');
run('togglePause()');const time=run('state.time');tick();assert.equal(run('state.time'),time,'pause freezes traffic and animation');run('togglePause()');
run('state.pointerTarget={column:2,row:1}');tick(80);assert.equal(run('state.column'),2);assert.equal(run('state.row'),1,'mouse target traverses actual ground cells');
run('startRun();obstacles.push({row:1,column:0})');run("move('up')");assert.equal(run('state.hop'),null,'solid barrels block a step');
run('startRun();state.furthest=19;state.row=19;player.position.set(0,0,-19*STEP_Z);vehicles.forEach(v=>v.obj.position.x=29);walkers.forEach(w=>w.obj.position.x=29)');
run("move('up')");tick();assert.equal(run('state.market'),1);assert.equal(run('state.row'),20,'reaching 20 forward rows unlocks Mushin');
run('startRun();const hit=vehicles[0];hit.obj.position.set(player.position.x,0,player.position.z);hit.speed=0');tick(1);
assert.equal(run('state.screen'),'gameover','vehicle ground collision ends a run');
run('startRun();const eyo=walkers[0];eyo.obj.position.copy(player.position);eyo.speed=0');tick(1);
assert.equal(run('state.screen'),'gameover','Eyo contact ends a run');
run('startRun();for(let r=1;r<100;r++){state.furthest=r;ensureWorld()}');
assert.ok(run('rows.size')<=28,'endless generation prunes old market segments');
assert.ok(run('vehicles.every(v=>v.row>=state.furthest-7)'),'old traffic is pruned with its street');
console.log('PASS: four directions, hop queue, suya, score, mouse path, pause, barrels, market unlock, danfo/Eyo collisions, bounded world');

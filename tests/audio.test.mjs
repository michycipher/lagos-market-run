import assert from 'node:assert/strict';
import { MarketAudio } from '../market-audio.js';

const scheduled=[];
const param=()=>({value:0,setValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;}});
const node=kind=>({kind,connections:[],gain:param(),frequency:param(),Q:param(),pan:param(),connect(target){this.connections.push(target);},start(time){scheduled.push({kind,time});},stop(){}});
class FakeAudioContext {
  currentTime=0;sampleRate=8000;state='running';destination=node('output');
  createGain(){return node('gain');}createOscillator(){return node('oscillator');}createBufferSource(){return node('noise');}
  createStereoPanner(){return node('pan');}createBiquadFilter(){return node('filter');}
  createBuffer(channels,length){return {getChannelData(){return new Float32Array(length);}};}
}
globalThis.AudioContext=FakeAudioContext;
const music=new MarketAudio();
music.start();assert.equal(music.running,true);assert.ok(music.timer,'one score scheduler starts after a user action');
const timer=music.timer;music.start();assert.equal(music.timer,timer,'restarting never duplicates the music scheduler');
music.context.currentTime=2;music.schedule();assert.ok(scheduled.filter(x=>x.kind==='oscillator').length>20,'bass, melody, chords and drums are scheduled');
const before=scheduled.length;for(const effect of ['footstep','dodge','collect','warn','crash','stage'])music.effect(effect);
assert.ok(scheduled.length>before+10,'distinct gameplay effects create audio events');
music.setVolumes(.2,.8);assert.equal(music.music.gain.value,.2*.38);assert.equal(music.effects.gain.value,.8*.65);
music.setEnabled(false);assert.equal(music.master.gain.value,0,'mute silences all buses');
music.pause();assert.equal(music.timer,null);assert.equal(music.running,false);
music.setEnabled(true);assert.equal(music.master.gain.value,0,'unmuting a paused run stays silent');
music.start(6);assert.equal(music.market,6);assert.equal(music.running,true);music.pause();
delete globalThis.AudioContext;
console.log('PASS: original score scheduler, distinct effects, independent volumes, mute, pause/resume, no duplicate loops');

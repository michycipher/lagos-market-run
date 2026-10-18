// Original, generated-in-browser highlife/Afrobeat-inspired score. No sampled music.
export class MarketAudio {
  constructor() {
    this.enabled=true;this.musicVolume=.42;this.effectsVolume=.7;this.running=false;
    this.context=null;this.timer=null;this.step=0;this.nextBeat=0;this.market=0;this.foot=0;this.voiceVoices=[];
    try{const saved=JSON.parse(globalThis.localStorage?.getItem('lagos-market-audio')||'{}');this.enabled=saved.enabled!==false;if(Number.isFinite(saved.music))this.musicVolume=Math.max(0,Math.min(1,saved.music));if(Number.isFinite(saved.effects))this.effectsVolume=Math.max(0,Math.min(1,saved.effects));}catch{/* Keep defaults when storage is unavailable. */}
  }
  init() {
    if(!this.context) {
      const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return false;
      this.context=new Audio();const c=this.context;
      this.master=c.createGain();this.master.gain.value=.58;this.master.connect(c.destination);
      this.music=c.createGain();this.music.connect(this.master);
      this.effects=c.createGain();this.effects.connect(this.master);
      this.ambience=c.createGain();this.ambience.gain.value=.05;this.ambience.connect(this.effects);
      this.noiseBuffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate);
      const data=this.noiseBuffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      const crowd=c.createBufferSource();crowd.buffer=this.noiseBuffer;crowd.loop=true;
      const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=530;filter.Q.value=.7;
      crowd.connect(filter);filter.connect(this.ambience);crowd.start();this.crowd=crowd;
      this.setVolumes(this.musicVolume,this.effectsVolume);
    }
    if(this.context.state==='suspended')this.context.resume();return true;
  }
  setVolumes(music,effects) {
    this.musicVolume=Number(music);this.effectsVolume=Number(effects);
    this.persist();
    if(!this.context)return;const now=this.context.currentTime;
    this.music.gain.setTargetAtTime(this.musicVolume*.38,now,.04);
    this.effects.gain.setTargetAtTime(this.effectsVolume*.65,now,.04);
  }
  setEnabled(enabled) {
    this.enabled=enabled;
    this.persist();
    if(this.context)this.master.gain.setTargetAtTime(enabled&&this.running ? .58 : 0,this.context.currentTime,.04);
  }
  persist(){try{globalThis.localStorage?.setItem('lagos-market-audio',JSON.stringify({enabled:this.enabled,music:this.musicVolume,effects:this.effectsVolume}));}catch{/* Audio still works without storage. */}}
  note(freq,start,duration,gain=.12,type='sine',bus=this.music) {
    const c=this.context,o=c.createOscillator(),env=c.createGain();o.type=type;o.frequency.value=freq;
    env.gain.setValueAtTime(.0001,start);env.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),start+.008);
    env.gain.exponentialRampToValueAtTime(.0001,start+duration);o.connect(env);env.connect(bus);
    o.start(start);o.stop(start+duration+.015);
  }
  noise(start,duration,gain,frequency,pan=0,bus=this.music) {
    const c=this.context,source=c.createBufferSource(),filter=c.createBiquadFilter(),env=c.createGain();
    source.buffer=this.noiseBuffer;filter.type='highpass';filter.frequency.value=frequency;
    env.gain.setValueAtTime(gain,start);env.gain.exponentialRampToValueAtTime(.0001,start+duration);
    source.connect(filter);filter.connect(env);
    if(c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=pan;env.connect(p);p.connect(bus);}else env.connect(bus);
    source.start(start);source.stop(start+duration);
  }
  kick(time) {
    const c=this.context,o=c.createOscillator(),env=c.createGain();o.frequency.setValueAtTime(145,time);
    o.frequency.exponentialRampToValueAtTime(48,time+.14);env.gain.setValueAtTime(.5,time);env.gain.exponentialRampToValueAtTime(.0001,time+.22);
    o.connect(env);env.connect(this.music);o.start(time);o.stop(time+.23);
  }
  schedule() {
    if(!this.running||!this.context)return;
    const c=this.context,interval=60/(104+Math.min(12,this.market))/4;
    while(this.nextBeat<c.currentTime+.12) {
      const s=this.step%16,bar=Math.floor(this.step/16)%4,t=this.nextBeat;
      if(s===0||s===6||s===10)this.kick(t);
      if(s===4||s===12){this.noise(t,.12,.15,1400);this.note(185,t,.09,.15,'triangle');}
      this.noise(t,.035,s%2?.055:.085,5700,s%2?.35:-.35);
      if([0,3,6,10,12].includes(s)) {this.note(1050,t,.045,.1,'triangle');this.note(1430,t,.025,.035,'sine');}
      // Syncopated bass, plucked pentatonic melody and off-beat guitar chords.
      const roots=[130.81,174.61,146.83,196],root=roots[bar];
      if([0,3,7,10,14].includes(s))this.note(root/2*(s===7?1.5:1),t,.24,.29,'triangle');
      if([2,6,10,14].includes(s))for(const ratio of [1,1.25,1.5])this.note(root*ratio*2,t,.13,.047,'triangle');
      const melody=[2,0,2.5,3,0,2.5,2,1.5,2,0,3,2.5,0,2,1.5,1.25];
      if(melody[s]){const f=root*melody[(s+this.market*2)%16];if(f){this.note(f,t,.2,.085,'sine');this.note(f*2,t,.08,.018,'sine');}}
      if(this.step%128===96)this.horn(.14);
      this.step++;this.nextBeat+=interval;
    }
  }
  start(market=0) {
    if(!this.init())return;
    this.market=market;this.running=true;this.nextBeat=this.context.currentTime+.03;
    this.master.gain.setTargetAtTime(this.enabled ? .58 : 0,this.context.currentTime,.04);
    if(!this.timer)this.timer=setInterval(()=>this.schedule(),25);this.schedule();
  }
  pause() {
    this.running=false;if(this.timer){clearInterval(this.timer);this.timer=null;}
    if(this.context)this.master.gain.setTargetAtTime(0,this.context.currentTime,.04);
  }
  effect(kind) {
    if(!this.enabled||!this.context)return;const t=this.context.currentTime;
    if(kind==='footstep'){this.noise(t,.045,.07,350,this.foot++%2?.25:-.25,this.effects);this.note(85,t,.04,.05,'triangle',this.effects);}
    if(kind==='dodge')this.noise(t,.09,.055,1900,0,this.effects);
    if(kind==='collect')for(let i=0;i<3;i++)this.note([659,784,1046][i],t+i*.055,.14,.15,'sine',this.effects);
    if(kind==='money')for(let i=0;i<4;i++)this.note([523,659,784,1046][i],t+i*.045,.16,.12,'triangle',this.effects);
    if(kind==='purchase'){this.note(392,t,.12,.12,'sine',this.effects);this.note(523,t+.1,.18,.14,'sine',this.effects);this.noise(t,.08,.08,2400,0,this.effects);}
    if(kind==='water'){this.noise(t,.16,.16,900,0,this.effects);this.note(180,t,.32,.18,'sawtooth',this.effects);this.note(92,t+.12,.38,.15,'triangle',this.effects);}
    if(kind==='warn'){this.note(760,t,.07,.11,'triangle',this.effects);this.note(620,t+.1,.08,.09,'triangle',this.effects);}
    if(kind==='eyo'){this.note(92,t,.42,.22,'sawtooth',this.effects);this.note(58,t+.16,.5,.18,'triangle',this.effects);this.noise(t,.34,.12,260,0,this.effects);}
    if(kind==='crash'){this.noise(t,.25,.22,160,0,this.effects);this.note(95,t,.3,.2,'triangle',this.effects);}
    if(kind==='stage')for(let i=0;i<4;i++)this.note([523,659,784,1046][i],t+i*.09,.22,.14,'triangle',this.effects);
  }
  voice(text,{rate=1.08,pitch=1.02}={}) {
    if(!this.enabled)return;
    const synth=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance;
    if(!synth||!Utterance)return;
    try {
      // Prefer an en-NG voice, then a familiar British English voice. Keeping
      // the voice selection here makes every market call sound consistent.
      this.voiceVoices=synth.getVoices?.()||this.voiceVoices;
      const voice=this.voiceVoices.find(item=>/^en-NG$/i.test(item.lang))
        ||this.voiceVoices.find(item=>/^en-GB/i.test(item.lang))
        ||this.voiceVoices.find(item=>/^en-US/i.test(item.lang));
      // Do not cut off a caller mid-sentence when two nearby stalls shout.
      if(synth.speaking||synth.pending)return;
      const line=new Utterance(text);line.lang='en-NG';line.volume=.92;line.rate=rate*.94;line.pitch=pitch;
      if(voice)line.voice=voice;
      synth.speak(line);
    } catch { /* Some embedded browsers expose speech synthesis but reject it. */ }
  }
  horn(level=.2) {
    if(!this.enabled||!this.context)return;const t=this.context.currentTime;
    this.note(349,t,.16,level,'sawtooth',this.effects);this.note(440,t,.16,level*.6,'triangle',this.effects);
  }
}

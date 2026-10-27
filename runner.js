import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

window.__runnerReady = true;

// ---------- Konstanten (dplan Design) ----------
const C = {
  blue: 0x009fe3,
  blueDark: 0x0079b0,
  grey: 0x8c8c8f,
  greyDark: 0x5d5e61,
  bg: 0xeaf2f8,
  red: 0xe5484d,
  orange: 0xf08a24,
  purple: 0x7c5cd6,
  green: 0x22a06b,
  fire: 0xe5603b,
};
const FONT = '"Arial Rounded MT Bold", "Helvetica Rounded", "Helvetica Neue", Arial, sans-serif';
const LANES = [-2.4, 0, 2.4];
const SPAWN_Z = -150;
const TRACK_LEN = 320;
const GATE_EVERY = 550; // MB zwischen zwei Security-Gates
const FIRST_GATE = 260;
const GATE_STOP_Z = -9; // hier hält das Tor vor dem Spieler an
const MAX_LIVES = 3;
const QUESTIONS = window.DPLAN_QUESTIONS || [];

// ---------- Stufen ----------
// Jedes Security-Gate ist ein Checkpoint: danach beginnt die nächste Stufe –
// schneller, dichter, neue Muster und Bedrohungen, und das Rechenzentrum wird dunkler.
const SPEED_START = 14;
const levelSpeed = (lv, t) => Math.min(46, SPEED_START + (lv - 1) * 3.4 + Math.min(t, 45) * 0.12);
const UNLOCK_LEVEL = { virus: 1, bug: 1, phishing: 2, spam: 2, ransom: 3 };
const LEVEL_NEWS = {
  2: 'Neu: Phishing-Mails und Spam-Wellen',
  3: 'Neu: Ransomware und Sprung-Reihen',
  4: 'Neu: Slalom-Strecken',
  5: 'Neu: Viren wechseln die Spur',
};

// Power-ups: dur = Wirkungsdauer in Sekunden, level = ab welcher Stufe sie auftauchen
const POWER = {
  backup:    { label: 'BACKUP',    color: '#22a06b', msg: '+1 Netzwerk', level: 1 },
  cloud:     { label: 'CLOUD',     color: '#009fe3', msg: 'Cloud-Sync: Daten-Magnet!', dur: 10, level: 1 },
  antivirus: { label: 'ANTIVIRUS', color: '#13a89e', msg: 'Antivirus: Laser aktiv!', dur: 8, level: 1 },
  firewall:  { label: 'FIREWALL',  color: '#e5603b', msg: 'Firewall: unverwundbar!', dur: 6, level: 2 },
  twofa:     { label: '2FA',       color: '#0079b0', msg: '2FA: doppelte Punkte!', dur: 12, level: 2 },
  scan:      { label: 'SCAN',      color: '#7c5cd6', msg: 'Scan: Strecke gesäubert!', level: 3 },
  update:    { label: 'UPDATE',    color: '#d99a00', msg: 'Update: Zeitlupe!', dur: 6, level: 3 },
};
const TIMED = Object.keys(POWER).filter((k) => POWER[k].dur);

// Lichtstimmung je Stufe: Tag → Abend → Dämmerung → Neon-Nacht
const THEMES = [
  { bg: 0xeaf2f8, floor: 0xffffff, ground: 0xdde7ee, lane: 0xa8dcf3, hemi: 1.7, sun: 2.2, rack: 0.25, edge: 0.35, glow: 0, bloom: 0 },
  { bg: 0xc6d9ea, floor: 0xe4edf5, ground: 0xb9cad8, lane: 0x8fd3f2, hemi: 1.45, sun: 1.9, rack: 0.5, edge: 0.7, glow: 0.12, bloom: 0.15 },
  { bg: 0x587291, floor: 0x9cb0c4, ground: 0x485f78, lane: 0x6fd0ff, hemi: 1.05, sun: 1.3, rack: 0.9, edge: 1.1, glow: 0.3, bloom: 0.55 },
  { bg: 0x0e1b2c, floor: 0x32465e, ground: 0x0b1623, lane: 0x5fe0ff, hemi: 0.6, sun: 0.7, rack: 1.4, edge: 1.7, glow: 0.5, bloom: 0.9 },
];

// ---------- Helfer ----------
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* z.B. privater Modus */ }
  },
};
const fmt = (n) => Math.round(n).toLocaleString('de-CH');

function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- Sound (WebAudio, ohne Dateien) ----------
let audio = null;
let master = null; // Kompressor vor dem Ausgang
let sfxBus = null;
let noiseBuf = null;
let muted = store.get('dplan-cd-muted', false);

// Browser erlauben Ton erst nach einer Interaktion – daher bei Klick/Taste starten
function ensureAudio() {
  try {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      master = audio.createDynamicsCompressor();
      master.threshold.value = -12;
      master.ratio.value = 4;
      master.connect(audio.destination);
      sfxBus = audio.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);
      noiseBuf = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      music.init();
    }
    if (audio.state === 'suspended' && state !== 'paused') audio.resume();
  } catch { /* Audio nicht verfügbar */ }
  return audio;
}

// Ausgang mit optionaler Stereo-Position (pan −1 = links … 1 = rechts)
function out(pan = 0, dest = sfxBus) {
  if (!pan || !audio.createStereoPanner) return dest;
  const p = audio.createStereoPanner();
  p.pan.value = clamp(pan, -1, 1);
  p.connect(dest);
  return p;
}

// Oszillator-Ton mit Tonhöhen-Fahrt f0 → f1
function osc(type, f0, f1, dur, vol, { delay = 0, pan = 0, attack = 0.005, detune = 0, dest } = {}) {
  if (muted || !ensureAudio()) return null;
  const t = audio.currentTime + delay;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.detune.value = detune;
  o.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest || out(pan));
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

// Gefiltertes Rauschen mit Filter-Fahrt f0 → f1 (Whoosh, Explosion, Becken …)
function noise(dur, vol, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, delay = 0, pan = 0, attack = 0.005, dest } = {}) {
  if (muted || !ensureAudio()) return;
  const t = audio.currentTime + delay;
  const src = audio.createBufferSource();
  src.buffer = noiseBuf;
  const flt = audio.createBiquadFilter();
  flt.type = type;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = audio.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(g).connect(dest || out(pan));
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

// Einfacher Ton (Kurzform)
function tone(freq, dur, type = 'square', vol = 0.05, slide = 0, delay = 0) {
  osc(type, freq, slide ? freq + slide : 0, dur, vol, { delay });
}

// ---------- Soundtrack: «Datacenter Drive» ----------
// Live erzeugter Elektro-Track. Er wächst mit dem Spiel:
// höhere Stufe = schneller, höhere Tonart, mehr Spuren; Boss = eigene, düstere Harmonik.
// Kick «pumpt» die übrigen Spuren (Sidechain), dazu Hall, Echo, Riser und Impacts.
const music = (() => {
  const PROG = {
    normal: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], // Am – F – C – G
    boss:   [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]], // Am – F – Dm – E (harmonisch Moll)
    gate:   [[57, 60, 64], [53, 57, 62], [50, 55, 57], [52, 57, 59]], // schwebende Akkorde zum Nachdenken
  };
  // Arpeggio-Muster je Teil (3 = Grundton eine Oktave höher, -1 = Pause) – so klingt jeder Teil eigenständig
  const ARP = [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 3, 2, 1, 0, 1];
  const ARP_MENU = [0, -1, -1, 1, -1, -1, 2, -1, 3, -1, -1, 2, -1, -1, 1, -1];
  const ARP_BOSS = [0, 3, 1, 3, 2, 3, 1, 3, 0, 3, 2, 3, 1, 2, 3, 2];
  const ROLL = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1]; // rollender Bass
  const LEAD_RUN = [
    76, 0, 74, 72, 0, 72, 74, 0, 72, 0, 69, 0, 67, 69, 0, 0,
    72, 0, 74, 76, 0, 79, 76, 0, 74, 0, 71, 0, 74, 0, 0, 0,
  ];
  const LEAD_BOSS = [
    69, 0, 72, 76, 0, 76, 74, 72, 72, 0, 69, 65, 0, 69, 72, 0,
    74, 0, 77, 81, 0, 81, 79, 77, 76, 0, 80, 83, 0, 83, 80, 76,
  ];
  const TRANSPOSE = [0, 0, 2, 3, 5, 7]; // Tonart steigt mit der Stufe
  const LAYERS = ['kick', 'clap', 'hats', 'bass', 'dirt', 'arp', 'pad', 'lead', 'stab', 'heart'];
  const f = (m) => 440 * 2 ** ((m - 69) / 12);

  let bus, filter, duck, verb, verbOut, delay, fb, wet, shaper, timer = null;
  const L = {};
  let mode = 'menu', lv = 1, danger = false, muffled = false;
  let step = 0, nextTime = 0, tr = 0, prog = PROG.normal;
  // Alle Musik-Noten, die gerade klingen – damit beim Teilwechsel nichts nachhallt
  const live = new Set();
  let tracking = false;
  function track(src, g) {
    if (!tracking) return;
    const e = { src, g };
    live.add(e);
    src.onended = () => live.delete(e);
  }

  // Sauberer Schnitt: laufende Noten ausblenden, Echo/Hall leeren, neuer Teil beginnt auf Takt 1
  function cut() {
    const now = audio.currentTime;
    for (const e of live) {
      try {
        e.g.gain.cancelScheduledValues(now);
        e.g.gain.setTargetAtTime(0.0001, now, 0.03);
        e.src.stop(now + 0.2);
      } catch { /* bereits beendet */ }
    }
    live.clear();
    fb.gain.cancelScheduledValues(now);
    fb.gain.setValueAtTime(0, now);
    fb.gain.setValueAtTime(0.3, now + 0.5);
    wet.gain.cancelScheduledValues(now);
    wet.gain.setValueAtTime(0, now);
    wet.gain.setValueAtTime(0.22, now + 0.5);
    verbOut.gain.cancelScheduledValues(now);
    verbOut.gain.setTargetAtTime(0.02, now, 0.05);
    verbOut.gain.setTargetAtTime(0.35, now + 0.4, 0.3);
    step = 0;
    nextTime = now + 0.06;
  }

  function impulse(sec) {
    const len = Math.floor(audio.sampleRate * sec);
    const buf = audio.createBuffer(2, len, audio.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return buf;
  }
  function distCurve(k) {
    const c = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      c[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return c;
  }

  function init() {
    bus = audio.createGain();
    bus.gain.value = muted ? 0 : 0.55;
    filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 18000;
    bus.connect(filter).connect(master);
    duck = audio.createGain();
    duck.connect(bus);
    verb = audio.createConvolver();
    verb.buffer = impulse(2.4);
    verbOut = audio.createGain();
    verbOut.gain.value = 0.35;
    verb.connect(verbOut).connect(bus);
    delay = audio.createDelay(1);
    fb = audio.createGain();
    fb.gain.value = 0.3;
    wet = audio.createGain();
    wet.gain.value = 0.22;
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(bus);
    const mk = (dest, fType, fFreq) => {
      const g = audio.createGain();
      g.gain.value = 0;
      let node = g;
      if (fType) {
        node = audio.createBiquadFilter();
        node.type = fType;
        node.frequency.value = fFreq;
        g.connect(node);
      }
      node.connect(dest);
      return { g, node };
    };
    L.kick = mk(bus);
    L.clap = mk(bus);
    L.hats = mk(bus);
    L.heart = mk(bus, 'lowpass', 220);
    L.bass = mk(duck);
    L.dirt = mk(duck, 'lowpass', 2400);
    L.arp = mk(duck, 'lowpass', 2600);
    L.pad = mk(duck, 'lowpass', 1400);
    L.lead = mk(duck, 'lowpass', 3600);
    L.stab = mk(duck, 'lowpass', 3200);
    for (const k of ['arp', 'lead']) L[k].node.connect(delay);
    for (const k of ['lead', 'pad', 'clap', 'stab']) L[k].node.connect(verb);
    shaper = audio.createWaveShaper();
    shaper.curve = distCurve(60);
    shaper.connect(L.dirt.g);
    apply();
  }

  function v(type, freq, t, dur, vol, dest, { attack = 0.005, detune = 0 } = {}) {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    for (const d of Array.isArray(dest) ? dest : [dest]) g.connect(d);
    o.start(t);
    o.stop(t + dur + 0.05);
    track(o, g);
    return o;
  }
  function nz(t, dur, vol, type, freq, dest, { q = 1, f1 = freq, attack = 0.003 } = {}) {
    const src = audio.createBufferSource();
    src.buffer = noiseBuf;
    const flt = audio.createBiquadFilter();
    flt.type = type;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(freq, t);
    if (f1 !== freq) flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g);
    for (const d of Array.isArray(dest) ? dest : [dest]) g.connect(d);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
    track(src, g);
  }
  function clap(t, vol, dest = L.clap.g) {
    nz(t, 0.16, vol, 'bandpass', 1500, dest, { q: 0.8 });
    nz(t + 0.012, 0.12, vol * 0.7, 'bandpass', 1800, dest, { q: 0.8 });
  }
  function bassNote(freq, t, dur) {
    const o = audio.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    const flt = audio.createBiquadFilter();
    flt.type = 'lowpass';
    flt.Q.value = 6;
    flt.frequency.setValueAtTime(1600, t);
    flt.frequency.exponentialRampToValueAtTime(160, t + dur);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(flt).connect(g);
    g.connect(L.bass.g);
    g.connect(shaper);
    o.start(t);
    o.stop(t + dur + 0.05);
    track(o, g);
  }
  // Sidechain: nach jeder Kick «atmen» Bass, Fläche und Melodie wieder ein
  function pump(t, stepDur) {
    const depth = mode === 'boss' ? 0.6 : mode === 'run' ? Math.min(0.6, 0.3 + lv * 0.05) : 0;
    if (!depth) return;
    duck.gain.cancelScheduledValues(t);
    duck.gain.setValueAtTime(1 - depth, t);
    duck.gain.linearRampToValueAtTime(1, t + stepDur * 3.2);
  }

  const bpm = () => (mode === 'boss' ? 138 : mode === 'run' ? Math.min(140, 112 + (lv - 1) * 4) : mode === 'gate' ? 96 : 104);

  function playStep(s, t) {
    const STEP = 60 / bpm() / 4;
    const i = s % 16;
    const bar = Math.floor(s / 16) % 4;
    if (i === 0) {
      prog = PROG[mode === 'boss' ? 'boss' : mode === 'gate' ? 'gate' : 'normal'];
      if (mode === 'run' || mode === 'boss') tr = TRANSPOSE[Math.min(lv - 1, TRANSPOSE.length - 1)];
      else if (mode === 'menu') tr = 0;
    }
    const chord = prog[bar].map((n) => n + tr);
    const hard = mode === 'boss' || lv >= 4;

    // Kick + Pumpen
    if (i % 4 === 0) {
      const k = v('sine', 165, t, 0.3, 1, L.kick.g);
      k.frequency.exponentialRampToValueAtTime(40, t + 0.11);
      nz(t, 0.02, 0.25, 'highpass', 3000, L.kick.g);
      pump(t, STEP);
    }
    // Clap und Wirbel am Ende jeder Phrase
    if (i === 4 || i === 12) clap(t, 0.5);
    if (bar === 3 && i >= 13) clap(t, 0.2 + (i - 13) * 0.12);
    // Hi-Hats (offen auf den Offbeats bei hartem Groove)
    if (i % 2 === 1 || hard) {
      const open = hard && i % 4 === 2;
      nz(t, open ? 0.18 : 0.035, i % 2 ? 0.16 : 0.08, 'highpass', open ? 7000 : 8500, L.hats.g);
    }
    // Bass
    const root = chord[0] - 24;
    const rolling = mode === 'boss' || lv >= 3;
    if (rolling ? ROLL[i] : i % 2 === 0) bassNote(f(root + (i % 8 === 6 ? 12 : 0)), t, STEP * (rolling ? 0.9 : 1.6));
    // Arpeggio – Menü ruhig und luftig, Boss treibend, am Gate keins
    const pat = mode === 'boss' ? ARP_BOSS : mode === 'menu' ? ARP_MENU : mode === 'gate' ? null : ARP;
    if (pat && pat[i] >= 0) {
      const n = pat[i] === 3 ? chord[0] + 12 : chord[pat[i]];
      if (mode === 'menu') v('triangle', f(n + 12), t, STEP * 3, 0.07, L.arp.g);
      else v('square', f(n + 12), t, 0.12, 0.05, L.arp.g);
    }
    // Fläche
    if (i === 0) {
      for (const m of chord) for (const det of [-10, 10]) v('sawtooth', f(m), t, STEP * 16 + 0.4, 0.03, L.pad.g, { attack: 0.5, detune: det });
    }
    // Supersaw-Stabs auf den Offbeats
    if (hard && i % 4 === 2) {
      for (const m of chord) for (const det of [-16, 0, 16]) v('sawtooth', f(m + 12), t, 0.15, 0.02, L.stab.g, { detune: det });
    }
    // Melodie
    if (i % 2 === 0) {
      const arr = mode === 'boss' ? LEAD_BOSS : LEAD_RUN;
      const note = arr[Math.floor(s / 2) % arr.length];
      if (note) {
        v('sawtooth', f(note + tr), t, STEP * 2.6, 0.06, L.lead.g, { attack: 0.01, detune: -7 });
        v('square', f(note + tr), t, STEP * 2.6, 0.035, L.lead.g, { attack: 0.01, detune: 7 });
      }
    }
    // Herzschlag bei nur noch einem Leben
    if (danger && (i === 0 || i === 3 || i === 8 || i === 11)) {
      const h = v('sine', i % 8 === 0 ? 75 : 62, t, 0.24, 1, L.heart.g);
      h.frequency.exponentialRampToValueAtTime(38, t + 0.2);
    }
  }

  function schedule() {
    if (!audio || audio.state !== 'running') return;
    if (nextTime < audio.currentTime) nextTime = audio.currentTime + 0.05;
    while (nextTime < audio.currentTime + 0.15) {
      tracking = true;
      try {
        playStep(step, nextTime);
      } finally {
        tracking = false;
      }
      nextTime += 60 / bpm() / 4;
      step = (step + 1) % 128;
    }
  }

  function mix() {
    if (mode === 'run') {
      return { kick: 1, clap: lv >= 2 ? 0.9 : 0, hats: lv >= 2 ? 1 : 0.7, bass: 1, dirt: lv >= 4 ? 0.5 : 0, arp: 0.65, pad: 0.4, lead: lv >= 3 ? 0.8 : 0, stab: lv >= 4 ? 0.7 : 0 };
    }
    return {
      off: {},
      menu: { bass: 0.45, arp: 0.55, pad: 0.9 },
      gate: { bass: 0.3, arp: 0.3, pad: 1, hats: 0.25 },
      boss: { kick: 1, clap: 1, hats: 1, bass: 1, dirt: 0.75, arp: 0.5, pad: 0.45, lead: 0.9, stab: 0.85 },
    }[mode];
  }
  function apply(fade = 0.4) {
    if (!L.kick) return;
    const m = mix();
    const now = audio.currentTime;
    for (const k of LAYERS) L[k].g.gain.setTargetAtTime(k === 'heart' ? (danger ? 1 : 0) : m[k] || 0, now, fade);
    if (mode !== 'off' && !timer) timer = setInterval(schedule, 25);
  }

  function setMode(m) {
    if (m === mode) return;
    mode = m;
    if (!L.kick) return;
    if (m !== 'off') cut();
    apply(0.08);
  }
  function setLevel(n) {
    lv = n;
    apply();
  }
  function setDanger(on) {
    if (on === danger) return;
    danger = on;
    apply();
  }
  // Gedämpfter Klang (Zeitlupe)
  function setMuffle(on) {
    if (on === muffled || !filter) return;
    muffled = on;
    filter.frequency.setTargetAtTime(on ? 700 : 18000, audio.currentTime, 0.15);
  }
  function setMuted(on) {
    if (bus) bus.gain.setTargetAtTime(on ? 0 : 0.55, audio.currentTime, 0.1);
  }

  // Spannungsaufbau: Rauschen steigt, Trommelwirbel wird immer schneller
  function riser(dur = 2) {
    if (!bus || muted) return;
    const t = audio.currentTime + 0.02;
    nz(t, dur, 0.22, 'highpass', 300, bus, { f1: 9000, attack: dur * 0.9 });
    let x = 0;
    let gap = 0.25;
    while (x < dur) {
      clap(t + x, 0.1 + (0.3 * x) / dur, bus);
      x += gap;
      gap = Math.max(0.045, gap * 0.84);
    }
    v('sawtooth', 110, t, dur, 0.04, bus, { attack: dur * 0.9 }).frequency.exponentialRampToValueAtTime(440, t + dur);
  }
  // Wuchtiger Einschlag mit Sub-Bass und Crash-Becken
  function impact() {
    if (!bus || muted) return;
    const t = audio.currentTime + 0.01;
    v('sine', 95, t, 1.4, 1, bus).frequency.exponentialRampToValueAtTime(28, t + 1.2);
    nz(t, 2.2, 0.3, 'highpass', 5000, [bus, verb]);
    nz(t, 0.4, 0.4, 'lowpass', 3000, bus, { f1: 120 });
  }
  function downlifter() {
    if (!bus || muted) return;
    nz(audio.currentTime + 0.01, 1.3, 0.22, 'bandpass', 6000, bus, { f1: 200, q: 1.2, attack: 0.02 });
  }
  // Boss-Auftritt: dunkler Bläser-Akkord, Gong und Einschlag
  function stinger() {
    if (!bus || muted) return;
    const t = audio.currentTime + 0.01;
    const flt = audio.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(200, t);
    flt.frequency.exponentialRampToValueAtTime(3200, t + 0.8);
    flt.connect(bus);
    flt.connect(verb);
    for (const m of [33, 45, 52, 57, 60]) for (const det of [-12, 12]) v('sawtooth', f(m), t, 2.6, 0.05, flt, { attack: 0.08, detune: det });
    v('sine', 110, t, 3.5, 0.35, [bus, verb]).frequency.exponentialRampToValueAtTime(70, t + 3.5);
    impact();
  }
  // Tonband-Stopp bei Game Over: Klang wird dumpf und erstirbt
  function tapeStop() {
    if (!bus) return;
    const t = audio.currentTime;
    mode = 'off';
    filter.frequency.cancelScheduledValues(t);
    filter.frequency.setValueAtTime(filter.frequency.value, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 1.4);
    bus.gain.setTargetAtTime(0, t + 0.7, 0.35);
    setTimeout(() => {
      if (mode === 'off') setMode('menu');
      muffled = false;
      filter.frequency.cancelScheduledValues(audio.currentTime);
      filter.frequency.setTargetAtTime(18000, audio.currentTime, 0.3);
      bus.gain.setTargetAtTime(muted ? 0 : 0.55, audio.currentTime, 0.6);
    }, 2000);
  }

  return { init, setMode, setLevel, setDanger, setMuffle, setMuted, riser, impact, downlifter, stinger, tapeStop };
})();

window.addEventListener('pointerdown', ensureAudio);
window.addEventListener('keydown', ensureAudio);

// ---------- Effekte ----------
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
let bitCombo = 0, bitComboAt = 0;
const note = (m) => 440 * 2 ** ((m - 69) / 12);
const sfx = {
  lane: (dir = 0) => noise(0.12, 0.08, { f0: 900, f1: 3200, q: 1.2, pan: dir * 0.5 }),
  jump: () => {
    noise(0.28, 0.07, { f0: 400, f1: 3000, q: 0.8 });
    osc('triangle', 280, 720, 0.22, 0.05);
  },
  // Datenbits in Serie steigen die Tonleiter hinauf
  bit: () => {
    const now = performance.now();
    bitCombo = now - bitComboAt < 900 ? bitCombo + 1 : 0;
    bitComboAt = now;
    const fr = note(81 + PENTA[Math.min(bitCombo, PENTA.length - 1)]);
    osc('sine', fr, 0, 0.18, 0.06);
    osc('triangle', fr * 2, 0, 0.1, 0.02, { delay: 0.03 });
  },
  hit: () => {
    osc('sine', 140, 35, 0.5, 0.5);
    noise(0.35, 0.3, { type: 'lowpass', f0: 4000, f1: 200 });
    osc('square', 110, 70, 0.25, 0.07);
    osc('square', 117, 72, 0.25, 0.07);
  },
  smash: (pan = 0) => {
    noise(0.4, 0.22, { type: 'lowpass', f0: 5000, f1: 150, pan });
    osc('sine', 100, 40, 0.3, 0.28, { pan });
  },
  laser: (pan = 0) => {
    osc('square', 1900, 280, 0.09, 0.025, { pan });
    osc('sawtooth', 2400, 600, 0.06, 0.012, { pan });
  },
  // knapp vorbeigezischt
  whoosh: (pan = 0) => noise(0.32, 0.13, { f0: 500, f1: 4200, q: 2, pan, attack: 0.1 }),
  power: () => [0, 4, 7, 12, 16].forEach((s, k) => osc('triangle', note(72 + s), 0, 0.22, 0.06, { delay: k * 0.05 })),
  gate: () => {
    for (const m of [57, 64, 69]) osc('sawtooth', note(m), 0, 1.2, 0.03, { attack: 0.3 });
    osc('sine', note(81), 0, 1, 0.04, { delay: 0.2 });
  },
  correct: () => {
    [0, 4, 7, 12].forEach((s, k) => osc('triangle', note(72 + s), 0, 0.35, 0.08, { delay: k * 0.07 }));
    osc('sine', note(96), 0, 0.7, 0.03, { delay: 0.28 });
  },
  wrong: () => {
    osc('sawtooth', 220, 110, 0.55, 0.06);
    osc('sawtooth', 233, 116, 0.55, 0.06);
  },
  scan: () => {
    noise(0.9, 0.22, { type: 'highpass', f0: 200, f1: 6000 });
    osc('sine', 60, 30, 0.9, 0.4);
  },
  levelUp: () => {
    music.impact();
    for (const m of [60, 64, 67, 72]) for (const det of [-10, 10]) osc('sawtooth', note(m), 0, 0.8, 0.025, { detune: det, delay: 0.05 });
  },
  start: () => {
    osc('sawtooth', 80, 420, 0.6, 0.05);
    noise(0.6, 0.1, { f0: 200, f1: 5000 });
  },
  powerDown: () => osc('sawtooth', 420, 30, 1.4, 0.08),
  warn: () => {
    osc('square', 880, 0, 0.14, 0.05);
    osc('square', 660, 0, 0.14, 0.05, { delay: 0.18 });
  },
  bossHit: (pan = 0) => {
    osc('square', 320, 180, 0.07, 0.035, { pan });
    noise(0.06, 0.06, { f0: 3000, pan });
  },
  shieldBlock: (pan = 0) => osc('triangle', 1800, 2400, 0.08, 0.04, { pan }),
  roar: () => {
    osc('sawtooth', 70, 45, 1.2, 0.12, { attack: 0.1 });
    osc('sawtooth', 73, 47, 1.2, 0.12, { attack: 0.1 });
    noise(1.2, 0.18, { type: 'lowpass', f0: 600, f1: 150, attack: 0.1 });
  },
  charge: (pan = 0) => osc('sawtooth', 200, 900, 0.9, 0.035, { pan, attack: 0.6 }),
  beam: (pan = 0) => {
    noise(0.55, 0.2, { type: 'lowpass', f0: 2500, f1: 400, pan });
    osc('sawtooth', 90, 60, 0.55, 0.1, { pan });
  },
  slam: () => {
    osc('sine', 80, 25, 0.9, 0.6);
    noise(0.6, 0.3, { type: 'lowpass', f0: 1500, f1: 80 });
  },
  bossDown: () => {
    for (let k = 0; k < 6; k++) {
      noise(0.6, 0.25, { type: 'lowpass', f0: 4000, f1: 100, delay: k * 0.22, pan: rand(-0.8, 0.8) });
      osc('sine', 120, 30, 0.6, 0.35, { delay: k * 0.22 });
    }
    music.impact();
  },
};

// ---------- Renderer & Szene ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);
scene.fog = new THREE.Fog(C.bg, 45, 150);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 300);
camera.position.set(0, 4.3, 7.8);

const hemi = new THREE.HemisphereLight(0xffffff, 0xaebdc9, 1.7);
scene.add(hemi);

// Glow-Effekt (Bloom) – auf Touch-Geräten aus Performance-Gründen aus
const useBloom = !window.matchMedia('(pointer: coarse)').matches;
let composer = null, bloom = null;
if (useBloom) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0, 0.45, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(5, 14, 6);
sun.target.position.set(0, 0, -8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 18, bottom: -18, near: 1, far: 50 });
scene.add(sun, sun.target);

// ---------- Strecke: Rechenzentrum ----------
const floorTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#f8fbfd';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#cfe7f4';
  g.lineWidth = 6;
  g.strokeRect(0, 0, w, h);
  g.fillStyle = '#e3f2fa';
  for (let i = 0; i < 4; i++) g.fillRect(w / 2 - 3, i * 64 + 20, 6, 24);
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
floorTex.repeat.set(3, TRACK_LEN / 5);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(8.4, TRACK_LEN),
  new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.z = -TRACK_LEN / 2 + 15;
floor.receiveShadow = true;
scene.add(floor);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(120, TRACK_LEN),
  new THREE.MeshStandardMaterial({ color: 0xdde7ee, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, -0.02, floor.position.z);
ground.receiveShadow = true;
scene.add(ground);

const edgeMat = new THREE.MeshStandardMaterial({ color: C.blue, emissive: C.blue, emissiveIntensity: 0.35 });
for (const x of [-4.3, 4.3]) {
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, TRACK_LEN), edgeMat);
  edge.position.set(x, 0.1, floor.position.z);
  scene.add(edge);
}
const laneLineMat = new THREE.MeshBasicMaterial({ color: 0xa8dcf3 });
for (const x of [-1.2, 1.2]) {
  const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, TRACK_LEN), laneLineMat);
  l.position.set(x, 0.01, floor.position.z);
  scene.add(l);
}

// Server-Racks links und rechts (die Vorderseite zeigt zur Strecke)
const rackTex = canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#3e3f42';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#009fe3';
  g.fillRect(0, 0, w, 14);
  for (let y = 24; y < h - 10; y += 19) {
    g.fillStyle = '#505155';
    rr(g, 10, y, w - 20, 14, 3);
    g.fill();
    g.fillStyle = Math.random() < 0.7 ? '#5fd3ff' : '#4ade80';
    g.fillRect(18, y + 5, 5, 4);
    g.fillStyle = '#6b6c70';
    g.fillRect(32, y + 6, 40 + Math.random() * 30, 2);
  }
});
const rackSide = new THREE.MeshStandardMaterial({ color: 0x4a4b4e, roughness: 0.6 });
const rackTop = new THREE.MeshStandardMaterial({ color: 0x5d5e61, roughness: 0.6 });
const rackFront = new THREE.MeshStandardMaterial({ map: rackTex, roughness: 0.5, emissive: 0xffffff, emissiveMap: rackTex, emissiveIntensity: 0.25 });
const rackGeo = new THREE.BoxGeometry(1.4, 3.6, 1.6);
const RACK_GAP = 7;
const RACK_COUNT = Math.ceil(165 / RACK_GAP);
const racks = [];
for (const side of [-1, 1]) {
  // BoxGeometry-Flächen: +x, -x, +y, -y, +z, -z
  const mats = side < 0
    ? [rackFront, rackSide, rackTop, rackSide, rackSide, rackSide]
    : [rackSide, rackFront, rackTop, rackSide, rackSide, rackSide];
  for (let i = 0; i < RACK_COUNT; i++) {
    const r = new THREE.Mesh(rackGeo, mats);
    r.position.set(side * 5.6, 1.8, 10 - i * RACK_GAP);
    r.castShadow = true;
    r.receiveShadow = true;
    scene.add(r);
    racks.push(r);
  }
}
// Kabelbrücken über der Strecke
const beamMat = new THREE.MeshStandardMaterial({ color: 0x9c9da0, roughness: 0.5 });
const beams = [];
const signs = [];
// dplan-Schild auf jeder zweiten Kabelbrücke
const logoMap = new THREE.TextureLoader().load('assets/dplan-logo.png');
logoMap.colorSpace = THREE.SRGBColorSpace;
const signPanelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.15 });
const signLogoMat = new THREE.MeshBasicMaterial({ map: logoMap, transparent: true });
for (let i = 0; i < 6; i++) {
  const b = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.18, 0.5), beamMat);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.05, 0.12), edgeMat);
  glow.position.y = -0.11;
  b.add(bar, glow);
  if (i % 2 === 0) {
    const panel = new THREE.Mesh(new RoundedBoxGeometry(3.9, 1.35, 0.12, 2, 0.06), signPanelMat);
    panel.position.set(0, 0.85, 0);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.06, 0.14), edgeMat);
    frame.position.set(0, 0.16, 0);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1.09), signLogoMat);
    logo.position.set(0, 0.85, 0.07);
    const sign = new THREE.Group();
    sign.add(panel, frame, logo);
    b.add(sign);
    signs.push(sign);
  }
  b.position.set(0, 3.9, 10 - i * 28);
  scene.add(b);
  beams.push(b);
}
// Datenströme am Rand für Tempo-Gefühl
const streamMat = new THREE.MeshBasicMaterial({ color: 0x5fd3ff });
const streamGeo = new THREE.BoxGeometry(0.07, 0.07, 1.6);
const streams = [];
for (let i = 0; i < 26; i++) {
  const s = new THREE.Mesh(streamGeo, streamMat);
  s.position.set(pick([-3.95, 3.95, -4.65, 4.65]), rand(0.15, 0.35), rand(SPAWN_Z, 10));
  scene.add(s);
  streams.push(s);
}
// Datenregen hinter den Racks
const rainMat = new THREE.MeshBasicMaterial({ color: 0x5fd3ff, transparent: true, opacity: 0.55 });
const rainGeo = new THREE.BoxGeometry(0.05, 1.4, 0.05);
const rain = [];
for (let i = 0; i < 50; i++) {
  const r = new THREE.Mesh(rainGeo, rainMat);
  r.position.set(pick([-1, 1]) * rand(7.5, 16), rand(0, 16), rand(SPAWN_Z, 10));
  r.userData.vy = rand(4, 9);
  scene.add(r);
  rain.push(r);
}

// Druckwellen am Boden (bei zerstörten Hindernissen und beim Scan)
const waveGeo = new THREE.RingGeometry(0.75, 1, 40);
const waves = [];
for (let i = 0; i < 10; i++) {
  const m = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: C.blue, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.visible = false;
  scene.add(m);
  waves.push({ mesh: m, life: 0, max: 1, size: 1 });
}
let waveIdx = 0;
function shockwave(x, z, color, size = 3, dur = 0.5) {
  const w = waves[waveIdx++ % waves.length];
  w.mesh.material.color.setHex(color);
  w.mesh.position.set(x, 0.05, z);
  w.mesh.visible = true;
  w.life = w.max = dur;
  w.size = size;
}

// ---------- Spielfigur: dp-Datenchip ----------
// Logo-Flächen (oben + Rückseite zur Kamera) und Leiterbahnen auf den übrigen Seiten.
// Die Bahnen und der Logo-Ring leuchten über eine Emissive-Map und pulsieren im Spiel.
const SKINS = {
  classic: { name: 'Classic', frame: ['#c4c5c7', '#808184'], face: '#ffffff', trace: '#009fe3', text: '#009fe3', glow: 0x009fe3 },
  night:   { name: 'Night',   frame: ['#3a3c40', '#1c1e21'], face: '#16191d', trace: '#38d6ff', text: '#38d6ff', glow: 0x38d6ff },
  ice:     { name: 'Ice',     frame: ['#ffffff', '#cfe0ea'], face: '#ffffff', trace: '#5fc8f5', text: '#009fe3', glow: 0x5fc8f5 },
};

function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function frameFill(g, w, h, skin) {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, skin.frame[0]);
  grad.addColorStop(1, skin.frame[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

// Zeichnet Leiterbahnen; bei glow=true nur die leuchtenden Teile auf Schwarz (Emissive-Map)
function drawTraces(g, w, h, color, glow) {
  const rnd = seeded(7);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 14; i++) {
    const side = i % 4;
    let x = side === 0 ? 0 : side === 1 ? w : 30 + rnd() * (w - 60);
    let y = side === 2 ? 0 : side === 3 ? h : 30 + rnd() * (h - 60);
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 3; s++) {
      if ((s + side) % 2 === 0) x = clamp(x + (rnd() - 0.5) * 140 + (w / 2 - x) * 0.4, 24, w - 24);
      else y = clamp(y + (rnd() - 0.5) * 140 + (h / 2 - y) * 0.4, 24, h - 24);
      g.lineTo(x, y);
    }
    g.stroke();
    g.beginPath();
    g.arc(x, y, 8, 0, Math.PI * 2);
    g.fill();
  }
  // Chip in der Mitte
  g.lineWidth = 6;
  rr(g, w / 2 - 46, h / 2 - 46, 92, 92, 12);
  if (glow) g.stroke();
  else {
    g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fill();
  }
}

const skinCache = {};
function skinMaterials(key) {
  if (skinCache[key]) return skinCache[key];
  const skin = SKINS[key];
  const logo = canvasTex(256, 256, (g, w, h) => {
    frameFill(g, w, h, skin);
    g.fillStyle = skin.face;
    rr(g, 18, 18, w - 36, h - 36, 34);
    g.fill();
    g.strokeStyle = skin.trace;
    g.lineWidth = 5;
    rr(g, 30, 30, w - 60, h - 60, 26);
    g.stroke();
    g.fillStyle = skin.text;
    g.font = `bold 128px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('dp', w / 2, h / 2 + 6);
  });
  const logoGlow = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = skin.trace;
    g.lineWidth = 5;
    rr(g, 30, 30, w - 60, h - 60, 26);
    g.stroke();
    if (key === 'night') {
      g.fillStyle = skin.text;
      g.font = `bold 128px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('dp', w / 2, h / 2 + 6);
    }
  });
  const circuit = canvasTex(256, 256, (g, w, h) => {
    frameFill(g, w, h, skin);
    drawTraces(g, w, h, skin.trace, false);
  });
  const circuitGlow = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    drawTraces(g, w, h, skin.trace, true);
  });
  const metal = key === 'ice' ? 0.05 : 0.35;
  const side = new THREE.MeshStandardMaterial({ map: circuit, emissive: 0xffffff, emissiveMap: circuitGlow, roughness: 0.35, metalness: metal });
  const face = new THREE.MeshStandardMaterial({ map: logo, emissive: 0xffffff, emissiveMap: logoGlow, roughness: 0.35, metalness: metal * 0.5 });
  // BoxGeometry-Flächen: +x, -x, +y (oben), -y, +z (zur Kamera), -z
  skinCache[key] = { list: [side, side, face, side, face, side], glowing: [side, face], glow: skin.glow };
  return skinCache[key];
}

const PLAYER_SIZE = 1.2;
const HOVER = 0.22; // der Chip schwebt knapp über der Strecke
let skinKey = SKINS[store.get('dplan-runner-skin', 'classic')] ? store.get('dplan-runner-skin', 'classic') : 'classic';
let skin = skinMaterials(skinKey);
const playerMesh = new THREE.Mesh(new RoundedBoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE, 4, 0.18), skin.list);
playerMesh.castShadow = true;
const playerGroup = new THREE.Group();
playerMesh.position.y = PLAYER_SIZE / 2 + HOVER;
playerGroup.add(playerMesh);

// Kreisende Datenbits
const orbit = new THREE.Group();
const orbitMat = new THREE.MeshBasicMaterial({ color: skin.glow });
for (let i = 0; i < 3; i++) {
  const b = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), orbitMat);
  const a = (i / 3) * Math.PI * 2;
  b.position.set(Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0);
  orbit.add(b);
}
orbit.rotation.x = 0.35;
playerGroup.add(orbit);

// Leuchten am Boden unter dem schwebenden Chip
const glowTex = canvasTex(128, 128, (g, w, h) => {
  const rg = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, w, h);
});
const groundGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(2.6, 2.6),
  new THREE.MeshBasicMaterial({ map: glowTex, color: skin.glow, transparent: true, opacity: 0.6, depthWrite: false }),
);
groundGlow.rotation.x = -Math.PI / 2;
groundGlow.position.y = 0.03;
scene.add(groundGlow);

// Lichtspuren hinter dem Chip
const trailGeo = new THREE.BoxGeometry(0.09, 0.04, 0.5);
const trail = [];
for (let i = 0; i < 60; i++) {
  const m = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: skin.glow, transparent: true, depthWrite: false }));
  m.visible = false;
  scene.add(m);
  trail.push({ mesh: m, life: 0 });
}
let trailIdx = 0, trailT = 0;
function updateTrail(dt, dz) {
  if (state === 'playing' && playerGroup.visible) {
    trailT -= dt;
    if (trailT <= 0) {
      trailT = 0.02;
      for (const side of [-1, 1]) {
        const p = trail[trailIdx++ % trail.length];
        p.life = 0.45;
        p.mesh.visible = true;
        p.mesh.position.set(player.x + side * 0.42, player.y + HOVER + 0.12, 0.55);
        p.mesh.scale.set(1, 1, 1);
      }
    }
  }
  for (const p of trail) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.mesh.position.z += dz;
    p.mesh.material.opacity = Math.max(0, p.life / 0.45) * 0.8;
    p.mesh.scale.x = p.mesh.scale.y = Math.max(0.1, p.life / 0.45);
    if (p.life <= 0) p.mesh.visible = false;
  }
}

function applySkin(key) {
  if (!SKINS[key]) return;
  skinKey = key;
  skin = skinMaterials(key);
  playerMesh.material = skin.list;
  orbitMat.color.setHex(skin.glow);
  groundGlow.material.color.setHex(skin.glow);
  for (const p of trail) p.mesh.material.color.setHex(skin.glow);
  store.set('dplan-runner-skin', key);
  document.querySelectorAll('.skin-btn').forEach((b) => b.classList.toggle('active', b.dataset.skin === key));
}
const shield = new THREE.Mesh(
  new THREE.SphereGeometry(1.05, 24, 16),
  new THREE.MeshBasicMaterial({ color: C.fire, transparent: true, opacity: 0.22, depthWrite: false }),
);
shield.position.y = PLAYER_SIZE / 2 + HOVER;
shield.visible = false;
const magnet = new THREE.Mesh(
  new THREE.TorusGeometry(1.0, 0.05, 8, 40),
  new THREE.MeshBasicMaterial({ color: C.blue, transparent: true, opacity: 0.7 }),
);
magnet.rotation.x = Math.PI / 2;
magnet.position.y = 0.15;
magnet.visible = false;
playerGroup.add(shield, magnet);
scene.add(playerGroup);

const player = { lane: 1, x: 0, y: 0, vy: 0, spin: 0, invuln: 0, tumble: 0 };

// ---------- Bedrohungen ----------
const virusGeo = (() => {
  const parts = [new THREE.IcosahedronGeometry(0.46, 1)];
  const dirs = new THREE.IcosahedronGeometry(1, 0).getAttribute('position');
  const up = new THREE.Vector3(0, 1, 0);
  const seen = new Set();
  for (let i = 0; i < dirs.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(dirs, i).normalize();
    const key = v.toArray().map((n) => n.toFixed(2)).join();
    if (seen.has(key)) continue;
    seen.add(key);
    const q = new THREE.Quaternion().setFromUnitVectors(up, v);
    const cone = new THREE.CylinderGeometry(0.05, 0.08, 0.3, 6).toNonIndexed();
    cone.translate(0, 0.58, 0);
    cone.applyQuaternion(q);
    const tip = new THREE.SphereGeometry(0.1, 8, 6).toNonIndexed();
    tip.translate(0, 0.76, 0);
    tip.applyQuaternion(q);
    parts.push(cone, tip);
  }
  return mergeGeometries(parts);
})();
const eyeGeo = mergeGeometries([
  new THREE.SphereGeometry(0.14, 12, 8).translate(-0.18, 0.1, 0.38),
  new THREE.SphereGeometry(0.14, 12, 8).translate(0.18, 0.1, 0.38),
]);
const pupilGeo = mergeGeometries([
  new THREE.SphereGeometry(0.07, 10, 8).translate(-0.18, 0.08, 0.5),
  new THREE.SphereGeometry(0.07, 10, 8).translate(0.18, 0.08, 0.5),
]);
const M = {
  virus: new THREE.MeshStandardMaterial({ color: C.red, roughness: 0.45 }),
  eye: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
  pupil: new THREE.MeshStandardMaterial({ color: 0x1f2933, roughness: 0.3 }),
  bug: new THREE.MeshStandardMaterial({ color: C.green, roughness: 0.4 }),
  bugDark: new THREE.MeshStandardMaterial({ color: 0x17694a, roughness: 0.5 }),
  ransom: new THREE.MeshStandardMaterial({ color: C.purple, roughness: 0.4 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb8b9bc, roughness: 0.25, metalness: 0.6 }),
  orange: new THREE.MeshStandardMaterial({ color: C.orange, roughness: 0.5 }),
  line: new THREE.MeshStandardMaterial({ color: 0x5d5e61 }),
  spam: new THREE.MeshStandardMaterial({ color: 0x9c9da0, roughness: 0.6 }),
};

const ransomFace = new THREE.MeshStandardMaterial({
  roughness: 0.4,
  map: canvasTex(256, 210, (g, w, h) => {
    g.fillStyle = '#7c5cd6';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b2140';
    g.beginPath();
    g.arc(w / 2, 78, 26, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(w / 2 - 14, 90);
    g.lineTo(w / 2 + 14, 90);
    g.lineTo(w / 2 + 22, 140);
    g.lineTo(w / 2 - 22, 140);
    g.closePath();
    g.fill();
    g.fillStyle = '#fff';
    g.font = `bold 26px ${FONT}`;
    g.textAlign = 'center';
    g.fillText('RANSOMWARE', w / 2, 186);
  }),
});
const envelopeFace = (color, label) => new THREE.MeshStandardMaterial({
  roughness: 0.5,
  map: canvasTex(256, 170, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff';
    g.lineWidth = 9;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(14, 14);
    g.lineTo(w / 2, h * 0.58);
    g.lineTo(w - 14, 14);
    g.stroke();
    if (label) {
      g.fillStyle = '#fff';
      g.font = `bold 30px ${FONT}`;
      g.textAlign = 'center';
      g.fillText(label, w / 2, h - 18);
    }
  }),
});
const phishFace = envelopeFace('#f08a24', 'PHISHING');
const spamFace = new THREE.MeshStandardMaterial({
  roughness: 0.6,
  map: canvasTex(512, 96, (g, w, h) => {
    g.fillStyle = '#9c9da0';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const x = 20 + i * 124;
      g.fillStyle = '#fff';
      rr(g, x, 22, 84, 54, 6);
      g.fill();
      g.strokeStyle = '#9c9da0';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x + 6, 28);
      g.lineTo(x + 42, 54);
      g.lineTo(x + 78, 28);
      g.stroke();
      g.fillStyle = '#e5484d';
      g.beginPath();
      g.arc(x + 84, 24, 13, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.font = `bold 18px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('!', x + 84, 25);
    }
  }),
});

const G = {
  bugBody: new THREE.SphereGeometry(0.5, 20, 14).scale(1.1, 0.75, 1.5),
  bugHead: new THREE.SphereGeometry(0.3, 16, 12),
  bugLegs: mergeGeometries([-1, 0, 1].flatMap((i) => [-1, 1].map((s) =>
    new THREE.BoxGeometry(0.55, 0.06, 0.06).translate(s * 0.75, 0.12, i * 0.38)))),
  ransomBody: new RoundedBoxGeometry(1.7, 1.4, 0.7, 3, 0.12),
  ransomShackle: new THREE.TorusGeometry(0.5, 0.13, 10, 24, Math.PI),
  envelope: new THREE.BoxGeometry(1.5, 1.0, 0.14),
  hookLine: new THREE.CylinderGeometry(0.02, 0.02, 2.4, 6),
  hook: new THREE.TorusGeometry(0.16, 0.035, 6, 16, Math.PI * 1.3),
  spam: new RoundedBoxGeometry(4.4, 0.85, 0.5, 2, 0.08),
  bit: new THREE.OctahedronGeometry(0.28),
};
const bitMat = new THREE.MeshStandardMaterial({ color: C.blue, emissive: C.blueDark, emissiveIntensity: 0.6, roughness: 0.3 });
// Geschosse der Bosse
G.drone = new RoundedBoxGeometry(0.8, 0.6, 0.8, 2, 0.1);
G.droneEye = new THREE.SphereGeometry(0.16, 10, 8);
G.wave = new THREE.BoxGeometry(7.6, 0.5, 0.35);
M.drone = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.3, metalness: 0.6 });
M.droneEye = new THREE.MeshBasicMaterial({ color: 0xff3355 });
M.wave = new THREE.MeshStandardMaterial({ color: 0xff5a36, emissive: 0xff5a36, emissiveIntensity: 0.9 });

function shadowed(obj) {
  obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return obj;
}

function buildObstacle(type) {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  g.add(spin);
  let dims;
  if (type === 'virus') {
    spin.add(new THREE.Mesh(virusGeo, M.virus));
    spin.position.y = 0.6;
    const eyes = new THREE.Group();
    eyes.add(new THREE.Mesh(eyeGeo, M.eye), new THREE.Mesh(pupilGeo, M.pupil));
    eyes.position.y = 0.6;
    g.add(eyes);
    dims = { w: 1.1, d: 1.0, yMin: 0, yMax: 1.05 };
  } else if (type === 'bug') {
    const body = new THREE.Mesh(G.bugBody, M.bug);
    body.position.y = 0.38;
    const head = new THREE.Mesh(G.bugHead, M.bugDark);
    head.position.set(0, 0.42, 0.75);
    const legs = new THREE.Mesh(G.bugLegs, M.bugDark);
    spin.add(body, head, legs);
    dims = { w: 1.3, d: 1.5, yMin: 0, yMax: 0.72 };
  } else if (type === 'ransom') {
    const body = new THREE.Mesh(G.ransomBody, [M.ransom, M.ransom, M.ransom, M.ransom, ransomFace, M.ransom]);
    body.position.y = 0.7;
    const shackle = new THREE.Mesh(G.ransomShackle, M.metal);
    shackle.position.y = 1.4;
    spin.add(body, shackle);
    dims = { w: 1.7, d: 0.8, yMin: 0, yMax: 2.1 };
  } else if (type === 'phishing') {
    const env = new THREE.Mesh(G.envelope, [M.orange, M.orange, M.orange, M.orange, phishFace, M.orange]);
    const line = new THREE.Mesh(G.hookLine, M.line);
    line.position.y = 1.75;
    const hook = new THREE.Mesh(G.hook, M.metal);
    hook.position.set(-0.1, 0.55, 0.1);
    hook.rotation.z = Math.PI;
    spin.add(env, line, hook);
    spin.position.y = 1.3;
    dims = { w: 1.5, d: 0.4, yMin: 0.8, yMax: 1.8 };
  } else if (type === 'spam') {
    const wall = new THREE.Mesh(G.spam, [M.spam, M.spam, M.spam, M.spam, spamFace, M.spam]);
    wall.position.y = 0.43;
    spin.add(wall);
    dims = { w: 4.4, d: 0.5, yMin: 0, yMax: 0.85 };
  } else if (type === 'drone') {
    const body = new THREE.Mesh(G.drone, M.drone);
    const eye = new THREE.Mesh(G.droneEye, M.droneEye);
    eye.position.z = 0.38;
    spin.add(body, eye);
    spin.position.y = 1.0;
    dims = { w: 1.0, d: 0.8, yMin: 0.4, yMax: 1.6 };
  } else if (type === 'wave') {
    // Druckwelle über alle Spuren – nur Springen hilft
    const wall = new THREE.Mesh(G.wave, M.wave);
    wall.position.y = 0.25;
    spin.add(wall);
    dims = { w: 7.6, d: 0.5, yMin: 0, yMax: 0.55 };
  }
  return { mesh: shadowed(g), spin, ...dims };
}

const labelTexCache = {};
function labelTex(key) {
  if (!labelTexCache[key]) {
    const def = POWER[key];
    labelTexCache[key] = canvasTex(256, 80, (g, w, h) => {
      g.fillStyle = def.color;
      rr(g, 4, 4, w - 8, h - 8, 36);
      g.fill();
      g.fillStyle = '#fff';
      g.font = `bold 38px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(def.label, w / 2, h / 2 + 2);
    });
  }
  return labelTexCache[key];
}

// ---------- Security-Gate ----------
const letterTex = ['A', 'B', 'C'].map((ch) => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#009fe3';
  rr(g, 6, 6, w - 12, h - 12, 22);
  g.fill();
  g.fillStyle = '#fff';
  g.font = `bold 84px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, w / 2, h / 2 + 4);
}));
const gateSignTex = canvasTex(512, 80, (g, w, h) => {
  g.fillStyle = '#8c8c8f';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff';
  g.font = `bold 44px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('SECURITY-GATE', w / 2, h / 2 + 2);
});
const postMat = new THREE.MeshStandardMaterial({ color: C.blue, roughness: 0.4, emissive: C.blue, emissiveIntensity: 0.2 });

function buildGate() {
  const g = new THREE.Group();
  for (const x of [-3.6, -1.2, 1.2, 3.6]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.22), postMat);
    p.position.set(x, 1.7, 0);
    g.add(p);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.3, 0.3), postMat);
  beam.position.y = 3.4;
  g.add(beam);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.66), new THREE.MeshBasicMaterial({ map: gateSignTex }));
  sign.position.set(0, 3.95, 0);
  g.add(sign);
  const curtains = [];
  LANES.forEach((x, i) => {
    const letter = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: letterTex[i], transparent: true }));
    letter.position.set(x, 2.75, 0.02);
    const curtain = new THREE.Mesh(
      new THREE.PlaneGeometry(2.25, 2.2),
      new THREE.MeshBasicMaterial({ color: C.blue, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
    );
    curtain.position.set(x, 1.1, 0);
    g.add(letter, curtain);
    curtains.push(curtain);
  });
  g.traverse((o) => { if (o.isMesh && o.material === postMat) o.castShadow = true; });
  return { mesh: g, curtains };
}

// ---------- Partikel ----------
const particleGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
const particles = [];
for (let i = 0; i < 90; i++) {
  const p = new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ color: C.blue, transparent: true }));
  p.visible = false;
  scene.add(p);
  particles.push({ mesh: p, v: new THREE.Vector3(), life: 0, max: 1 });
}
let particleIdx = 0;
function burst(pos, color, n = 16, power = 6) {
  for (let i = 0; i < n; i++) {
    const p = particles[particleIdx++ % particles.length];
    p.mesh.visible = true;
    p.mesh.position.copy(pos);
    p.mesh.material.color.setHex(color);
    p.v.set(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).multiplyScalar(power);
    p.life = p.max = rand(0.4, 0.9);
  }
}

// ---------- Lichtstimmung (wechselt sanft mit der Stufe) ----------
const COLOR_KEYS = ['bg', 'floor', 'ground', 'lane'];
const NUM_KEYS = ['hemi', 'sun', 'rack', 'edge', 'glow', 'bloom'];
const themeNow = { ...THEMES[0] };
for (const key of COLOR_KEYS) themeNow[key] = new THREE.Color(THEMES[0][key]);
let themeTarget = 0;
// Hindernisse leuchten nachts in ihrer eigenen Farbe
const glowMats = [M.virus, M.bug, M.ransom, M.orange, M.spam];
for (const m of glowMats) m.emissive = m.color.clone();
const tmpC = new THREE.Color();
function updateTheme(dt) {
  const target = THEMES[themeTarget];
  const k = Math.min(1, dt * 0.8);
  for (const key of COLOR_KEYS) themeNow[key].lerp(tmpC.setHex(target[key]), k);
  for (const key of NUM_KEYS) themeNow[key] += (target[key] - themeNow[key]) * k;
  scene.background.copy(themeNow.bg);
  scene.fog.color.copy(themeNow.bg);
  floor.material.color.copy(themeNow.floor);
  ground.material.color.copy(themeNow.ground);
  laneLineMat.color.copy(themeNow.lane);
  hemi.intensity = themeNow.hemi;
  sun.intensity = themeNow.sun;
  rackFront.emissiveIntensity = themeNow.rack;
  edgeMat.emissiveIntensity = themeNow.edge;
  for (const m of glowMats) m.emissiveIntensity = themeNow.glow;
  signPanelMat.emissiveIntensity = 0.15 + themeNow.glow * 0.25;
  signLogoMat.color.setScalar(1 - themeNow.glow * 0.7); // nachts nicht überstrahlen
  rainMat.opacity = 0.35 + themeNow.glow;
  // Bosskampf: Umgebung glüht bedrohlich rot
  bossMix += ((boss || bossPending ? 1 : 0) - bossMix) * Math.min(1, dt * 1.2);
  if (bossMix > 0.01) {
    tmpC.setHex(0x8a1022);
    scene.background.lerp(tmpC, bossMix * 0.6);
    scene.fog.color.lerp(tmpC, bossMix * 0.6);
    floor.material.color.lerp(tmpC.setHex(0xffb3bd), bossMix * 0.6);
    laneLineMat.color.lerp(tmpC.setHex(0xff4d6a), bossMix * 0.7);
  }
  for (const s of signs) s.visible = bossMix < 0.3;
  if (bloom) {
    bloom.strength = themeNow.bloom + bossMix * 0.35;
    bloom.enabled = bloom.strength > 0.02; // tagsüber kein Glow, spart auch Leistung
  }
}

// ---------- Laser (Power-up ANTIVIRUS) ----------
const boltGeo = new THREE.BoxGeometry(0.12, 0.12, 1.1);
const boltMat = new THREE.MeshBasicMaterial({ color: 0x5fffe0 });
let bolts = [];
let boltT = 0;
function fireBolt() {
  const m = new THREE.Mesh(boltGeo, boltMat);
  m.position.set(player.x, player.y + HOVER + 0.6, -0.9);
  scene.add(m);
  bolts.push({ mesh: m });
  sfx.laser(player.x / 3);
}

// Scan-Welle: läuft von der Spielfigur nach vorne und zerstört alles, was sie erreicht
let scanWave = null;
const scanMesh = new THREE.Mesh(
  new THREE.TorusGeometry(1, 0.08, 8, 48),
  new THREE.MeshBasicMaterial({ color: 0xb9a6ff, transparent: true, depthWrite: false }),
);
scanMesh.visible = false;
scene.add(scanMesh);

// ---------- Spielzustand ----------
// gate: Spiel steht vor einem Security-Gate still (gatePhase: choose | reveal)
let state = 'menu'; // menu | playing | gate | paused | dying | over
let speed = 10, dist = 0, score = 0, lives = MAX_LIVES, elapsed = 0;
let rowCursor = 0, nextGateAt = FIRST_GATE, gate = null;
let gatePending = false, gatePhase = null;
let gatesAsked = 0, gatesCorrect = 0, shake = 0, dyingT = 0;
let level = 1, levelT = 0;
const freshPowers = () => Object.fromEntries(TIMED.map((k) => [k, 0]));
let powers = freshPowers();
// Punkte-Multiplikator: höhere Stufen zählen mehr, 2FA verdoppelt
const scoreMult = () => (1 + (level - 1) * 0.25) * (powers.twofa > 0 ? 2 : 1);
let objects = [];
let deck = [];

function clearObjects() {
  for (const o of objects) scene.remove(o.mesh);
  objects = [];
  if (gate) scene.remove(gate.mesh);
  gate = null;
  for (const b of bolts) scene.remove(b.mesh);
  bolts = [];
  scanWave = null;
  scanMesh.visible = false;
}

function resetGame() {
  clearObjects();
  removeBoss();
  bossCount = 0;
  speed = SPEED_START; dist = 0; score = 0; lives = MAX_LIVES; elapsed = 0;
  rowCursor = 45; nextGateAt = FIRST_GATE;
  gatePending = false; gatePhase = null;
  gatesAsked = 0; gatesCorrect = 0; shake = 0;
  level = 1; levelT = 0; themeTarget = 0;
  powers = freshPowers();
  Object.assign(player, { lane: 1, x: 0, y: 0, vy: 0, spin: 0, invuln: 0, tumble: 0 });
  playerGroup.rotation.set(0, 0, 0);
  playerMesh.rotation.set(0, 0, 0);
  playerGroup.visible = true;
  $('gatePanel').classList.add('hidden');
}

function newGame() {
  resetGame();
  state = 'playing';
  music.setLevel(1);
  music.setMode('run');
  sfx.start();
  $('hud').classList.remove('hidden');
  show(null);
  hudCache = {};
}

function addObstacle(type, lane, z = SPAWN_Z) {
  const o = buildObstacle(type);
  o.kind = 'obs';
  o.type = type;
  o.t = 0;
  o.phase = Math.random() * Math.PI * 2;
  o.x = type === 'spam' ? (LANES[lane] + LANES[lane + 1]) / 2 : type === 'wave' ? 0 : LANES[lane];
  o.baseX = o.x;
  o.lane = lane;
  o.hp = type === 'ransom' ? 3 : 1;
  // ab Stufe 5 wechseln manche Viren unterwegs die Spur
  o.wander = type === 'virus' && level >= 5 && Math.random() < 0.35;
  o.mesh.position.set(o.x, 0, z);
  scene.add(o.mesh);
  objects.push(o);
  return o;
}

function destroyObstacle(o, color) {
  if (o.dead) return;
  o.dead = true;
  const pts = Math.round(50 * scoreMult());
  score += pts;
  const z = o.mesh.position.z;
  burst(tmpV.set(o.x, 0.8, z), color ?? ENEMY_COLOR[o.type], 20, 7);
  shockwave(o.x, z, color ?? ENEMY_COLOR[o.type], 3.2, 0.45);
  sfx.smash(o.x / 3);
}
const ENEMY_COLOR = { virus: C.red, bug: C.green, ransom: C.purple, phishing: C.orange, spam: C.grey, drone: 0xff3355, wave: 0xff5a36 };

function addBits(lane, z = SPAWN_Z, count = 5, arc = false) {
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(G.bit, bitMat);
    const y = arc ? 0.8 + Math.sin((i / (count - 1)) * Math.PI) * 1.6 : 0.8;
    m.position.set(LANES[lane], y, z - i * 2.2);
    m.castShadow = true;
    scene.add(m);
    objects.push({ kind: 'bit', mesh: m, x: LANES[lane] });
  }
}

// Power-up-Kapsel: leuchtender Kern mit Ring, darüber das Label
const powerMatCache = {};
const powerCoreGeo = new THREE.IcosahedronGeometry(0.34, 0);
const powerRingGeo = new THREE.TorusGeometry(0.58, 0.04, 8, 32);
function addPower(lane, z = SPAWN_Z) {
  const keys = Object.keys(POWER).filter((k) => POWER[k].level <= level);
  const type = lives < MAX_LIVES && Math.random() < 0.3 ? 'backup' : pick(keys);
  const col = parseInt(POWER[type].color.slice(1), 16);
  powerMatCache[type] ??= new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.3 });
  const g = new THREE.Group();
  const core = new THREE.Mesh(powerCoreGeo, powerMatCache[type]);
  const ring = new THREE.Mesh(powerRingGeo, powerMatCache[type]);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(type), depthWrite: false }));
  label.scale.set(1.7, 0.53, 1);
  label.position.y = 0.85;
  g.add(core, ring, label);
  g.position.set(LANES[lane], 1.0, z);
  scene.add(g);
  objects.push({ kind: 'pow', type, mesh: g, core, ring, x: LANES[lane], t: 0 });
}

// Gibt zurück, wie viel zusätzlicher Abstand bis zur nächsten Reihe nötig ist
function spawnRow() {
  const types = Object.keys(UNLOCK_LEVEL).filter((t) => level >= UNLOCK_LEVEL[t] && !(t === 'bug' && dist < 120));
  const single = types.filter((t) => t !== 'spam');
  const jumpables = single.filter((t) => t === 'virus' || t === 'bug');
  const lanes = shuffle([0, 1, 2]);
  let free = lanes[2];
  let extra = 0;
  const r = Math.random();

  if (level >= 3 && r < 0.12) {
    // Sprung-Reihe: alle drei Spuren belegt, nur Springen hilft
    for (const l of [0, 1, 2]) addObstacle(pick(jumpables), l);
    addBits(lanes[0], SPAWN_Z + 4, 4, true);
    free = -1;
  } else if (level >= 4 && r < 0.26) {
    // Slalom: mehrere Reihen kurz hintereinander, jeweils eine Spur frei
    const gap = Math.max(11, speed * 0.42);
    let lane = Math.floor(Math.random() * 3);
    const rows = level >= 6 ? 4 : 3;
    for (let k = 0; k < rows; k++) {
      for (const l of [0, 1, 2]) if (l !== lane) addObstacle(pick(single.filter((t) => t !== 'phishing')), l, SPAWN_Z - k * gap);
      addBits(lane, SPAWN_Z - k * gap, 1);
      lane = clamp(lane + pick([-1, 1]), 0, 2);
    }
    extra = gap * (rows - 1);
    free = -1;
  } else if (types.includes('spam') && r < 0.4) {
    const left = Math.random() < 0.5 ? 0 : 1;
    addObstacle('spam', left);
    free = left === 0 ? 2 : 0;
    addBits(left, SPAWN_Z + 4, 4, true);
    // ab Stufe 3 steht oft noch etwas in der freien Spur dahinter
    if (level >= 3 && Math.random() < 0.5) addObstacle(pick(jumpables), free, SPAWN_Z - 10);
  } else {
    const type = pick(single);
    addObstacle(type, lanes[0]);
    const doubleChance = level >= 2 ? Math.min(0.7, 0.25 + (level - 2) * 0.12) : 0.1;
    if (type !== 'phishing' && Math.random() < doubleChance) {
      addObstacle(pick(single.filter((t) => t !== 'phishing')), lanes[1]);
    } else {
      free = Math.random() < 0.5 ? lanes[1] : lanes[2];
    }
  }
  if (free >= 0 && Math.random() < 0.65) addBits(free, SPAWN_Z - 3);
  if (Math.random() < 0.09) addPower(free >= 0 ? free : lanes[0], SPAWN_Z - 14 - extra);
  return extra;
}

// ---------- Security-Gate Ablauf ----------
let currentQ = null;
let gateAnswers = [];

// Ablauf: Hindernisse abwarten → Tor taucht auf → Spiel hält an (choose)
// → Antwort wählen (reveal, Erklärung lesen) → «Weiter» → durchs Tor fahren
function spawnGate() {
  if (!QUESTIONS.length) { nextGateAt = Infinity; return; }
  if (!deck.length) deck = shuffle(QUESTIONS.slice());
  currentQ = deck.pop();
  gateAnswers = shuffle(currentQ.a.map((text, i) => ({ text, ok: i === 0 })));
  gate = buildGate();
  gate.mesh.position.z = -75;
  scene.add(gate.mesh);
  gatesAsked++;
  music.riser(1.8);
  const box = $('gateOpts');
  box.innerHTML = '';
  const where = ['links', 'Mitte', 'rechts'];
  gateAnswers.forEach((a, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'gate-opt';
    const b = document.createElement('b');
    b.textContent = 'ABC'[i];
    const s = document.createElement('span');
    s.textContent = a.text;
    const sm = document.createElement('small');
    sm.textContent = where[i];
    el.append(b, s, sm);
    el.addEventListener('click', () => {
      if (gatePhase !== 'choose') return;
      player.lane = i;
      chooseAnswer();
    });
    box.appendChild(el);
  });
}

function startChoose() {
  state = 'gate';
  gatePhase = 'choose';
  music.setMode('gate');
  music.downlifter();
  $('gateQ').textContent = currentQ.q;
  $('gateHint').classList.remove('hidden');
  $('gateResult').classList.add('hidden');
  $('gatePanel').classList.remove('hidden');
  highlightLane();
  sfx.gate();
}

function highlightLane() {
  [...$('gateOpts').children].forEach((el, i) => el.classList.toggle('active', i === player.lane));
  if (gate) gate.curtains.forEach((c, i) => { c.material.opacity = i === player.lane ? 0.3 : 0.12; });
}

function chooseAnswer() {
  if (gatePhase !== 'choose') return;
  gatePhase = 'reveal';
  const lane = player.lane;
  const ok = gateAnswers[lane].ok;
  [...$('gateOpts').children].forEach((el, i) => {
    el.disabled = true;
    el.classList.remove('active');
    el.classList.add(gateAnswers[i].ok ? 'correct' : i === lane ? 'wrong' : 'dim');
    gate.curtains[i].material.color.setHex(gateAnswers[i].ok ? C.green : i === lane ? C.red : C.grey);
    gate.curtains[i].material.opacity = gateAnswers[i].ok || i === lane ? 0.35 : 0.08;
  });
  const tip = $('gateTip');
  tip.className = 'gate-tip' + (ok ? '' : ' bad');
  tip.textContent = '';
  const strong = document.createElement('strong');
  if (ok) {
    gatesCorrect++;
    const bonus = 250 * gatesCorrect;
    score += bonus;
    lives = Math.min(MAX_LIVES, lives + 1);
    strong.textContent = `Richtig! +${fmt(bonus)} Punkte und +1 Netzwerk`;
    flashScreen('rgba(34,160,107,0.45)');
    sfx.correct();
  } else {
    lives--;
    strong.textContent = 'Leider falsch: −1 Netzwerk';
    flashScreen('rgba(229,72,77,0.4)');
    sfx.wrong();
  }
  tip.append(strong, currentQ.tip);
  $('gateHint').classList.add('hidden');
  $('gateResult').classList.remove('hidden');
  $('btnGateGo').textContent = lives > 0 ? 'Weiter' : 'Ergebnis ansehen';
  revealAt = performance.now();
  // verzögert, damit die Bestätigungstaste nicht gleich «Weiter» auslöst
  setTimeout(() => $('btnGateGo').focus({ preventScroll: true }), 400);
}

let revealAt = 0;
function leaveGate() {
  if (gatePhase !== 'reveal' || performance.now() - revealAt < 400) return;
  gatePhase = null;
  $('gatePanel').classList.add('hidden');
  nextGateAt = dist + GATE_EVERY;
  rowCursor = 40;
  if (lives <= 0) {
    startDying();
    return;
  }
  state = 'playing';
  player.invuln = 1;
  music.setMode('run');
  levelUp();
}

function levelUp() {
  level++;
  levelT = 0;
  // in jeder geraden Stufe wartet etwa auf halber Strecke ein Boss
  bossAt = level % 2 === 0 ? dist + GATE_EVERY * 0.45 : Infinity;
  themeTarget = Math.min(level - 1, THEMES.length - 1);
  const el = $('levelBanner');
  $('levelNum').textContent = `Stufe ${level}`;
  $('levelNews').textContent = LEVEL_NEWS[level] || 'Mehr Tempo, mehr Bedrohungen!';
  el.classList.remove('hidden', 'go');
  void el.offsetWidth;
  el.classList.add('go');
  music.setLevel(level);
  sfx.levelUp();
}

// ---------- Treffer & Power-ups ----------
function damage() {
  lives--;
  player.invuln = 2;
  shake = 0.45;
  flashScreen('rgba(229,72,77,0.45)');
  const hud = $('hud');
  hud.classList.remove('hit');
  void hud.offsetWidth;
  hud.classList.add('hit');
  sfx.hit();
  if (lives <= 0) startDying();
  else toast('Netzwerk getroffen!', '#e5484d');
}

function startDying() {
  state = 'dying';
  music.tapeStop();
  sfx.powerDown();
  dyingT = 1.6;
  player.vy = 9;
  shake = 0.45;
  burst(playerGroup.position.clone().setY(0.8), C.blue, 30, 8);
  burst(playerGroup.position.clone().setY(0.8), C.grey, 20, 7);
}

function applyPower(o) {
  const def = POWER[o.type];
  if (o.type === 'backup') {
    if (lives < MAX_LIVES) lives++;
    else score += 200;
  }
  if (def.dur) powers[o.type] = def.dur;
  if (o.type === 'scan') {
    scanWave = { z: 0, life: 0.7 };
    scanMesh.visible = true;
    sfx.scan();
  }
  toast(def.msg, def.color);
  const col = parseInt(def.color.slice(1), 16);
  burst(o.mesh.position, col, 18, 5);
  shockwave(player.x, 0, col, 4, 0.5);
  sfx.power();
}

// ---------- Bosse ----------
// In der Mitte jeder geraden Stufe erscheint ein Boss. Während des Kampfs feuert der
// Chip automatisch – man muss sich in die Spur des Bosses stellen und dabei seinen
// angekündigten Angriffen (rote Streifen am Boden) ausweichen. Bei 66 % und 33 %
// Energie wechselt der Boss in die nächste, aggressivere Phase.
const BOSSES = [
  { key: 'worm', name: 'Der Wurm', tag: 'Kriecht durch jedes ungepatchte System', hp: 75, color: 0xe5484d, speed: 1.2, shots: ['virus', 'bug'], attacks: ['spit', 'spit', 'volley'] },
  { key: 'phisher', name: 'Phish-Lord', tag: 'Hat den perfekten Köder für dich', hp: 100, color: 0xf08a24, speed: 1.4, shots: ['phishing', 'spam'], attacks: ['hook', 'mails', 'volley'] },
  { key: 'botnet', name: 'Botnetz-Kern', tag: 'Tausend Drohnen, ein Wille', hp: 115, color: 0xff3355, speed: 1.0, shots: ['drone'], attacks: ['dive', 'dive', 'beam'], shield: true },
  { key: 'ransom', name: 'Ransom-Koloss', tag: 'Zahle – oder verliere alles', hp: 145, color: 0x7c5cd6, speed: 0.8, shots: ['ransom', 'virus'], attacks: ['slam', 'locks', 'volley'] },
  { key: 'zeroday', name: 'Zero-Day', tag: 'Die Lücke, die niemand kennt', hp: 190, color: 0xff2244, speed: 1.6, shots: ['virus', 'drone', 'ransom'], attacks: ['beam2', 'sweep', 'slam', 'volley'] },
];
const BOSS_Z = -25;
const BOSS_SCALE = 1.5;
const ROMAN = ['', ' II', ' III', ' IV', ' V'];
let boss = null;
let bossPending = false;
let bossAt = Infinity;
let bossCount = 0;
let bossMix = 0; // 0..1 – färbt die Umgebung während des Kampfs rot

function bossMat(color, emissive = 0.25, extra = {}) {
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.4, ...extra });
  m.userData.base = emissive;
  return m;
}

function buildBoss(key) {
  const group = new THREE.Group();
  const glow = []; // Materialien, die bei Treffern aufblitzen
  const reg = (m) => { glow.push(m); return m; };
  let hitW = 2;
  let anim = () => {};

  if (key === 'worm') {
    const head = new THREE.Group();
    const skull = new THREE.Mesh(virusGeo, reg(bossMat(C.red, 0.3)));
    skull.scale.setScalar(2.3);
    const eyes = new THREE.Group();
    eyes.add(new THREE.Mesh(eyeGeo, M.eye), new THREE.Mesh(pupilGeo, M.pupil));
    eyes.scale.setScalar(2.3);
    head.add(skull, eyes);
    group.add(head);
    const segMat = reg(bossMat(0xc23238, 0.25));
    const ringMat = bossMat(0x5a1418, 0.1);
    const segs = [];
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Group();
      const r = 1.05 - i * 0.07;
      s.add(new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), segMat));
      s.add(new THREE.Mesh(new THREE.TorusGeometry(r * 0.95, 0.09, 6, 20), ringMat));
      group.add(s);
      segs.push(s);
    }
    hitW = 1.9;
    anim = (t) => {
      head.position.set(0, 2.2 + Math.sin(t * 3) * 0.3, 0);
      skull.rotation.set(t * 0.8, t * 1.3, 0);
      segs.forEach((s, i) => s.position.set(Math.sin(t * 2.2 - i * 0.7) * 0.25 * (i + 1), 1.7 + Math.sin(t * 3 - i * 0.8) * 0.4, -1.6 - i * 1.25));
    };
  } else if (key === 'phisher') {
    const bodyMat = reg(bossMat(C.orange, 0.2));
    const body = new THREE.Mesh(new RoundedBoxGeometry(4.4, 3, 0.7, 3, 0.15), [bodyMat, bodyMat, bodyMat, bodyMat, phishFace, bodyMat]);
    body.position.y = 2.3;
    const jaw = new THREE.Group();
    jaw.position.set(0, 3.8, 0.35);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.12, 2), bodyMat);
    flap.position.z = 1;
    jaw.add(flap);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), M.eye);
      eye.position.set(s * 1.1, 4.2, 0.1);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), M.pupil);
      pupil.position.set(s * 1.1, 4.15, 0.48);
      group.add(eye, pupil);
    }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 4.2, 8), M.line);
    rod.position.set(2.6, 5.4, 0.6);
    rod.rotation.z = -0.6;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 6), M.line);
    const lure = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd84d }));
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.08, 8, 20, Math.PI * 1.3), M.metal);
    group.add(body, jaw, rod, line, lure, hook);
    hitW = 2.4;
    anim = (t) => {
      jaw.rotation.x = -0.15 - (Math.sin(t * 4) + 1) * 0.22;
      body.rotation.z = Math.sin(t * 1.5) * 0.06;
      const ly = 4.1 + Math.sin(t * 3) * 0.3;
      lure.position.set(3.85, ly, 1.3);
      hook.position.set(3.75, ly - 0.55, 1.3);
      hook.rotation.z = Math.PI + Math.sin(t * 2) * 0.2;
      line.position.set(3.85, ly + 1.4, 1.3);
    };
  } else if (key === 'botnet') {
    const coreMat = reg(new THREE.MeshStandardMaterial({ color: 0x1d222b, emissive: 0xff3355, emissiveIntensity: 0.15, roughness: 0.3, metalness: 0.7 }));
    coreMat.userData.base = 0.15;
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), coreMat);
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.46, 1)), new THREE.LineBasicMaterial({ color: 0xff3355 }));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
    eye.position.z = 1.25;
    const coreG = new THREE.Group();
    coreG.add(core, wire, eye);
    coreG.position.y = 2.6;
    const drones = [];
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Group();
      d.add(new THREE.Mesh(G.drone, M.drone));
      const de = new THREE.Mesh(G.droneEye, M.droneEye);
      de.position.z = 0.38;
      d.add(de);
      group.add(d);
      drones.push(d);
    }
    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(2.3, 32, 20),
      new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.18, depthWrite: false }),
    );
    shield.position.y = 2.6;
    group.add(coreG, shield);
    hitW = 1.9;
    anim = (t, b) => {
      core.rotation.set(t * 0.5, t * 0.7, 0);
      wire.rotation.copy(core.rotation);
      drones.forEach((d, i) => {
        const a = t * 1.6 + (i / 6) * Math.PI * 2;
        d.position.set(Math.cos(a) * 3, 2.6 + Math.sin(a * 2) * 0.6, Math.sin(a) * 1.5);
        d.rotation.y = -a;
      });
      shield.visible = b.shieldUp;
      shield.material.opacity = 0.14 + Math.sin(t * 8) * 0.05;
    };
  } else if (key === 'ransom') {
    const bodyMat = reg(bossMat(C.purple, 0.2));
    const noteTex = canvasTex(512, 370, (g, w, h) => {
      g.fillStyle = '#2b2140';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#ff4d6a';
      g.font = `bold 40px ${FONT}`;
      g.textAlign = 'center';
      g.fillText('IHRE DATEN SIND', w / 2, 80);
      g.fillText('VERSCHLÜSSELT', w / 2, 128);
      g.fillStyle = '#fff';
      g.font = `bold 76px ${FONT}`;
      g.fillText('ZAHLE 1 BTC', w / 2, 230);
      g.fillStyle = '#ff4d6a';
      g.font = `bold 54px ${FONT}`;
      g.fillText('23:59:59', w / 2, 315);
    });
    const face = new THREE.MeshStandardMaterial({ map: noteTex, emissive: 0xffffff, emissiveMap: noteTex, emissiveIntensity: 0.35 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(5, 3.6, 1.6, 3, 0.2), [bodyMat, bodyMat, bodyMat, bodyMat, face, bodyMat]);
    body.position.y = 2.3;
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.38, 12, 28, Math.PI), M.metal);
    shackle.position.y = 4.1;
    const arms = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 3.1, 3.6, 0);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), bodyMat);
      upper.position.y = -1.2;
      const fist = new THREE.Mesh(new RoundedBoxGeometry(1.3, 1.1, 1.3, 2, 0.15), M.metal);
      fist.position.y = -2.7;
      pivot.add(upper, fist);
      group.add(pivot);
      return pivot;
    });
    group.add(body, shackle);
    hitW = 2.8;
    anim = (t, b) => {
      const raise = b.slamT > 0 ? -2.4 * (b.slamT / 0.7) : Math.sin(t * 2) * 0.25;
      arms[0].rotation.x = raise;
      arms[1].rotation.x = b.slamT > 0 ? raise : -Math.sin(t * 2) * 0.25;
      body.rotation.y = Math.sin(t) * 0.12;
      shackle.rotation.y = body.rotation.y;
    };
  } else {
    const darkMat = reg(new THREE.MeshStandardMaterial({ color: 0x0b0f17, emissive: 0xff2244, emissiveIntensity: 0.1, roughness: 0.2, metalness: 0.9 }));
    darkMat.userData.base = 0.1;
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(2, 0), darkMat);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(2.05, 0)), new THREE.LineBasicMaterial({ color: 0xff2244 }));
    const iris = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.1, 10, 32), new THREE.MeshBasicMaterial({ color: 0xffd0d6 }));
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
    iris.position.z = 2.1;
    pupil.position.z = 2.05;
    const core = new THREE.Group();
    core.add(body, edges, iris, pupil);
    core.position.y = 2.8;
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff2244 });
    const rings = [2.8, 3.3, 3.8].map((r) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 64), ringMat);
      m.position.y = 2.8;
      group.add(m);
      return m;
    });
    group.add(core);
    hitW = 2.0;
    anim = (t, b) => {
      body.rotation.y = t * 0.6;
      edges.rotation.y = body.rotation.y;
      rings[0].rotation.set(t * 0.9, t * 0.4, 0);
      rings[1].rotation.set(t * -0.6, 0, t * 0.8);
      rings[2].rotation.set(0, t * 0.7, t * -0.5);
      // Glitch: kurzes Zucken und Flackern
      const glitch = Math.random() < (b.phase >= 2 ? 0.08 : 0.04);
      core.position.x = glitch ? rand(-0.4, 0.4) : 0;
      core.scale.setScalar(glitch ? rand(0.85, 1.15) : 1);
    };
  }
  group.scale.setScalar(BOSS_SCALE);
  // Trefferzone: etwa eine Spur breit – man muss sich wirklich vor den Boss stellen
  return { group: shadowed(group), glow, hitW: clamp(hitW * 0.7, 1.2, 1.9), anim };
}

function showBanner(title, sub, variant, kicker = '') {
  const el = $('bossBanner');
  el.className = `boss-banner ${variant}`;
  $('bossKicker').textContent = kicker;
  $('bossTitle').textContent = title;
  $('bossTag').textContent = sub;
  void el.offsetWidth;
  el.classList.add('go');
}

function warnBoss() {
  bossPending = true;
  bossAt = Infinity;
  rowCursor = Infinity;
  for (const o of objects) if (o.kind === 'obs' && o.mesh.position.z < -70) o.dead = true;
  showBanner('Boss nähert sich', 'Mach dich bereit!', 'warn', '⚠ Warnung');
  for (let k = 0; k < 3; k++) setTimeout(() => { if (bossPending) sfx.warn(); }, k * 520);
  music.riser(2.6);
}

function spawnBoss() {
  bossPending = false;
  const def = BOSSES[bossCount % BOSSES.length];
  const tier = Math.floor(bossCount / BOSSES.length);
  // Jeder weitere Boss ist härter: kündigt kürzer an, greift öfter an, bewegt sich schneller
  const rank = bossCount;
  bossCount++;
  const model = buildBoss(def.key);
  const hp = Math.round(def.hp * (1 + tier * 0.75));
  boss = {
    def, tier, rank, ...model,
    warn: Math.max(0.55, 1 - rank * 0.07), // Faktor für die Ankündigungszeit
    aggro: 1 + rank * 0.12, // Faktor für die Angriffsfrequenz
    name: def.name + (ROMAN[tier] ?? ` ${tier + 1}`),
    hp, maxHp: hp, x: 0, z: -150, t: 0, wob: 0, phase: 1,
    attackT: 2.2, entering: true, flash: 0, slamT: 0,
    shieldUp: !!def.shield, shieldT: 3.5, dying: 0, boomT: 0,
    timers: [], tele: [], beams: [],
  };
  boss.group.position.set(0, 0, boss.z);
  scene.add(boss.group);
  $('bossName').textContent = boss.name;
  $('bossBar').classList.remove('hidden');
  showBanner(boss.name, def.tag, 'intro', 'Boss');
  music.stinger();
  music.setMode('boss');
  sfx.roar();
  shake = 0.5;
}

function later(b, t, fn) {
  b.timers.push({ t, fn });
}

// Warnstreifen am Boden; nach Ablauf wird der Angriff ausgelöst
const teleGeo = new THREE.PlaneGeometry(2.2, 1);
const beamGeo = new THREE.BoxGeometry(1.1, 2.4, 1);
function telegraph(lane, dur, color, then) {
  const b = boss;
  const len = Math.abs(BOSS_Z) + 4;
  const m = new THREE.Mesh(teleGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(1, len, 1);
  m.position.set(LANES[lane], 0.04, BOSS_Z / 2 + 2);
  scene.add(m);
  const tg = { mesh: m, t: 0 };
  b.tele.push(tg);
  later(b, dur, () => {
    scene.remove(m);
    b.tele = b.tele.filter((x) => x !== tg);
    then();
  });
}

function bossShot(b, lane, type, moving = false) {
  telegraph(lane, 0.65 * b.warn, b.def.color, () => {
    const o = addObstacle(type, lane, BOSS_Z + 2);
    o.static = !moving;
    o.fromBoss = true;
    burst(tmpV.set(LANES[lane], 2, BOSS_Z + 2), b.def.color, 10, 5);
    osc('sawtooth', 320, 110, 0.18, 0.05, { pan: LANES[lane] / 3 });
  });
}

function beamAttack(b, lanes, warn, color = b.def.color) {
  sfx.charge(LANES[lanes[0]] / 3);
  for (const lane of lanes) {
    telegraph(lane, warn * b.warn, color, () => {
      const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
      m.scale.set(1, 1, Math.abs(BOSS_Z) + 4);
      m.position.set(LANES[lane], 1.2, BOSS_Z / 2 + 2);
      scene.add(m);
      b.beams.push({ mesh: m, lane, t: 0.55 });
      sfx.beam(LANES[lane] / 3);
      shake = Math.max(shake, 0.25);
    });
  }
}

function slamAttack(b) {
  b.slamT = 0.7 * b.warn;
  for (const lane of [0, 1, 2]) {
    telegraph(lane, 0.7 * b.warn, 0xff5a36, () => {
      if (lane !== 1) return;
      const o = addObstacle('wave', 1, BOSS_Z + 3);
      o.fromBoss = true;
      sfx.slam();
      shake = 0.5;
      shockwave(b.x, BOSS_Z + 2, b.def.color, 7, 0.6);
    });
  }
}

function bossAttack(b, kind) {
  const pl = player.lane;
  const others = [0, 1, 2].filter((l) => l !== pl);
  const free = pick([0, 1, 2]);
  switch (kind) {
    case 'spit':
      bossShot(b, pl, pick(b.def.shots));
      if (b.phase >= 2) later(b, 0.45, () => bossShot(b, pick(others), pick(b.def.shots)));
      break;
    case 'volley':
      for (const l of [0, 1, 2]) if (l !== free) bossShot(b, l, pick(b.def.shots));
      break;
    case 'mails':
      bossShot(b, pl, 'phishing', true);
      later(b, 0.6, () => bossShot(b, pick([0, 1, 2]), 'phishing', true));
      break;
    case 'dive':
      bossShot(b, pl, 'drone');
      if (b.phase >= 2) later(b, 0.5, () => bossShot(b, pick(others), 'drone'));
      break;
    case 'locks':
      for (const l of [0, 1, 2]) if (l !== free) bossShot(b, l, 'ransom');
      break;
    case 'hook':
      beamAttack(b, [pl], 0.9, 0xffb020);
      break;
    case 'beam':
      beamAttack(b, b.phase >= 3 ? [pl, pick(others)] : [pl], 1.0);
      break;
    case 'beam2':
      beamAttack(b, [0, 1, 2].filter((l) => l !== free), 1.0);
      break;
    case 'sweep': {
      const order = shuffle([0, 1, 2]);
      beamAttack(b, [order[0], order[1]], 0.9);
      later(b, 1.4, () => beamAttack(b, [order[2], order[0]], 0.8));
      break;
    }
    case 'slam':
      slamAttack(b);
      break;
  }
}

function hitBoss(pos) {
  const b = boss;
  if (b.shieldUp) {
    burst(pos, 0xff3355, 4, 3);
    sfx.shieldBlock(pos.x / 3);
    return;
  }
  b.hp--;
  b.flash = 0.07;
  score += 10 * scoreMult();
  burst(pos, 0xffffff, 4, 4);
  sfx.bossHit(pos.x / 3);
  const ratio = b.hp / b.maxHp;
  const phase = ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1;
  if (phase > b.phase) {
    b.phase = phase;
    sfx.roar();
    shake = 0.45;
    flashScreen('rgba(229,72,77,0.35)');
    toast(phase === 3 ? 'Der Boss rastet aus!' : 'Phase 2 – er wird schneller!', '#e5484d');
    // kleine Hilfe: ein Power-up fällt heraus
    addPower(pick([0, 1, 2]), BOSS_Z + 6);
  }
  if (b.hp <= 0) defeatBoss();
}

function clearBossAttacks(b) {
  for (const tg of b.tele) scene.remove(tg.mesh);
  for (const bm of b.beams) scene.remove(bm.mesh);
  b.tele = [];
  b.beams = [];
  b.timers = [];
}

function defeatBoss() {
  const b = boss;
  b.dying = 2.2;
  clearBossAttacks(b);
  for (const o of objects) if (o.fromBoss && !o.dead) destroyObstacle(o);
  sfx.bossDown();
  music.setMode('gate');
}

function finishBoss() {
  const b = boss;
  burst(tmpV.set(b.x, 2.5, b.z), 0xffffff, 40, 12);
  burst(tmpV.set(b.x, 2.5, b.z), b.def.color, 40, 10);
  shockwave(b.x, b.z, 0xffffff, 12, 0.9);
  flashScreen('rgba(255,255,255,0.75)');
  scene.remove(b.group);
  const bonus = Math.round(2000 * (1 + b.tier) * scoreMult());
  score += bonus;
  lives = Math.min(MAX_LIVES, lives + 1);
  showBanner('Boss besiegt!', `${b.name} · +${fmt(bonus)} Punkte · +1 Netzwerk`, 'win', '★ Sieg');
  addPower(0, -45);
  addPower(2, -58);
  $('bossBar').classList.add('hidden');
  boss = null;
  rowCursor = 45;
  nextGateAt = Math.max(nextGateAt, dist + GATE_EVERY * 0.5);
  music.impact();
  music.setMode('run');
}

function removeBoss() {
  if (boss) {
    clearBossAttacks(boss);
    scene.remove(boss.group);
  }
  boss = null;
  bossPending = false;
  bossAt = Infinity;
  $('bossBar').classList.add('hidden');
}

function updateBoss(dt) {
  const b = boss;
  b.t += dt;
  b.slamT = Math.max(0, b.slamT - dt);

  // Einflug aus der Ferne
  if (b.entering) {
    b.z += (BOSS_Z - b.z) * Math.min(1, dt * 1.6);
    if (Math.abs(b.z - BOSS_Z) < 0.5) {
      b.z = BOSS_Z;
      b.entering = false;
    }
  }
  if (!b.dying) {
    const sp = b.def.speed * (1 + (b.phase - 1) * 0.35) * (1 + b.rank * 0.08);
    b.wob += dt * sp;
    let tx = Math.sin(b.wob * 0.55) * 2.6 + Math.sin(b.wob * 1.7) * 0.4;
    // Zero-Day teleportiert sich ab Phase 2 gelegentlich
    if (b.def.key === 'zeroday' && b.phase >= 2) {
      b.teleT = (b.teleT ?? 2) - dt;
      if (b.teleT <= 0) {
        b.teleT = rand(1.5, 2.8);
        b.teleX = pick(LANES);
        burst(tmpV.set(b.x, 2.8, b.z), 0xff2244, 16, 6);
        osc('square', 2000, 200, 0.15, 0.04);
      }
      if (b.teleX !== undefined) tx = b.teleX;
      b.x = tx;
    } else {
      b.x += (tx - b.x) * Math.min(1, dt * 3);
    }
  }
  b.group.position.set(b.x, Math.sin(b.t * 1.3) * 0.2, b.z);
  b.anim(b.t, b);

  // Treffer-Blitz und Wut-Pulsieren in Phase 3
  b.flash = Math.max(0, b.flash - dt);
  const rage = b.phase === 3 ? (Math.sin(b.t * 10) + 1) * 0.25 : 0;
  for (const m of b.glow) m.emissiveIntensity = m.userData.base + rage + (b.flash > 0 ? 1.6 : 0);

  for (const tm of b.timers) {
    tm.t -= dt;
    if (tm.t <= 0 && !tm.done) {
      tm.done = true;
      tm.fn();
    }
  }
  b.timers = b.timers.filter((tm) => !tm.done);
  for (const tg of b.tele) {
    tg.t += dt;
    tg.mesh.material.opacity = 0.15 + (Math.sin(tg.t * 18) + 1) * 0.15;
  }
  for (const bm of b.beams) {
    bm.t -= dt;
    bm.mesh.scale.x = 0.6 + Math.random() * 0.5;
    if (!bm.hit && state === 'playing' && Math.abs(player.x - LANES[bm.lane]) < 1.0 && player.invuln <= 0 && powers.firewall <= 0) {
      bm.hit = true;
      damage();
    }
    if (bm.t <= 0) {
      scene.remove(bm.mesh);
      bm.dead = true;
    }
  }
  b.beams = b.beams.filter((bm) => !bm.dead);

  if (b.dying) {
    b.dying -= dt;
    b.boomT -= dt;
    if (b.boomT <= 0) {
      b.boomT = 0.14;
      const p = tmpV.set(b.x + rand(-2, 2), rand(1, 4.5), b.z + rand(-1, 1));
      burst(p, pick([b.def.color, 0xffffff, 0xffb020]), 14, 8);
      shockwave(p.x, b.z, b.def.color, 4, 0.5);
      shake = Math.max(shake, 0.3);
    }
    b.group.rotation.z = Math.sin(b.t * 30) * 0.08;
    b.group.scale.setScalar(BOSS_SCALE * (1 + (2.2 - b.dying) * 0.06));
    if (b.dying <= 0) finishBoss();
    return;
  }
  if (b.entering || state !== 'playing') return;

  // Botnetz: Schild öffnet und schliesst sich im Wechsel
  if (b.def.shield) {
    b.shieldT -= dt;
    if (b.shieldT <= 0) {
      b.shieldUp = !b.shieldUp;
      b.shieldT = b.shieldUp ? 3.2 : b.phase === 3 ? 2 : 2.6;
      if (!b.shieldUp) toast('Schild offen – jetzt feuern!', '#e5484d');
    }
  }

  b.attackT -= dt;
  if (b.attackT <= 0) {
    bossAttack(b, pick(b.def.attacks));
    // ab Phase 2 hängen spätere Bosse gerne einen zweiten Angriff an
    if (b.phase >= 2 && Math.random() < 0.15 + b.rank * 0.07) later(b, 0.9, () => bossAttack(b, pick(b.def.attacks)));
    b.attackT = rand(1.7, 2.5) / (1 + (b.phase - 1) * 0.35) / b.aggro;
  }
}

// ---------- Update ----------
const tmpV = new THREE.Vector3();
function update(dt) {
  const playing = state === 'playing';
  const dying = state === 'dying';

  const atGate = state === 'gate';
  if (playing) {
    elapsed += dt;
    levelT += dt;
    // im Bosskampf etwas gemächlicher, damit man Angriffe lesen kann
    const target = boss || bossPending ? Math.min(22, levelSpeed(level, levelT)) : levelSpeed(level, levelT);
    speed += (target - speed) * Math.min(1, dt * 1.5);
  } else if (atGate) {
    // sanft abbremsen, sodass das Tor bei GATE_STOP_Z stehen bleibt
    const left = gate ? Math.max(0, GATE_STOP_Z - gate.mesh.position.z) : 0;
    speed = Math.min(speed, left * 3.2);
  } else if (dying) {
    speed = Math.max(0, speed - dt * 30);
  } else if (state === 'menu') {
    speed = 9;
  }
  const dz = speed * dt;

  // Welt bewegen
  floorTex.offset.y += dz / 5;
  for (const r of racks) {
    r.position.z += dz;
    if (r.position.z > 14) r.position.z -= RACK_COUNT * RACK_GAP;
  }
  for (const b of beams) {
    b.position.z += dz;
    if (b.position.z > 14) b.position.z -= 6 * 28;
  }
  for (const s of streams) {
    s.position.z += dz * 1.8 + dt * 6;
    if (s.position.z > 12) s.position.z = SPAWN_Z + rand(0, 20);
  }
  for (const r of rain) {
    r.position.z += dz;
    r.position.y -= r.userData.vy * dt;
    if (r.position.y < -1) r.position.y = rand(12, 18);
    if (r.position.z > 12) r.position.z = SPAWN_Z + rand(0, 20);
  }
  for (const w of waves) {
    if (w.life <= 0) continue;
    w.life -= dt;
    w.mesh.position.z += dz;
    const p = 1 - w.life / w.max;
    w.mesh.scale.setScalar(0.3 + p * w.size);
    w.mesh.material.opacity = (1 - p) * 0.8;
    if (w.life <= 0) w.mesh.visible = false;
  }
  updateTheme(dt);

  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.v.y -= 14 * dt;
    p.mesh.position.addScaledVector(p.v, dt);
    p.mesh.rotation.x += dt * 6;
    p.mesh.material.opacity = Math.max(0, p.life / p.max);
    if (p.life <= 0) p.mesh.visible = false;
  }

  updatePlayer(dt);
  updateTrail(dt, dz);

  if (!playing && !dying && !atGate) return;

  if (playing) {
    dist += dz;
    score += dz * scoreMult();
    for (const k in powers) powers[k] = Math.max(0, powers[k] - dt);
    player.invuln = Math.max(0, player.invuln - dt);

    rowCursor -= dz;
    if (rowCursor <= 0) {
      const extra = spawnRow();
      // Abstand zwischen Reihen schrumpft mit jeder Stufe
      const tight = Math.max(0.58, 1 - (level - 1) * 0.08);
      rowCursor = extra + rand(0.85, 1.25) * Math.max(10, speed * 0.95 * tight);
    }

    // Antivirus-Laser – im Bosskampf feuert der Chip immer
    const bossFight = boss && !boss.entering && !boss.dying;
    if (powers.antivirus > 0 || bossFight) {
      boltT -= dt;
      if (boltT <= 0) {
        fireBolt();
        boltT = bossFight ? 0.17 : 0.2;
      }
    }

    // Boss: ankündigen, sobald die Strecke frei ist auftauchen lassen
    if (!boss && !bossPending && !gate && !gatePending && dist >= bossAt) warnBoss();
    if (bossPending && !objects.some((o) => !o.dead && o.kind === 'obs' && o.mesh.position.z < 1.5)) spawnBoss();
    // Vor dem Gate: keine neuen Hindernisse, weit entfernte verschwinden im Nebel
    if (!gate && !gatePending && !boss && !bossPending && dist >= nextGateAt) {
      gatePending = true;
      rowCursor = Infinity;
      for (const o of objects) if (o.kind === 'obs' && o.mesh.position.z < -70) o.dead = true;
    }
    if (gatePending && !objects.some((o) => !o.dead && o.kind === 'obs' && o.mesh.position.z < 1.5)) {
      gatePending = false;
      spawnGate();
    }
  }

  if (gate) {
    gate.mesh.position.z += dz;
    if (playing && !gate.stopped && gate.mesh.position.z >= GATE_STOP_Z - 14) {
      gate.stopped = true;
      startChoose();
    }
    if (gate.mesh.position.z > 14) {
      scene.remove(gate.mesh);
      gate = null;
    }
  }

  // Laser-Schüsse fliegen nach vorne und treffen das erste Hindernis in ihrer Bahn
  for (const b of bolts) {
    b.prevZ = b.mesh.position.z;
    b.mesh.position.z -= 75 * dt;
    if (b.mesh.position.z < -110) b.dead = true;
    for (const o of objects) {
      if (b.dead) break;
      if (o.kind !== 'obs' || o.dead || o.type === 'wave') continue;
      if (Math.abs(o.x - b.mesh.position.x) < o.w / 2 + 0.15 && Math.abs(o.mesh.position.z - b.mesh.position.z) < o.d / 2 + 0.8) {
        b.dead = true;
        o.hp--;
        if (o.hp <= 0) destroyObstacle(o, 0x5fffe0);
        else burst(tmpV.set(o.x, 1, o.mesh.position.z), 0x5fffe0, 6, 3);
      }
    }
    // Treffer nur beim Durchflug durch die Boss-Ebene (nicht nachträglich)
    if (!b.dead && boss && !boss.entering && !boss.dying &&
        Math.abs(b.mesh.position.x - boss.x) < boss.hitW &&
        b.prevZ >= boss.z - 1 && b.mesh.position.z <= boss.z + 1.5) {
      b.dead = true;
      hitBoss(b.mesh.position);
    }
  }
  if (boss) updateBoss(dt);
  if (bolts.some((b) => b.dead)) {
    bolts = bolts.filter((b) => {
      if (b.dead) scene.remove(b.mesh);
      return !b.dead;
    });
  }

  // Scan-Welle
  if (scanWave) {
    scanWave.life -= dt;
    scanWave.z -= 130 * dt;
    const p = 1 - scanWave.life / 0.7;
    scanMesh.position.set(0, 1.2, scanWave.z);
    scanMesh.scale.setScalar(1.5 + p * 4);
    scanMesh.material.opacity = 1 - p;
    for (const o of objects) {
      if (o.kind === 'obs' && !o.dead && o.mesh.position.z > scanWave.z) destroyObstacle(o, 0x7c5cd6);
    }
    // ein Scan trifft auch den Boss kräftig
    if (boss && !scanWave.bossHit && !boss.entering && !boss.dying && scanWave.z < boss.z) {
      scanWave.bossHit = true;
      for (let k = 0; k < 5 && boss && !boss.dying; k++) hitBoss(tmpV.set(boss.x, 2.5, boss.z));
    }
    if (scanWave.life <= 0) {
      scanWave = null;
      scanMesh.visible = false;
    }
  }

  // Objekte bewegen und Kollisionen prüfen
  const px = player.x;
  const py = player.y;
  for (const o of objects) {
    if (o.dead) continue;
    o.mesh.position.z += dz;
    const z = o.mesh.position.z;
    if (o.kind === 'obs') {
      o.t += dt;
      if (o.type === 'virus') o.spin.rotation.set(o.t * 1.4, o.t * 2, 0);
      if (o.wander && z > -70) {
        // wechselt alle paar Sekunden in eine Nachbarspur
        if (o.t > (o.nextMove ?? 0)) {
          o.lane = clamp(o.lane + pick([-1, 1]), 0, 2);
          o.nextMove = o.t + rand(1.2, 2);
        }
        o.x += (LANES[o.lane] - o.x) * Math.min(1, dt * 2.5);
      }
      if (o.type === 'bug') {
        o.x = o.baseX + Math.sin(o.t * 3 + o.phase) * 0.35;
        o.spin.rotation.y = Math.cos(o.t * 3 + o.phase) * 0.35;
      }
      if (o.type === 'phishing') {
        if (z > -60 && !o.static) o.x = clamp(o.baseX + Math.sin(o.t * (1.2 + level * 0.15) + o.phase) * 2.6, -2.4, 2.4);
        o.spin.position.y = 1.3 + Math.sin(o.t * 3) * 0.12;
        o.spin.rotation.z = Math.sin(o.t * 2.5) * 0.15;
      }
      if (o.type === 'ransom') o.spin.rotation.y = Math.sin(o.t * 1.5) * 0.25;
      o.mesh.position.x = o.x;
      // Knapp vorbei: räumliches Zischen links oder rechts
      if (playing && !o.passed && z > 0.6) {
        o.passed = true;
        const dx = o.x - px;
        if (Math.abs(dx) > 0.9 && Math.abs(dx) < 3.2) sfx.whoosh(clamp(dx / 2.4, -1, 1));
      }
      // Hitbox bewusst etwas kleiner als die Figur – knappe Ausweichmanöver sollen gelingen
      if (playing && Math.abs(z) < o.d / 2 + 0.45 && Math.abs(o.x - px) < o.w / 2 + 0.38 &&
          py < o.yMax && py + PLAYER_SIZE > o.yMin) {
        if (powers.firewall > 0) {
          destroyObstacle(o, C.fire);
        } else if (player.invuln <= 0) {
          o.dead = true;
          burst(tmpV.set(o.x, 0.8, 0), C.red, 16, 6);
          damage();
        }
      }
    } else if (o.kind === 'bit') {
      o.mesh.rotation.y += dt * 3;
      if (playing && powers.cloud > 0 && z > -16 && z < 1) {
        const k = Math.min(1, dt * 7);
        o.x += (px - o.x) * k;
        o.mesh.position.y += (py + 0.6 - o.mesh.position.y) * k;
        o.mesh.position.x = o.x;
      }
      const dy = o.mesh.position.y - (py + 0.6);
      if (playing && Math.abs(z) < 0.9 && Math.abs(o.x - px) < 0.9 && Math.abs(dy) < 1.1) {
        o.dead = true;
        score += 25 * scoreMult();
        burst(o.mesh.position, C.blue, 5, 3);
        sfx.bit();
      }
    } else if (o.kind === 'pow') {
      o.t += dt;
      o.mesh.position.y = 1.0 + Math.sin(o.t * 4) * 0.15;
      o.core.rotation.set(o.t * 1.5, o.t * 2, 0);
      o.ring.rotation.set(Math.PI / 2 + Math.sin(o.t * 2) * 0.4, o.t * 3, 0);
      if (playing && Math.abs(z) < 1 && Math.abs(o.x - px) < 1.1 && py < 1.6) {
        o.dead = true;
        applyPower(o);
      }
    }
    if (z > 12) o.dead = true;
  }
  if (objects.some((o) => o.dead)) {
    objects = objects.filter((o) => {
      if (o.dead) scene.remove(o.mesh);
      return !o.dead;
    });
  }

  if (dying) {
    dyingT -= dt;
    if (dyingT <= 0) showGameOver();
  }
}

function updatePlayer(dt) {
  const t = performance.now() / 1000;
  if (state === 'menu') {
    // Im Menü dreht sich der Chip langsam und zeigt das gewählte Design
    player.x = Math.sin(t * 0.6) * 1.6;
    player.y = 0.25;
    playerMesh.rotation.x = 0;
    playerMesh.rotation.y = t * 0.7;
    playerGroup.rotation.z = 0;
    playerGroup.visible = true;
  } else {
    const targetX = LANES[player.lane];
    player.x += (targetX - player.x) * Math.min(1, dt * 14);
    if (player.y > 0 || player.vy > 0) {
      player.vy -= 32 * dt;
      player.y += player.vy * dt;
      if (state === 'playing') player.spin = Math.min(1, player.spin + dt / 0.69);
      if (player.y <= 0) {
        player.y = 0;
        player.vy = 0;
        player.spin = 0;
      }
    }
    playerMesh.rotation.x = -player.spin * Math.PI * 2;
    playerMesh.rotation.y = 0;
    playerGroup.rotation.z = (player.x - targetX) * 0.12;
    if (state === 'dying') {
      player.tumble += dt;
      playerMesh.rotation.x = -player.tumble * 8;
      playerMesh.rotation.z = player.tumble * 5;
      playerGroup.visible = dyingT > 0.4 ? true : Math.floor(t * 20) % 2 === 0;
    } else {
      playerGroup.visible = player.invuln > 0 ? Math.floor(t * 16) % 2 === 0 : true;
    }
  }
  playerGroup.position.set(player.x, player.y, 0);

  const bob = state === 'dying' ? 0 : Math.sin(t * 4) * 0.05;
  playerMesh.position.y = PLAYER_SIZE / 2 + HOVER + bob;
  shield.position.y = playerMesh.position.y;
  orbit.position.y = playerMesh.position.y;
  orbit.rotation.y = t * 2.4;
  orbit.visible = state !== 'dying';
  const pulse = 0.55 + Math.sin(t * 5) * 0.35 + (powers.firewall > 0 ? 0.5 : 0);
  for (const m of skin.glowing) m.emissiveIntensity = pulse;
  groundGlow.position.x = player.x;
  groundGlow.visible = playerGroup.visible && state !== 'over';
  groundGlow.material.opacity = 0.55 * (1 - Math.min(1, player.y / 2.2));
  groundGlow.scale.setScalar(1 + player.y * 0.25);

  shield.visible = powers.firewall > 0;
  shield.material.opacity = 0.16 + Math.sin(t * 10) * 0.06;
  magnet.visible = powers.cloud > 0;
  magnet.rotation.z = t * 4;
  magnet.scale.setScalar(1 + Math.sin(t * 8) * 0.08);
}

function updateCamera(dt) {
  const narrow = camera.aspect < 0.8;
  const tx = player.x * (narrow ? 0.25 : 0.55);
  const ty = (narrow ? 5.2 : 4.3) + player.y * 0.3 + bossMix * 0.8;
  const tz = narrow ? 10.5 : 7.8;
  const k = Math.min(1, dt * 6);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (ty - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    camera.position.x += rand(-1, 1) * shake * 0.6;
    camera.position.y += rand(-1, 1) * shake * 0.6;
  }
  camera.lookAt(player.x * 0.35, 1.1 + player.y * 0.2 + bossMix * 0.6, -8 - bossMix * 6);
  // Weitwinkel bei hohem Tempo verstärkt das Geschwindigkeitsgefühl
  const fov = baseFov + clamp((speed - SPEED_START) * 0.3, 0, 12) - (powers.update > 0 && state === 'playing' ? 4 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }
}

// ---------- HUD & Meldungen ----------
let hudCache = {};
function setText(id, value) {
  if (hudCache[id] === value) return;
  hudCache[id] = value;
  $(id).textContent = value;
}
function updateHud() {
  if (state === 'menu') return;
  setText('hudScore', fmt(score));
  setText('hudDist', fmt(dist) + ' MB');
  setText('hudLevel', String(level));
  if (boss) {
    $('bossHp').style.width = (Math.max(0, boss.hp) / boss.maxHp) * 100 + '%';
    setText('bossPhase', boss.dying ? 'Besiegt!' : boss.shieldUp ? 'Schild aktiv' : `Phase ${boss.phase}`);
  }
  const livesHtml = Array.from({ length: MAX_LIVES }, (_, i) => `<i class="${i < lives ? '' : 'off'}"></i>`).join('');
  if (hudCache.lives !== livesHtml) {
    hudCache.lives = livesHtml;
    $('hudLives').innerHTML = livesHtml;
  }
  const chips = Object.keys(powers)
    .filter((k) => powers[k] > 0)
    .map((k) => `<span class="chip" style="background:${POWER[k].color}">${POWER[k].label} ${Math.ceil(powers[k])}s</span>`)
    .join('');
  if (hudCache.powers !== chips) {
    hudCache.powers = chips;
    $('hudPowers').innerHTML = chips;
  }
}

function toast(text, color) {
  const el = $('toast');
  el.textContent = text;
  el.style.background = color;
  el.classList.remove('hidden');
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}
function flashScreen(color) {
  const el = $('flash');
  el.style.background = color;
  el.classList.remove('go');
  void el.offsetWidth;
  el.classList.add('go');
}

// ---------- Overlays ----------
const OVERLAYS = { menu: 'ovMenu', pause: 'ovPause', over: 'ovOver', scores: 'ovScores' };
function show(name) {
  for (const k in OVERLAYS) $(OVERLAYS[k]).classList.toggle('hidden', k !== name);
  const btn = name && $(OVERLAYS[name]).querySelector('.btn.primary:not(.hidden)');
  if (btn) btn.focus({ preventScroll: true });
}

const SCORE_KEY = 'dplan-runner-scores';
const loadScores = () => store.get(SCORE_KEY, []);
const qualifies = (s) => {
  const list = loadScores();
  return s > 0 && (list.length < 10 || s > list[list.length - 1].score);
};
function renderScores(ol, highlight = -1) {
  const list = loadScores();
  ol.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Noch keine Einträge – sei die erste Person auf der Liste!';
    ol.appendChild(li);
    return;
  }
  list.forEach((e, i) => {
    const li = document.createElement('li');
    if (i === highlight) li.className = 'me';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = e.name;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = e.level ? `Stufe ${e.level} · ${fmt(e.dist)} MB` : `${fmt(e.dist)} MB`;
    const pts = document.createElement('span');
    pts.className = 'pts';
    pts.textContent = fmt(e.score);
    li.append(name, meta, pts);
    ol.appendChild(li);
  });
}

function showGameOver() {
  state = 'over';
  $('gatePanel').classList.add('hidden');
  $('overScore').textContent = fmt(score);
  $('overLevel').textContent = level;
  $('overQuiz').textContent = `${gatesCorrect}/${gatesAsked}`;
  let msg;
  if (level >= 7) msg = 'Wahnsinn! Selbst in der Neon-Nacht kommen deine Daten sicher an.';
  else if (level >= 5) msg = 'Starke Leistung – fast schon Glasfaser-Tempo!';
  else if (level >= 3) msg = 'Gut unterwegs! Die nächsten Stufen warten.';
  else msg = 'Paketverlust passiert – einfach nochmal senden!';
  $('overMsg').textContent = `${fmt(dist)} MB übertragen. ${msg}`;
  const canSave = qualifies(score);
  $('saveForm').classList.toggle('hidden', !canSave);
  $('nameInput').value = store.get('dplan-cd-name', '');
  renderScores($('overScores'));
  show('over');
  if (canSave) $('nameInput').focus({ preventScroll: true });
}

$('saveForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const name = $('nameInput').value.trim().slice(0, 18);
  if (!name) return;
  store.set('dplan-cd-name', name);
  const list = loadScores();
  const entry = { name, score: Math.round(score), dist: Math.round(dist), level, date: new Date().toISOString() };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 10);
  store.set(SCORE_KEY, top);
  renderScores($('overScores'), top.indexOf(entry));
  $('saveForm').classList.add('hidden');
  $('btnAgain').focus({ preventScroll: true });
});

function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  show('pause');
  if (audio) audio.suspend();
}
function resume() {
  if (state !== 'paused') return;
  state = 'playing';
  show(null);
  if (audio) audio.resume();
}
function toMenu() {
  resetGame();
  state = 'menu';
  if (audio) audio.resume();
  music.setMode('menu');
  $('hud').classList.add('hidden');
  show('menu');
}

// ---------- Eingaben ----------
function move(dir) {
  const choosing = state === 'gate' && gatePhase === 'choose';
  if (state !== 'playing' && !choosing) return;
  const lane = clamp(player.lane + dir, 0, 2);
  if (lane !== player.lane) {
    player.lane = lane;
    sfx.lane(dir);
    if (choosing) highlightLane();
  }
}
function jump() {
  if (state !== 'playing' || player.y > 0.05) return;
  player.vy = 11;
  player.y = 0.001;
  player.spin = 0;
  sfx.jump();
}

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key;
  if (k === 'p' || k === 'P' || k === 'Escape') {
    if (state === 'playing') pause();
    else if (state === 'paused') resume();
    return;
  }
  if (state === 'gate') {
    if (e.repeat) return;
    if (gatePhase === 'choose') {
      const direct = { 1: 0, 2: 1, 3: 2 }[k];
      if (direct !== undefined) {
        player.lane = direct;
        chooseAnswer();
      } else if (k === 'ArrowLeft' || k === 'a' || k === 'A') move(-1);
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') move(1);
      else if (k === 'Enter' || k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') chooseAnswer();
      e.preventDefault();
    } else if (gatePhase === 'reveal' && (k === ' ' || k === 'ArrowUp' || k === 'Enter')) {
      e.preventDefault();
      leaveGate();
    }
    return;
  }
  if (state !== 'playing') return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(k)) e.preventDefault();
  if (e.repeat) return;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') move(-1);
  if (k === 'ArrowRight' || k === 'd' || k === 'D') move(1);
  if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') jump();
});

let touchStart = null;
canvas.addEventListener('pointerdown', (e) => {
  touchStart = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', (e) => {
  if (!touchStart || state !== 'playing') return;
  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
  else if (dy < -30) jump();
  else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
    const w = canvas.clientWidth;
    if (e.clientX < w / 3) move(-1);
    else if (e.clientX > (w * 2) / 3) move(1);
    else jump();
  }
});

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

$('btnStart').addEventListener('click', newGame);
$('btnAgain').addEventListener('click', newGame);
$('btnScores').addEventListener('click', () => { renderScores($('scoreList')); show('scores'); });
$('btnBack').addEventListener('click', () => show('menu'));
$('btnPause').addEventListener('click', () => (state === 'paused' ? resume() : pause()));
$('btnResume').addEventListener('click', resume);
$('btnGateGo').addEventListener('click', leaveGate);
document.querySelectorAll('.skin-btn').forEach((b) => b.addEventListener('click', () => {
  applySkin(b.dataset.skin);
  sfx.power();
}));
applySkin(skinKey);
$('btnQuit').addEventListener('click', toMenu);
$('btnMenu').addEventListener('click', toMenu);
const muteBtn = $('btnMute');
muteBtn.classList.toggle('off', muted);
muteBtn.addEventListener('click', () => {
  muted = !muted;
  store.set('dplan-cd-muted', muted);
  muteBtn.classList.toggle('off', muted);
  music.setMuted(muted);
});

// Testhilfe: mit ?debug in der URL unverwundbar spielen und direkt zum nächsten Gate springen
if (new URLSearchParams(location.search).has('debug')) {
  window.runnerDebug = {
    invincible: () => { powers.firewall = 9999; },
    power: (type) => applyPower({ type, mesh: playerGroup }),
    level: (n) => { while (level < n) levelUp(); },
    // Boss Nr. n (0–4) sofort auftauchen lassen
    boss: (n = 0) => { bossCount = n; bossAt = dist; },
    killBoss: () => boss && !boss.dying && defeatBoss(),
    look: () => ({ bossMix, bg: scene.background.getHexString(), bloom: bloom && bloom.strength, audio: audio && audio.state }),
    bossHp: () => boss && { name: boss.name, hp: boss.hp, phase: boss.phase, x: boss.x, dying: boss.dying > 0 },
    nextGate: () => { nextGateAt = dist; },
    info: () => ({ state, dist: Math.round(dist), lives, lane: player.lane, gate: !!gate, gatesAsked, gatesCorrect }),
  };
}

// ---------- Loop ----------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  if (composer) {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
  }
  camera.aspect = w / h;
  baseFov = camera.aspect < 0.8 ? 72 : 62;
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
}
let baseFov = 62;
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  if (state !== 'paused') {
    // UPDATE-Power-up: Zeitlupe für die Welt
    const slow = state === 'playing' && powers.update > 0 ? 0.55 : 1;
    update(dt * slow);
    music.setMuffle(slow < 1);
    music.setDanger(lives === 1 && (state === 'playing' || state === 'gate'));
    updateCamera(dt);
  }
  updateHud();
  if (composer) composer.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

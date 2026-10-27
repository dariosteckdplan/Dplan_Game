(() => {
  'use strict';

  // ---------- Farben & Konstanten (dplan Design) ----------
  const C = {
    blue: '#009fe3',
    blueDark: '#0079b0',
    grey: '#8c8c8f',
    greyDark: '#5d5e61',
    greyLight: '#e6e7e8',
    bg: '#f4f8fb',
    grid: 'rgba(0, 159, 227, 0.08)',
    red: '#e5484d',
    orange: '#f08a24',
    purple: '#7c5cd6',
    green: '#22a06b',
    ink: '#1f2933',
  };
  const FONT = '"Arial Rounded MT Bold", "Helvetica Rounded", "Helvetica Neue", Arial, sans-serif';

  const ENEMY = {
    virus:    { r: 16, hp: 1, speed: 70,  pts: 10, dmg: 10, color: C.red,    label: 'Virus',      desc: 'Klassiker' },
    phishing: { r: 16, hp: 1, speed: 100, pts: 15, dmg: 12, color: C.orange, label: 'Phishing',   desc: 'Schlängelt' },
    spam:     { r: 12, hp: 1, speed: 95,  pts: 5,  dmg: 4,  color: C.grey,   label: 'Spam',       desc: 'Im Rudel' },
    bug:      { r: 15, hp: 2, speed: 75,  pts: 20, dmg: 10, color: C.green,  label: 'Bug',        desc: '2 Treffer' },
    ransom:   { r: 22, hp: 5, speed: 42,  pts: 50, dmg: 25, color: C.purple, label: 'Ransomware', desc: '5 Treffer' },
  };
  // Ab welcher Welle eine Bedrohung auftaucht
  const UNLOCK = { 1: 'virus', 2: 'phishing', 3: 'spam', 4: 'bug', 5: 'ransom' };
  const WEIGHT = { virus: 4, phishing: 3, spam: 2, bug: 2.5, ransom: 1 };

  const POWER = {
    backup:   { label: 'BACKUP',   color: C.green,   msg: '+20 % Netzwerk' },
    cloud:    { label: 'CLOUD',    color: C.blue,    msg: 'Dreifach-Schuss!' },
    update:   { label: 'UPDATE',   color: '#d99a00', msg: 'Schnellfeuer!' },
    firewall: { label: 'FIREWALL', color: '#e5603b', msg: 'Firewall aktiv!' },
  };
  const POWER_WEIGHT = { backup: 3, cloud: 3, update: 3, firewall: 1 };

  // Erste Antwort ist jeweils die richtige (wird beim Anzeigen gemischt)
  const QUESTIONS = [
    { q: 'Deine «Bank» schickt eine E-Mail mit Link zur Bestätigung deines Passworts. Was tust du?',
      a: ['Nicht klicken und die Bank über den offiziellen Weg kontaktieren', 'Link öffnen und kurz prüfen, ob die Seite echt aussieht', 'Die Mail an Kolleginnen und Kollegen weiterleiten'],
      tip: 'Seriöse Banken fragen nie per Mail nach Passwörtern. Im Zweifel: Website selbst eintippen oder anrufen.' },
    { q: 'Welches Passwort ist am sichersten?',
      a: ['Kaffee-Berg-Velo-Laterne-42', 'Sommer2026!', 'P@ssw0rd'],
      tip: 'Lange Passphrasen aus mehreren zufälligen Wörtern sind stark und trotzdem gut merkbar.' },
    { q: 'Wofür steht MFA?',
      a: ['Multi-Faktor-Authentifizierung', 'Mail-Filter-Analyse', 'Maximale Firewall-Aktivität'],
      tip: 'MFA kombiniert z.B. Passwort und App-Bestätigung. Selbst ein gestohlenes Passwort reicht dann nicht.' },
    { q: 'Was besagt die 3-2-1-Backup-Regel?',
      a: ['3 Kopien, auf 2 verschiedenen Medien, 1 davon ausser Haus', '3 Tage, 2 Wochen, 1 Monat aufbewahren', '3 Server, 2 Clouds, 1 USB-Stick'],
      tip: 'So überstehen deine Daten auch Hardware-Defekte, Brand oder Ransomware.' },
    { q: 'Du findest einen USB-Stick auf dem Firmenparkplatz. Was nun?',
      a: ['Nicht einstecken, sondern der IT übergeben', 'Einstecken, um den Besitzer zu finden', 'Zu Hause am privaten PC anschauen'],
      tip: 'Präparierte USB-Sticks sind ein beliebter Angriffsweg – Neugier ist hier der Köder.' },
    { q: 'Wann solltest du Software-Updates installieren?',
      a: ['Möglichst zeitnah, sobald sie verfügbar sind', 'Nur wenn etwas nicht mehr funktioniert', 'Einmal pro Jahr reicht'],
      tip: 'Updates schliessen bekannte Sicherheitslücken – Angreifer nutzen diese oft schon wenige Tage später aus.' },
    { q: 'Du arbeitest im öffentlichen WLAN eines Cafés. Was ist sinnvoll?',
      a: ['Die Firmen-VPN-Verbindung nutzen', 'Dateifreigaben aktivieren, damit es schneller geht', 'Ist egal, das WLAN hat ja ein Passwort'],
      tip: 'In offenen Netzen kann mitgelesen werden. Ein VPN verschlüsselt den gesamten Verkehr.' },
    { q: 'Der «Microsoft-Support» ruft an: Dein PC sei infiziert. Was tust du?',
      a: ['Auflegen und keinen Fernzugriff gewähren', 'Fernwartung erlauben, damit sie helfen können', 'Kreditkartendaten für die Reparatur angeben'],
      tip: 'Microsoft ruft nicht unaufgefordert an. Das ist eine klassische Betrugsmasche.' },
    { q: 'Was ist Ransomware?',
      a: ['Schadsoftware, die Daten verschlüsselt und Lösegeld fordert', 'Ein besonders aggressives Werbeprogramm', 'Ein Filter gegen Spam-Mails'],
      tip: 'Der beste Schutz: aktuelle Systeme, Vorsicht bei Anhängen und getestete Offline-Backups.' },
    { q: 'Eine Mail vom «Chef» verlangt eine dringende, vertrauliche Überweisung. Was tust du?',
      a: ['Über einen bekannten Kanal (z.B. Telefon) rückfragen', 'Sofort überweisen – es ist ja dringend', 'Auf die Mail antworten und die IBAN bestätigen lassen'],
      tip: 'Das ist «CEO-Fraud». Zeitdruck und Geheimhaltung sind typische Warnsignale.' },
    { q: 'Du verlässt kurz deinen Arbeitsplatz. Was gilt?',
      a: ['Bildschirm sperren (z.B. Windows-Taste + L)', 'Monitor ausschalten genügt', 'Nichts – ist ja nur kurz'],
      tip: 'Ein ungesperrter PC ist eine offene Tür – auch für «nur kurz».' },
    { q: 'Darfst du dasselbe Passwort für mehrere Dienste verwenden?',
      a: ['Nein – besser einen Passwort-Manager nutzen', 'Ja, wenn es stark genug ist', 'Ja, aber nur für unwichtige Dienste'],
      tip: 'Wird ein Dienst gehackt, probieren Angreifer die Zugangsdaten automatisch überall aus.' },
    { q: 'Woran erkennst du Phishing häufig?',
      a: ['Abweichende Absenderadresse, Zeitdruck, ungewöhnliche Links', 'Am Firmenlogo in der Signatur', 'An der Uhrzeit, zu der die Mail ankommt'],
      tip: 'Logos lassen sich leicht kopieren. Fahre mit der Maus über Links, bevor du klickst.' },
    { q: 'Was macht eine Firewall?',
      a: ['Sie kontrolliert den Netzwerkverkehr anhand von Regeln', 'Sie kühlt die Server bei Überhitzung', 'Sie löscht Viren von USB-Sticks'],
      tip: 'Eine Firewall entscheidet, welche Verbindungen erlaubt sind – ein wichtiger Teil, aber nicht der einzige Schutz.' },
    { q: 'Du hast versehentlich auf einen verdächtigen Link geklickt. Was jetzt?',
      a: ['Sofort den IT-Support informieren', 'Nichts sagen und hoffen, dass nichts passiert', 'PC neu starten und weiterarbeiten'],
      tip: 'Je schneller die IT Bescheid weiss, desto kleiner der Schaden. Fehler passieren – melden ist richtig!' },
    { q: 'Was bedeutet das Schloss-Symbol (HTTPS) im Browser?',
      a: ['Die Verbindung ist verschlüsselt – die Seite kann trotzdem betrügerisch sein', 'Die Seite ist garantiert sicher und seriös', 'Die Seite wurde von einer Behörde geprüft'],
      tip: 'Auch Phishing-Seiten haben heute fast immer HTTPS. Achte zusätzlich auf die genaue Adresse.' },
    { q: 'Was versteht man unter Social Engineering?',
      a: ['Menschen manipulieren, um an Informationen oder Zugänge zu kommen', 'Teambuilding-Massnahmen in der IT', 'Die Planung von Firmennetzwerken'],
      tip: 'Angreifer nutzen Hilfsbereitschaft, Neugier und Respekt vor Autorität. Gesunde Skepsis schützt.' },
    { q: 'Wie teilst du vertrauliche Firmendateien am besten?',
      a: ['Über die freigegebenen Firmen-Tools mit passenden Berechtigungen', 'Über einen privaten Gratis-Cloud-Dienst', 'Per Mail an die private Adresse'],
      tip: 'Firmen-Tools sind abgesichert, protokolliert und Berechtigungen lassen sich wieder entziehen.' },
    { q: 'Was ist eine Zero-Day-Lücke?',
      a: ['Eine Sicherheitslücke, für die es noch keinen Patch gibt', 'Ein freier Tag für das IT-Team', 'Der erste Tag nach einem Update'],
      tip: 'Hier helfen mehrere Schutzschichten: Monitoring, Rechtekonzepte und schnelles Patchen, sobald möglich.' },
    { q: 'Wie oft sollte man prüfen, ob ein Backup funktioniert?',
      a: ['Regelmässig – inklusive Test-Wiederherstellung', 'Nie, das Backup läuft ja automatisch', 'Nur bei einer Neuinstallation'],
      tip: 'Ein Backup ist erst dann etwas wert, wenn die Wiederherstellung nachweislich klappt.' },
  ];

  // ---------- Helfer ----------
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const pickWeighted = (weights, keys) => {
    const total = keys.reduce((s, k) => s + weights[k], 0);
    let r = Math.random() * total;
    for (const k of keys) {
      r -= weights[k];
      if (r <= 0) return k;
    }
    return keys[keys.length - 1];
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
  function line(g, x1, y1, x2, y2) {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }

  // ---------- Sound (WebAudio, ohne Dateien) ----------
  let audio = null;
  let muted = store.get('dplan-cd-muted', false);
  function tone(freq, dur, type = 'square', vol = 0.05, slide = 0, delay = 0) {
    if (muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime + delay;
      const o = audio.createOscillator();
      const gain = audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gain).connect(audio.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch { /* Audio nicht verfügbar */ }
  }
  const sfx = {
    shoot: () => tone(880, 0.05, 'square', 0.012, 300),
    hit: () => tone(320, 0.06, 'square', 0.03, -120),
    explode: () => tone(180, 0.18, 'sawtooth', 0.045, -140),
    damage: () => tone(110, 0.3, 'sawtooth', 0.07, -60),
    power: () => { tone(660, 0.08, 'triangle', 0.07); tone(990, 0.12, 'triangle', 0.07, 0, 0.08); },
    firewall: () => tone(120, 0.6, 'sawtooth', 0.08, 600),
    correct: () => { tone(523, 0.1, 'triangle', 0.08); tone(659, 0.1, 'triangle', 0.08, 0, 0.1); tone(784, 0.18, 'triangle', 0.08, 0, 0.2); },
    wrong: () => { tone(300, 0.15, 'square', 0.05); tone(220, 0.25, 'square', 0.05, 0, 0.15); },
    wave: () => { tone(440, 0.1, 'triangle', 0.06); tone(660, 0.15, 'triangle', 0.06, 0, 0.1); },
  };

  // ---------- Canvas ----------
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const stage = $('stage');
  let W = 0, H = 0;

  const player = { x: 0, y: 0, size: 52, speed: 540, targetX: null, fireT: 0 };

  function resize() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    player.y = H - 62;
    player.x = clamp(player.x || W / 2, player.size / 2 + 6, W - player.size / 2 - 6);
  }

  // ---------- Spielzustand ----------
  let state = 'menu'; // menu | playing | paused | quiz | dying | gameover
  let score, wave, integrity, enemies, bullets, powerups, particles, texts;
  let spawnQueue, spawnT, spawnInterval, speedMul, waveClearT, banner;
  let shake = 0, flash = 0, time = 0, gridOff = 0;
  let streak, streakT, kills, correct, asked, dyingT;
  let powers = { cloud: 0, update: 0 };
  let deck = [];
  let currentQ = null, quizAnswered = false;
  let lastEntryIdx = -1;

  function resetGame() {
    score = 0; wave = 0; integrity = 100;
    enemies = []; bullets = []; powerups = []; particles = []; texts = [];
    spawnQueue = []; spawnT = 0; spawnInterval = 1; speedMul = 1; waveClearT = 0; banner = null;
    streak = 0; streakT = 0; kills = 0; correct = 0; asked = 0; dyingT = 0;
    powers = { cloud: 0, update: 0 };
    player.x = W / 2;
    player.targetX = null;
  }
  resetGame();

  function newGame() {
    resetGame();
    $('hud').classList.remove('hidden');
    resize();
    show(null);
    state = 'playing';
    startWave(1);
  }

  function startWave(n) {
    wave = n;
    speedMul = 1 + (n - 1) * 0.09;
    spawnInterval = Math.max(0.32, 1.15 - (n - 1) * 0.08);
    spawnQueue = buildWave(n);
    spawnT = 1.6;
    waveClearT = 0;
    const intro = UNLOCK[n];
    banner = {
      title: 'Welle ' + n,
      sub: n === 1 ? 'Schütze das Netzwerk!' : intro ? 'Neue Bedrohung: ' + ENEMY[intro].label : 'Die Angriffe werden schneller',
      t: 2.4,
    };
    sfx.wave();
  }

  function buildWave(n) {
    const pool = Object.keys(UNLOCK).filter((w) => +w <= n).map((w) => UNLOCK[w]);
    const weights = { ...WEIGHT, ransom: WEIGHT.ransom + n * 0.15 };
    const count = 8 + n * 3;
    const q = [];
    for (let i = 0; i < count; i++) q.push(pickWeighted(weights, pool));
    // Neue Bedrohung garantiert früh zeigen
    if (n > 1 && UNLOCK[n]) q.splice(1, 0, UNLOCK[n]);
    return q;
  }

  function spawnEnemy(type) {
    const d = ENEMY[type];
    const n = type === 'spam' ? 3 : 1;
    const margin = d.r + (type === 'phishing' ? 70 : 40);
    const baseX = rand(Math.min(margin, W / 2), Math.max(W - margin, W / 2));
    for (let i = 0; i < n; i++) {
      const x = clamp(baseX + (i - (n - 1) / 2) * 30, d.r + 4, W - d.r - 4);
      enemies.push({
        type, x, bx: x, y: -d.r - i * 16, r: d.r,
        hp: d.hp, maxHp: d.hp,
        vy: d.speed * speedMul * rand(0.85, 1.15),
        phase: Math.random() * Math.PI * 2, t: 0, flash: 0,
      });
    }
  }

  function fire() {
    const y = player.y - player.size / 2;
    const spread = powers.cloud > 0 ? [-0.2, 0, 0.2] : [0];
    for (const a of spread) bullets.push({ x: player.x, y, vx: Math.sin(a) * 640, vy: -Math.cos(a) * 640 });
    sfx.shoot();
  }

  const multiplier = () => Math.min(5, 1 + Math.floor(streak / 6));

  function hitEnemy(e) {
    e.hp--;
    e.flash = 0.08;
    burst(e.x, e.y, C.blue, 4, 120);
    if (e.hp <= 0) killEnemy(e);
    else sfx.hit();
  }

  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    kills++;
    streak++;
    streakT = 1.6;
    const d = ENEMY[e.type];
    const pts = d.pts * multiplier();
    score += pts;
    texts.push({ x: e.x, y: e.y, text: '+' + pts, color: C.blueDark, life: 0.9, max: 0.9, size: 16 });
    burst(e.x, e.y, d.color, e.type === 'ransom' ? 30 : 14);
    sfx.explode();
    const chance = e.type === 'ransom' ? 0.45 : 0.075;
    if (Math.random() < chance) {
      powerups.push({ type: pickWeighted(POWER_WEIGHT, Object.keys(POWER)), x: e.x, y: e.y, vy: 85, t: 0 });
    }
  }

  function damage(amount, x, y) {
    if (state !== 'playing') return;
    amount = Math.round(amount);
    integrity = Math.max(0, integrity - amount);
    shake = 12;
    streak = 0;
    texts.push({ x, y: y - 10, text: '−' + amount + ' %', color: C.red, life: 1, max: 1, size: 15 });
    sfx.damage();
    const hud = $('hud');
    hud.classList.remove('hit');
    void hud.offsetWidth;
    hud.classList.add('hit');
    if (integrity <= 0) {
      state = 'dying';
      dyingT = 1.5;
      burst(player.x, player.y, C.blue, 40, 320);
      burst(player.x, player.y, C.grey, 30, 260);
      shake = 20;
    }
  }

  function applyPower(p) {
    const def = POWER[p.type];
    texts.push({ x: p.x, y: p.y - 20, text: def.msg, color: def.color, life: 1.2, max: 1.2, size: 16 });
    if (p.type === 'backup') integrity = Math.min(100, integrity + 20);
    if (p.type === 'cloud') powers.cloud = 10;
    if (p.type === 'update') powers.update = 8;
    if (p.type === 'firewall') {
      flash = 0.4;
      for (const e of enemies) killEnemy(e);
      sfx.firewall();
    } else {
      sfx.power();
    }
  }

  function burst(x, y, color, n, speed = 220) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(0.3, 1) * speed;
      const life = rand(0.35, 0.8);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: rand(2, 4.5) });
    }
  }

  // ---------- Update ----------
  function update(dt) {
    time += dt;
    gridOff = (gridOff + dt * 24) % 32;
    shake = Math.max(0, shake - dt * 40);
    flash = Math.max(0, flash - dt);
    if (banner) {
      banner.t -= dt;
      if (banner.t <= 0) banner = null;
    }

    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const t of texts) { t.y -= 40 * dt; t.life -= dt; }
    texts = texts.filter((t) => t.life > 0);

    if (state === 'dying') {
      dyingT -= dt;
      if (dyingT <= 0) showGameOver();
      return;
    }
    if (state !== 'playing') return;

    // Spieler
    let dir = 0;
    if (keys.left) dir -= 1;
    if (keys.right) dir += 1;
    if (dir) {
      player.targetX = null;
      player.x += dir * player.speed * dt;
    } else if (player.targetX !== null) {
      const max = player.speed * 1.8 * dt;
      player.x += clamp(player.targetX - player.x, -max, max);
    }
    player.x = clamp(player.x, player.size / 2 + 6, W - player.size / 2 - 6);

    for (const k in powers) powers[k] = Math.max(0, powers[k] - dt);

    player.fireT -= dt;
    if (player.fireT <= 0) {
      fire();
      player.fireT = powers.update > 0 ? 0.11 : 0.26;
    }

    if (spawnQueue.length) {
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnEnemy(spawnQueue.shift());
        spawnT = spawnInterval * rand(0.7, 1.3);
      }
    }

    for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }

    const groundY = H - 24;
    const pr = player.size * 0.45;
    for (const e of enemies) {
      if (e.dead) continue;
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.y += e.vy * dt;
      if (e.type === 'phishing') e.x = clamp(e.bx + Math.sin(e.t * 2.6 + e.phase) * 70, e.r, W - e.r);
      else if (e.type === 'bug') e.x = clamp(e.bx + Math.sin(e.t * 1.6 + e.phase) * 35, e.r, W - e.r);

      for (const b of bullets) {
        if (b.dead) continue;
        const dx = b.x - e.x, dy = b.y - e.y;
        if (dx * dx + dy * dy < (e.r + 5) ** 2) {
          b.dead = true;
          hitEnemy(e);
          if (e.dead) break;
        }
      }
      if (e.dead) continue;

      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy < (e.r + pr) ** 2) {
        e.dead = true;
        burst(e.x, e.y, ENEMY[e.type].color, 14);
        damage(ENEMY[e.type].dmg * 0.6, e.x, e.y);
        continue;
      }
      if (e.y > groundY) {
        e.dead = true;
        burst(e.x, groundY, C.red, 16);
        damage(ENEMY[e.type].dmg, e.x, groundY);
      }
    }
    enemies = enemies.filter((e) => !e.dead);
    bullets = bullets.filter((b) => !b.dead && b.y > -20 && b.x > -20 && b.x < W + 20);

    for (const p of powerups) {
      p.y += p.vy * dt;
      p.t += dt;
      if (Math.abs(p.x - player.x) < player.size / 2 + 26 && Math.abs(p.y - player.y) < player.size / 2 + 10) {
        p.dead = true;
        applyPower(p);
      } else if (p.y > H + 20) {
        p.dead = true;
      }
    }
    powerups = powerups.filter((p) => !p.dead);

    if (streakT > 0) {
      streakT -= dt;
      if (streakT <= 0) streak = 0;
    }

    if (state === 'playing' && !spawnQueue.length && !enemies.length) {
      waveClearT += dt;
      if (waveClearT > 1.1) openQuiz();
    }
  }

  // ---------- Zeichnen ----------
  function drawVirus(g, x, y, r, t) {
    g.save();
    g.translate(x, y);
    g.rotate(t * 1.2);
    g.strokeStyle = C.red;
    g.fillStyle = C.red;
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const cx = Math.cos(a), cy = Math.sin(a);
      line(g, cx * r * 0.6, cy * r * 0.6, cx * r * 1.2, cy * r * 1.2);
      g.beginPath();
      g.arc(cx * r * 1.25, cy * r * 1.25, 3, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    g.fill();
    g.rotate(-t * 1.2);
    for (const s of [-1, 1]) {
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(s * r * 0.32, -r * 0.08, r * 0.24, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = C.ink;
      g.beginPath();
      g.arc(s * r * 0.32, -r * 0.02, r * 0.11, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function drawEnvelope(g, x, y, w, h, color) {
    g.fillStyle = color;
    rr(g, x - w / 2, y - h / 2, w, h, 3);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 2;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(x - w / 2 + 3, y - h / 2 + 3);
    g.lineTo(x, y + 1);
    g.lineTo(x + w / 2 - 3, y - h / 2 + 3);
    g.stroke();
  }

  function drawSpam(g, x, y, r) {
    const w = r * 2.3, h = r * 1.6;
    drawEnvelope(g, x, y, w, h, C.grey);
    g.fillStyle = C.red;
    g.beginPath();
    g.arc(x + w / 2 - 1, y - h / 2 + 1, 5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = `bold 8px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', x + w / 2 - 1, y - h / 2 + 1.5);
  }

  function drawPhishing(g, x, y, r, t) {
    const w = r * 2.2, h = r * 1.55;
    g.save();
    g.translate(x, y);
    g.rotate(Math.sin(t * 2.6) * 0.18);
    // Angelschnur und Haken
    g.strokeStyle = C.greyDark;
    g.lineWidth = 1.5;
    line(g, 0, -h / 2 - 22, 0, -h / 2 + 4);
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(-4, -h / 2 + 4, 4, 0, Math.PI);
    g.stroke();
    drawEnvelope(g, 0, 0, w, h, C.orange);
    g.restore();
  }

  function drawBug(g, x, y, r, t) {
    g.save();
    g.translate(x, y);
    g.rotate(Math.sin(t * 8) * 0.1);
    g.strokeStyle = '#17694a';
    g.lineWidth = 2;
    g.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const yy = i * r * 0.42;
      const wig = Math.sin(t * 14 + i) * 3;
      line(g, -r * 0.55, yy, -r * 1.15, yy + wig + i * 3);
      line(g, r * 0.55, yy, r * 1.15, yy - wig + i * 3);
    }
    line(g, -r * 0.2, r * 0.95, -r * 0.55, r * 1.4);
    line(g, r * 0.2, r * 0.95, r * 0.55, r * 1.4);
    g.fillStyle = C.green;
    g.beginPath();
    g.ellipse(0, -r * 0.1, r * 0.7, r * 0.9, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#17694a';
    g.beginPath();
    g.arc(0, r * 0.78, r * 0.38, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    line(g, 0, -r * 0.9, 0, r * 0.4);
    g.restore();
  }

  function drawRansom(g, x, y, r) {
    const w = r * 1.7, h = r * 1.3;
    const top = y - h / 2 + r * 0.25;
    g.strokeStyle = C.purple;
    g.lineWidth = r * 0.26;
    g.beginPath();
    g.moveTo(x - w * 0.3, top + 2);
    g.lineTo(x - w * 0.3, top - r * 0.25);
    g.arc(x, top - r * 0.25, w * 0.3, Math.PI, 0);
    g.lineTo(x + w * 0.3, top + 2);
    g.stroke();
    g.fillStyle = C.purple;
    rr(g, x - w / 2, top, w, h, 5);
    g.fill();
    g.fillStyle = '#fff';
    g.font = `bold ${Math.round(r * 0.85)}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('$', x, top + h / 2 + 1);
  }

  function drawEnemyShape(g, type, x, y, r, t) {
    if (type === 'virus') drawVirus(g, x, y, r, t);
    else if (type === 'spam') drawSpam(g, x, y, r);
    else if (type === 'phishing') drawPhishing(g, x, y, r, t);
    else if (type === 'bug') drawBug(g, x, y, r, t);
    else if (type === 'ransom') drawRansom(g, x, y, r);
  }

  function drawEnemy(e) {
    drawEnemyShape(ctx, e.type, e.x, e.y, e.r, e.t);
    if (e.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 1.15, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.maxHp > 1 && e.hp < e.maxHp) {
      const w = e.r * 1.8;
      const y = e.y + e.r * 1.15 + 4;
      ctx.fillStyle = C.greyLight;
      rr(ctx, e.x - w / 2, y, w, 4, 2);
      ctx.fill();
      ctx.fillStyle = ENEMY[e.type].color;
      rr(ctx, e.x - w / 2, y, (w * e.hp) / e.maxHp, 4, 2);
      ctx.fill();
    }
  }

  // Spielfigur im Stil des dp-Logos
  function drawPlayer() {
    const s = player.size;
    const x = player.x - s / 2, y = player.y - s / 2;
    if (powers.cloud > 0 || powers.update > 0) {
      const pulse = 0.5 + Math.sin(time * 8) * 0.5;
      ctx.strokeStyle = powers.update > 0 ? POWER.update.color : C.blue;
      ctx.globalAlpha = 0.25 + pulse * 0.35;
      ctx.lineWidth = 3;
      rr(ctx, x - 6, y - 6, s + 12, s + 12, s * 0.3);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.shadowColor = 'rgba(0, 70, 120, 0.28)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    const grad = ctx.createLinearGradient(x, y, x, y + s);
    grad.addColorStop(0, '#c4c5c7');
    grad.addColorStop(1, '#77787b');
    ctx.fillStyle = grad;
    rr(ctx, x, y, s, s, s * 0.24);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    rr(ctx, x + 4, y + 4, s - 8, s - 8, s * 0.18);
    ctx.fill();
    ctx.fillStyle = C.blue;
    ctx.font = `bold ${Math.round(s * 0.52)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('dp', player.x, player.y + 1);
  }

  function drawNetwork() {
    const y = H - 16;
    const danger = integrity < 30;
    ctx.strokeStyle = danger ? 'rgba(229,72,77,0.5)' : 'rgba(0,159,227,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -time * 20;
    line(ctx, 0, y, W, y);
    ctx.setLineDash([]);
    const n = Math.max(4, Math.floor(W / 90));
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * W) / n;
      ctx.fillStyle = C.greyDark;
      rr(ctx, x - 12, y - 8, 24, 16, 3);
      ctx.fill();
      const blink = Math.sin(time * 6 + i * 1.7) > 0;
      ctx.fillStyle = danger ? (blink ? C.red : '#7a2a2d') : blink ? '#5fd3ff' : C.blue;
      ctx.fillRect(x - 8, y - 3, 4, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x - 1, y - 3, 9, 1.5);
      ctx.fillRect(x - 1, y + 1, 9, 1.5);
    }
    ctx.fillStyle = C.grey;
    ctx.font = `bold 9px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('FIRMENNETZWERK', 6, y - 10);
  }

  function drawPower(p) {
    const def = POWER[p.type];
    const bob = Math.sin(p.t * 5) * 3;
    ctx.font = `bold 11px ${FONT}`;
    const w = ctx.measureText(def.label).width + 20;
    const h = 22;
    const x = p.x - w / 2, y = p.y - h / 2 + bob;
    ctx.globalAlpha = 0.25 + (Math.sin(p.t * 8) + 1) * 0.12;
    ctx.fillStyle = def.color;
    rr(ctx, x - 5, y - 5, w + 10, h + 10, 14);
    ctx.fill();
    ctx.globalAlpha = 1;
    rr(ctx, x, y, w, h, 11);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.label, p.x, y + h / 2 + 1);
  }

  function drawBanner() {
    const a = Math.min(1, banner.t / 0.5, (2.4 - banner.t) / 0.3);
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.blue;
    ctx.font = `bold 46px ${FONT}`;
    ctx.fillText(banner.title, W / 2, H * 0.36);
    ctx.font = `bold 15px ${FONT}`;
    const sub = banner.sub.toUpperCase();
    const w = ctx.measureText(sub).width + 34;
    ctx.fillStyle = C.grey;
    ctx.fillRect(W / 2 - w / 2, H * 0.36 + 32, w, 28);
    ctx.fillStyle = '#fff';
    ctx.fillText(sub, W / 2, H * 0.36 + 47);
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate(rand(-1, 1) * shake * 0.5, rand(-1, 1) * shake * 0.5);

    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    for (let x = 16; x < W; x += 32) line(ctx, x, 0, x, H);
    for (let y = gridOff - 32; y < H; y += 32) line(ctx, 0, y, W, y);

    drawNetwork();
    powerups.forEach(drawPower);
    enemies.forEach(drawEnemy);

    ctx.fillStyle = C.blue;
    for (const b of bullets) {
      rr(ctx, b.x - 3, b.y - 8, 6, 16, 3);
      ctx.fill();
    }

    if (state !== 'dying' && state !== 'gameover') drawPlayer();

    for (const p of particles) {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of texts) {
      ctx.globalAlpha = Math.min(1, (t.life / t.max) * 1.5);
      ctx.font = `bold ${t.size}px ${FONT}`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(240, 120, 60, ${flash * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (banner) drawBanner();
  }

  // ---------- HUD ----------
  const hudCache = {};
  function setText(id, value) {
    if (hudCache[id] === value) return;
    hudCache[id] = value;
    $(id).textContent = value;
  }
  function updateHud() {
    if (state === 'menu') return;
    setText('hudScore', fmt(score));
    setText('hudWave', String(wave));
    setText('hudHealthPct', Math.round(integrity) + ' %');
    const bar = $('hudHealth');
    bar.style.width = integrity + '%';
    bar.classList.toggle('warn', integrity <= 60 && integrity > 30);
    bar.classList.toggle('crit', integrity <= 30);
    const m = multiplier();
    $('hudCombo').classList.toggle('hidden', m <= 1);
    setText('hudCombo', 'x' + m);
    const chips = Object.keys(powers)
      .filter((k) => powers[k] > 0)
      .map((k) => `<span class="chip" style="background:${POWER[k].color}">${POWER[k].label} ${Math.ceil(powers[k])}s</span>`)
      .join('');
    if (hudCache.powers !== chips) {
      hudCache.powers = chips;
      $('hudPowers').innerHTML = chips;
    }
  }

  // ---------- Overlays ----------
  const OVERLAYS = { menu: 'ovMenu', quiz: 'ovQuiz', pause: 'ovPause', over: 'ovOver', scores: 'ovScores' };
  function show(name) {
    for (const k in OVERLAYS) $(OVERLAYS[k]).classList.toggle('hidden', k !== name);
    const btn = name && $(OVERLAYS[name]).querySelector('.btn.primary:not(.hidden)');
    if (btn) btn.focus({ preventScroll: true });
  }

  function openQuiz() {
    state = 'quiz';
    powerups = [];
    bullets = [];
    if (!deck.length) deck = shuffle(QUESTIONS.slice());
    currentQ = deck.pop();
    quizAnswered = false;
    asked++;
    $('quizWave').textContent = wave;
    $('quizQ').textContent = currentQ.q;
    const box = $('quizOpts');
    box.innerHTML = '';
    shuffle(currentQ.a.map((text, i) => ({ text, ok: i === 0 }))).forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.dataset.ok = o.ok ? '1' : '';
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = 'ABC'[i];
      const label = document.createElement('span');
      label.textContent = o.text;
      b.append(key, label);
      b.addEventListener('click', () => answer(o.ok, b));
      box.appendChild(b);
    });
    $('quizFeedback').classList.add('hidden');
    $('btnNext').classList.add('hidden');
    show('quiz');
    box.firstChild.focus({ preventScroll: true });
  }

  function answer(ok, btn) {
    if (quizAnswered) return;
    quizAnswered = true;
    for (const b of $('quizOpts').children) {
      b.disabled = true;
      if (b.dataset.ok) b.classList.add('correct');
    }
    const bonus = 100 * wave;
    if (ok) {
      correct++;
      score += bonus;
      integrity = Math.min(100, integrity + 10);
      sfx.correct();
      $('quizResult').textContent = `Richtig! +${fmt(bonus)} Punkte und +10 % Netzwerk`;
    } else {
      btn.classList.add('wrong');
      sfx.wrong();
      $('quizResult').textContent = 'Knapp daneben – so ist es richtig:';
    }
    $('quizTip').textContent = currentQ.tip;
    $('quizFeedback').classList.toggle('bad', !ok);
    $('quizFeedback').classList.remove('hidden');
    const next = $('btnNext');
    next.textContent = `Weiter zu Welle ${wave + 1}`;
    next.classList.remove('hidden');
    next.focus({ preventScroll: true });
  }

  function nextWave() {
    if (state !== 'quiz' || !quizAnswered) return;
    show(null);
    state = 'playing';
    startWave(wave + 1);
  }

  // ---------- Bestenliste (lokal im Browser) ----------
  const SCORE_KEY = 'dplan-cd-scores';
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
      meta.textContent = `Welle ${e.wave}`;
      const pts = document.createElement('span');
      pts.className = 'pts';
      pts.textContent = fmt(e.score);
      li.append(name, meta, pts);
      ol.appendChild(li);
    });
  }

  function showGameOver() {
    state = 'gameover';
    $('overScore').textContent = fmt(score);
    $('overWave').textContent = Math.max(0, wave - 1);
    $('overQuiz').textContent = `${correct}/${asked}`;
    let msg;
    if (wave >= 8) msg = 'Beeindruckend! Du bist ein echter Security-Profi.';
    else if (wave >= 5) msg = 'Starke Abwehr! Mit etwas Übung knackst du die Bestenliste.';
    else if (wave >= 3) msg = 'Guter Anfang – die Angreifer werden immer schneller.';
    else msg = 'Kein Problem: Auch im echten Leben hilft Übung. Nochmal?';
    $('overMsg').textContent = msg;
    lastEntryIdx = -1;
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
    const entry = { name, score, wave: Math.max(0, wave - 1), date: new Date().toISOString() };
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const top = list.slice(0, 10);
    store.set(SCORE_KEY, top);
    lastEntryIdx = top.indexOf(entry);
    renderScores($('overScores'), lastEntryIdx);
    $('saveForm').classList.add('hidden');
    $('btnAgain').focus({ preventScroll: true });
  });

  // ---------- Pause / Menü ----------
  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    show('pause');
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'playing';
    show(null);
  }
  function toMenu() {
    state = 'menu';
    resetGame();
    $('hud').classList.add('hidden');
    resize();
    show('menu');
  }

  // ---------- Eingaben ----------
  const keys = { left: false, right: false };
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key;
    if (state === 'quiz') {
      const idx = { 1: 0, 2: 1, 3: 2, a: 0, b: 1, c: 2 }[k.toLowerCase()];
      if (idx !== undefined && !quizAnswered) $('quizOpts').children[idx]?.click();
      return;
    }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; e.preventDefault(); }
    if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; e.preventDefault(); }
    if (k === 'p' || k === 'P' || k === 'Escape') {
      if (state === 'playing') pause();
      else if (state === 'paused') resume();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
    if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
  });
  const pointerTo = (e) => {
    if (e.pointerType === 'mouse' || e.buttons || e.type === 'pointerdown') player.targetX = e.offsetX;
  };
  canvas.addEventListener('pointermove', pointerTo);
  canvas.addEventListener('pointerdown', pointerTo);

  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', () => { keys.left = keys.right = false; });
  window.addEventListener('resize', resize);

  $('btnStart').addEventListener('click', newGame);
  $('btnAgain').addEventListener('click', newGame);
  $('btnScores').addEventListener('click', () => { renderScores($('scoreList')); show('scores'); });
  $('btnBack').addEventListener('click', () => show('menu'));
  $('btnNext').addEventListener('click', nextWave);
  $('btnPause').addEventListener('click', () => (state === 'paused' ? resume() : pause()));
  $('btnResume').addEventListener('click', resume);
  $('btnQuit').addEventListener('click', toMenu);
  $('btnMenu').addEventListener('click', toMenu);
  const muteBtn = $('btnMute');
  muteBtn.classList.toggle('off', muted);
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    store.set('dplan-cd-muted', muted);
    muteBtn.classList.toggle('off', muted);
  });

  // Legende im Startbildschirm
  for (const type of Object.keys(ENEMY)) {
    const d = ENEMY[type];
    const item = document.createElement('div');
    const c = document.createElement('canvas');
    c.width = 104;
    c.height = 104;
    const g = c.getContext('2d');
    g.scale(2, 2);
    drawEnemyShape(g, type, 26, 28, Math.min(d.r, 16), 0.4);
    const name = document.createElement('b');
    name.textContent = d.label;
    const desc = document.createElement('span');
    desc.textContent = d.desc;
    item.append(c, name, desc);
    $('legend').appendChild(item);
  }

  // ---------- Loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state !== 'paused') update(dt);
    render();
    updateHud();
    requestAnimationFrame(frame);
  }
  resize();
  requestAnimationFrame(frame);
})();

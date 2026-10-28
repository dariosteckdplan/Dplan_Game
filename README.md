# dplan Data Runner

Ein 3D-Browser-Spiel im dplan-Design für Mitarbeitende und Kunden: Als dp-Datenpaket rast du durchs Rechenzentrum, weichst Viren, Phishing-Mails, Spam, Bugs und Ransomware aus und beweist an den **Security-Gates** dein Wissen zur IT-Sicherheit.

## Spielprinzip

- **Spur wechseln:** `←` `→` bzw. `A` `D` – auf dem Handy wischen oder links/rechts antippen.
- **Springen:** `↑`, `W` oder Leertaste – auf dem Handy nach oben wischen. Niedrige Hindernisse (Virus, Bug, Spam) lassen sich überspringen, Ransomware und Phishing nicht.
- **Netzwerk:** 3 Leben. Jeder Treffer kostet eines.
- **Stufen:** Jedes Security-Gate ist ein Checkpoint, danach beginnt die nächste Stufe – höheres Tempo, dichtere Hindernisse, höherer Punkte-Multiplikator und neue Muster:
  - Stufe 2: Phishing-Mails und Spam-Wellen
  - Stufe 3: Ransomware und Sprung-Reihen (alle Spuren belegt)
  - Stufe 4: Slalom-Strecken
  - Stufe 5+: Viren wechseln unterwegs die Spur
  - Das Rechenzentrum wird dabei von Tag über Abend und Dämmerung zur Neon-Nacht.
- **Bosskämpfe:** In der Mitte jeder geraden Stufe (2, 4, 6, 8, 10 …) greift ein Boss an – jeder weitere ist zäher und aggressiver (kürzere Ankündigung, mehr und kombinierte Angriffe). Der Chip feuert dann automatisch – man muss sich in die Spur des Bosses stellen und den angekündigten Angriffen (rote Streifen am Boden) ausweichen. Bei 66 % und 33 % Energie wird der Boss schneller und aggressiver. Sieg: Bonuspunkte, +1 Netzwerk und Power-up-Beute.
  1. **Der Wurm** – spuckt Viren und Bugs
  2. **Phish-Lord** – Köder-Haken und Phishing-Mails
  3. **Botnetz-Kern** – Drohnen-Angriffe; verwundbar nur, wenn sein Schild offen ist
  4. **Ransom-Koloss** – Boden-Schläge (Druckwelle überspringen) und Schloss-Wände
  5. **Zero-Day** – Laserstrahlen über mehrere Spuren, teleportiert sich
  - Danach kehren die Bosse stärker zurück (II, III …).
- **Power-ups** (teils erst ab höheren Stufen):
  - `ANTIVIRUS` – der Chip schiesst Laser und zerstört Hindernisse (Ransomware braucht 3 Treffer)
  - `SCAN` – eine Welle säubert die sichtbare Strecke
  - `FIREWALL` – kurz unverwundbar, rammt Hindernisse weg
  - `UPDATE` – Zeitlupe
  - `2FA` – doppelte Punkte
  - `CLOUD` – zieht Datenpakete an
  - `BACKUP` – +1 Netzwerk
- **Security-Gate:** Vor jedem Gate verschwinden die Hindernisse und das Spiel **hält an**. Die Frage erscheint unten im Bild – Antwort antippen (oder `←` `→` und `Enter`, bzw. `1` `2` `3`). Danach gibt es eine kurze Erklärung, mit «Weiter» fährt das Paket durchs gewählte Tor. Richtig = Bonuspunkte und +1 Netzwerk, falsch = −1 Netzwerk. Über 60 Fragen aus acht Themen (Phishing, Passwörter, Social Engineering, Malware & Updates, Backup & Daten, Datenschutz, Arbeitsplatz, Netzwerk & Vorfälle); innerhalb einer Runde wiederholt sich keine Frage.
- **Auswertung:** Am Spielende zeigt «Deine Antworten an den Security-Gates» jede gestellte Frage mit der eigenen und der richtigen Antwort samt Tipp – bei Fehlern automatisch aufgeklappt.
- **Bestenliste:** Top 10. Läuft das Spiel über `serve.ps1`, ist sie für alle Spielenden gemeinsam (gespeichert in `data/scores.json`). Auf einem rein statischen Webserver bleibt sie lokal im Browser.
- **Datenchip-Designs:** Classic, Night oder Ice – Auswahl im Startmenü, wird gespeichert.
- **Soundtrack «Datacenter Drive»:** wird live im Browser erzeugt (WebAudio, keine Musikdateien) und reagiert aufs Spiel:
  - jede Stufe wird schneller (112 → 140 BPM), steigt in der Tonart und bekommt neue Spuren (Clap, Melodie, Supersaw-Stabs, verzerrter Bass); die Kick lässt alles «pumpen»
  - Riser und Trommelwirbel vor einem Security-Gate, ruhige Fläche zum Nachdenken, Impact beim Weiterfahren
  - eigenes, düsteres Boss-Thema (harmonisch Moll) mit Alarm, Auftritts-Stinger und Explosionsserie beim Sieg
  - Herzschlag bei nur noch einem Netzwerk-Leben, gedämpfter Klang in der Zeitlupe, Tonband-Stopp bei Game Over
  - räumliche Effekte: Hindernisse zischen links/rechts vorbei, Datenbits in Serie steigen die Tonleiter hinauf
  - Der ♪-Knopf oben rechts schaltet Musik und Effekte aus.

## Starten

Webseite ohne Build-Schritt. Die 3D-Bibliothek [Three.js](https://threejs.org) (0.160.0, MIT-Lizenz) liegt in `vendor/three/` – das Spiel läuft also auch ohne Internet, z.B. an einem Messestand oder hinter einer strengen Firewall.

```powershell
./serve.ps1
```

Dann http://localhost:8080 öffnen. Der Server stellt unter `/api/scores` auch die gemeinsame Bestenliste bereit.

**Im Netz für andere Geräte freigeben** (z.B. Wettbewerb im Büro oder Tablets am Messestand):

```powershell
./serve.ps1 -Public
```

Das braucht entweder eine PowerShell mit Admin-Rechten oder einmalig eine URL-Reservierung (in einer Admin-PowerShell: `netsh http add urlacl url=http://+:8080/ user="$env:USERDOMAIN\$env:USERNAME"`) sowie eine Firewall-Regel für den Port. Andere Geräte öffnen dann `http://<Rechnername>:8080`.

**Bestenliste zurücksetzen:** `data/scores.json` löschen (der Ordner `data/` wird nicht ins Git eingecheckt).

Zum Veröffentlichen ohne gemeinsame Bestenliste genügt es, `index.html`, `style.css`, `runner.js`, `questions.js`, `assets/` und `vendor/` auf einen beliebigen Webserver (z.B. Intranet, Azure Static Web Apps, GitHub Pages) zu kopieren. Direktes Öffnen der Datei per Doppelklick funktioniert nicht (ES-Module brauchen einen Webserver).

## Anpassen

- **Quizfragen:** `questions.js` – die erste Antwort ist jeweils die richtige (wird beim Anzeigen gemischt). `cat` ist das Thema, `tip` die Erklärung nach der Antwort.
- **Tempo & Schwierigkeit:** `SPEED_START`, `levelSpeed`, `UNLOCK_LEVEL`, `GATE_EVERY` und `POWER` oben in `runner.js`; Muster in `spawnRow()`.
- **Farben & Lichtstimmung:** `C` und `THEMES` in `runner.js`, CSS-Variablen in `style.css`.
- **Grafik:** Der Glow-Effekt (Bloom) ist auf Touch-Geräten aus Performance-Gründen deaktiviert.
- **Testen:** Mit `?debug` in der URL stehen in der Browser-Konsole `runnerDebug.invincible()`, `runnerDebug.nextGate()`, `runnerDebug.level(5)`, `runnerDebug.power('antivirus')`, `runnerDebug.boss(0–4)`, `runnerDebug.killBoss()` und `runnerDebug.info()` zur Verfügung.

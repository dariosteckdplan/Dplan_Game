# dplan Data Runner

Ein 3D-Browser-Spiel im dplan-Design für Mitarbeitende und Kunden: Als dp-Datenpaket rast du durchs Rechenzentrum, weichst Viren, Phishing-Mails, Spam, Bugs und Ransomware aus und beweist an den **Security-Gates** dein Wissen zur IT-Sicherheit.

## Spielprinzip

- **Spur wechseln:** `←` `→` bzw. `A` `D` – auf dem Handy wischen oder links/rechts antippen.
- **Springen:** `↑`, `W` oder Leertaste – auf dem Handy nach oben wischen. Niedrige Hindernisse (Virus, Bug, Spam) lassen sich überspringen, Ransomware und Phishing nicht.
- **Netzwerk:** 3 Leben. Jeder Treffer kostet eines.
- **Power-ups:** `BACKUP` (+1 Netzwerk), `CLOUD` (zieht Datenpakete an), `FIREWALL` (kurz unverwundbar).
- **Security-Gate:** Vor jedem Gate verschwinden die Hindernisse und das Spiel **hält an**. Die Frage erscheint unten im Bild – Antwort antippen (oder `←` `→` und `Enter`, bzw. `1` `2` `3`). Danach gibt es eine kurze Erklärung, mit «Weiter» fährt das Paket durchs gewählte Tor. Richtig = Bonuspunkte und +1 Netzwerk, falsch = −1 Netzwerk.
- **Bestenliste:** Top 10, lokal im Browser gespeichert.
- **Datenchip-Designs:** Classic, Night oder Ice – Auswahl im Startmenü, wird gespeichert.
- **Soundtrack «Datacenter Drive»:** wird live im Browser erzeugt (WebAudio, keine Musikdateien). Im Menü und an den Security-Gates läuft eine ruhige Fläche, im Spiel kommen Beat, Bass und Melodie dazu. Der ♪-Knopf oben rechts schaltet Musik und Effekte aus.

## Starten

Statische Webseite ohne Build-Schritt. Die 3D-Bibliothek [Three.js](https://threejs.org) wird per CDN (jsDelivr) geladen – es braucht also eine Internetverbindung.

```powershell
./serve.ps1
```

Dann http://localhost:8080 öffnen. Zum Veröffentlichen genügt es, `index.html`, `style.css`, `runner.js`, `questions.js` und `assets/` auf einen beliebigen Webserver (z.B. Intranet, Azure Static Web Apps, GitHub Pages) zu kopieren. Direktes Öffnen der Datei per Doppelklick funktioniert nicht (ES-Module brauchen einen Webserver).

## Anpassen

- **Quizfragen:** `questions.js` – die erste Antwort ist jeweils die richtige (wird beim Anzeigen gemischt).
- **Tempo & Schwierigkeit:** `SPEED_START`, `SPEED_MAX`, `SPEED_RAMP`, `GATE_EVERY` und `UNLOCK_AT` oben in `runner.js`.
- **Farben:** `C` in `runner.js` und die CSS-Variablen in `style.css`.
- **Testen:** Mit `?debug` in der URL stehen in der Browser-Konsole `runnerDebug.invincible()`, `runnerDebug.nextGate()` und `runnerDebug.info()` zur Verfügung.

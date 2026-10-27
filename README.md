# dplan Cyber Defense

Ein Browser-Arcade-Spiel im dplan-Design für Mitarbeitende und Kunden: Schütze das Firmennetzwerk vor Viren, Phishing-Mails, Spam, Bugs und Ransomware – und beweise nach jeder Welle dein Wissen im **Security-Check**.

## Spielprinzip

- **Steuerung:** Maus / Finger bewegen oder `←` `→` bzw. `A` `D`. Geschossen wird automatisch. `P` / `Esc` pausiert.
- **Bedrohungen:** Erreicht ein Angreifer das Firmennetzwerk am unteren Rand, sinkt die Netzwerk-Integrität. Bei 0 % ist das Spiel vorbei.
- **Combo:** Viele Treffer in Folge erhöhen den Punkte-Multiplikator (bis x5).
- **Power-ups:** `BACKUP` (+20 % Netzwerk), `CLOUD` (Dreifach-Schuss), `UPDATE` (Schnellfeuer), `FIREWALL` (räumt den Bildschirm).
- **Security-Check:** Nach jeder Welle eine Frage zur IT-Sicherheit (Phishing, Passwörter, MFA, Backups …) mit Erklärung. Richtig = Bonuspunkte und +10 % Netzwerk.
- **Bestenliste:** Top 10, lokal im Browser gespeichert.

## Starten

Reine statische Webseite ohne Abhängigkeiten. Lokal:

```powershell
./serve.ps1
```

Dann http://localhost:8080 öffnen. Zum Veröffentlichen genügt es, `index.html`, `style.css`, `game.js` und `assets/` auf einen beliebigen Webserver (z.B. Intranet, Azure Static Web Apps, GitHub Pages) zu kopieren.

## Anpassen

- **Quizfragen:** Array `QUESTIONS` in `game.js` – die erste Antwort ist jeweils die richtige (wird beim Anzeigen gemischt).
- **Farben:** `C` in `game.js` und die CSS-Variablen in `style.css`.
- **Schwierigkeit:** `ENEMY`, `UNLOCK` und `startWave()` in `game.js`.

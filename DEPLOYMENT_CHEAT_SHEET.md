# Deployment Cheat Sheet (Mac -> NUC) 🚀

Diese Anleitung beschreibt, wie du Änderungen von deinem Mac auf den NUC überträgst und dort anwendest.

## 1. Synchronisieren (Code übertragen) 📡
Vor jedem Update muss der aktuelle Code auf den NUC kopiert werden.

**Führe diesen Befehl auf deinem Mac aus (im Projektordner):**
```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '.next' . michael@kanban.local:~/projektboard-platform
```
*Erklärung:*
- `rsync`: Synchronisiert Dateien effizient.
- `-avz`: Archiv-Modus (behält Rechte), Verbose (zeigt Details), Komprimiert.
- `--exclude`: Lässt unnötige Ordner weg (spart Zeit und Bandbreite).

---

## 2. Update Anwenden (Deployment) 🛠️
Nachdem der Code drüben ist, musst du dich einloggen und das Update script ausführen, um die Container neu zu bauen.

**Führe diesen Befehl auf deinem Mac aus:**
```bash
ssh -t michael@kanban.local "cd ~/projektboard-platform/deploy && sudo ./install.sh --prod"
```

*Erklärung:*
- `ssh -t`: Verbindet sich und erzwingt ein Pseudoterminal (wichtig für `sudo`-Passworteingabe).
- `cd ...`: Geht in den Deploy-Ordner.
- `sudo ./install.sh --prod`: Führt das Installer-Script im Produktions-Modus aus. Das baut die Docker-Container neu und startet sie.

---

## 3. Diagnose & Logs 🩺
Falls etwas nicht klappt, kannst du dir die Logs ansehen.

**Logge dich zuerst ein:**
```bash
ssh michael@kanban.local
cd ~/projektboard-platform
```

**Wichtige Befehle auf dem NUC:**
```bash
# Zeige Logs aller Container
docker compose logs -f --tail=50

# Zeige nur App-Logs
docker compose logs -f projektboard-app

# Status der Container prüfen
docker compose ps
```

---

## Zusammenfassung (One-Liner) ⚡️
Wenn du mutig bist, kannst du beides in einer Zeile machen:

```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '.next' . michael@kanban.local:~/projektboard-platform && \
# 2. Update & Rebuild App (Production Mode)
# WICHTIG: ./install.sh --prod nutzen, damit HTTPS URLs korrekt gesetzt werden!
ssh -t michael@kanban.local "cd ~/projektboard-platform/deploy && sudo ./install.sh --prod"
```
*(Kopiert erst, und führt nur bei Erfolg das Update aus)*

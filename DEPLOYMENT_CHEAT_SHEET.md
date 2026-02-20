# Production Update Cheat Sheet (Safe Mode) 🛡️

Diese Anleitung beschreibt, wie du Updates sicher auf das Produktivsystem (NUC) einspielst.

⚠️ **WICHTIG**: Wir nutzen NICHT `install.sh` für Updates, da dieses Script die Datenbank-User zurücksetzen würde. Wir nutzen `docker compose`.

## 1. Synchronisieren (Code übertragen) 📡
Kopiert die aktuellen Dateien von deinem Mac auf den NUC.
**WICHTIG:** Wir schließen `.env` Dateien aus, damit deine lokale Dev-Konfiguration nicht die Prod-Konfiguration auf dem NUC überschreibt!

**Auf deinem Mac ausführen (im Projektordner):**
```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '.next' --exclude '.env' --exclude '.env.local' . michael@kanban.local:~/projektboard-platform
```

---

## 2. Prod-URLs reparieren (Falls nötig) 🩹
Falls du *versehentlich* schon eine falsche `.env` hochgeladen hast (z.B. weil der vorherige Befehl das nicht ausgeschlossen hat), müssen wir sicherstellen, dass die URLs auf HTTPS stehen.

**Einmalig auf dem Mac ausführen (repariert die .env auf dem NUC):**
```bash
ssh michael@kanban.local "sed -i '' 's|NEXT_PUBLIC_SUPABASE_URL=http://.*:8000|NEXT_PUBLIC_SUPABASE_URL=https://kanban.local|g' ~/projektboard-platform/deploy/.env && sed -i '' 's|GOTRUE_SITE_URL=http://.*:3000|GOTRUE_SITE_URL=https://kanban.local|g' ~/projektboard-platform/deploy/.env"
```
*(Das stellt sicher, dass https://kanban.local verwendet wird statt Port 8000)*

---

## 3. Update Anwenden (App Rebuild) 🛠️
Dieser Befehl baut die App neu und startet sie.

**Auf deinem Mac ausführen:**
```bash
ssh -t michael@kanban.local "cd ~/projektboard-platform/deploy && \
docker compose build --no-cache app && \
docker compose up -d app"
```

---

## Zusammenfassung (Safe Update One-Liner) ⚡️

```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '.next' --exclude '.env' --exclude '.env.local' . michael@kanban.local:~/projektboard-platform && \
ssh -t michael@kanban.local "cd ~/projektboard-platform/deploy && ./update.sh"
```

**(Alternative: Schritt für Schritt)**
Falls du kein Script nutzen willst, ist dies der manuelle Weg:
```bash
ssh -t michael@kanban.local "cd ~/projektboard-platform/deploy && \
docker compose build --no-cache app && \
docker compose up -d app"
```

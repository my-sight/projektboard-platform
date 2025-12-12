
# 📦 ProjektBoard Appliance - Installationsanleitung

Diese Anleitung führt dich Schritt für Schritt durch die Installation der Software auf einem frischen **Intel NUC** (oder jedem anderen Mini-PC).

---

## 🏗️ 1. Vorab-Checkliste
Du benötigst:
- [ ] Einen **Intel NUC** (oder vergleichbaren PC).
- [ ] Einen **USB-Stick** (min. 8GB) für die Ubuntu-Installation.
- [ ] Einen zweiten USB-Stick (oder Netzwerkzugriff) für die Projekt-Dateien.
- [ ] Eine Internetverbindung (WLAN oder Kabel) am NUC.

---

## 💿 2. Betriebssystem installieren
Wir empfehlen **Ubuntu Server 24.04 LTS** (stabil, sicher, kein unnötiger Schnickschnack). Wenn du lieber eine grafische Oberfläche am Gerät möchtest, nimm **Ubuntu Desktop**.

1.  Lade [Ubuntu Server](https://ubuntu.com/download/server) herunter.
2.  Erstelle einen bootfähigen USB-Stick (z.B. mit dem Tool [BalenaEtcher](https://www.balena.io/etcher/)).
3.  Stecke den Stick in den NUC und starte ihn.
4.  Wähle im Menü "Install Ubuntu Server".
5.  Folge den Anweisungen (Sprache, Tastatur, Netzwerk).
    *   **Wichtig:** Bei der Frage "SSH Setup" -> **[x] Install OpenSSH server** ankreuzen (damit du später vom Mac aus zugreifen kannst).
    *   (Optional) Bei "Featured Server Snaps" kannst du **Docker** direkt auswählen, dann sparst du dir Schritt 4!

---

## 📂 3. Dateien übertragen
Sobald der NUC läuft und du eingeloggt bist:

1.  Kopiere deinen gesamten Projektordner `projektboard-platform` auf den NUC.
    *   *Per USB-Stick:* Stick reinstecken, mounten (bei Server etwas fummelig) -> Einfacher:
    *   *Per Netzwerk (vom Mac aus):*
        ```bash
        # Befehl auf deinem Mac Terminal:
        scp -r /Users/michael/Documents/Kanban/projektboard-platform dein-user@IP-ADRESSE-DES-NUC:/home/dein-user/
        ```

---

## 🐳 4. Docker installieren
(Falls du es bei der Ubuntu-Installation nicht angehakt hast).

Führe diese Befehle auf dem **NUC** aus:

```bash
# 1. System aktualisieren
sudo apt update && sudo apt upgrade -y

# 2. Docker Installations-Script laden und ausführen (Offizieller Weg)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 3. Deinen Benutzer zur Docker-Gruppe hinzufügen (WICHTIG!)
# "$USER" wird automatisch durch deinen aktuellen Benutzernamen ersetzt.
# Wenn nach einem Passwort gefragt wird: Es ist dein Ubuntu-Passwort (vom Installieren).
sudo usermod -aG docker $USER

# 4. Einmal abmelden und wieder anmelden (damit die Gruppen-Rechte greifen)
exit
# (Jetzt neu einloggen)
```

---

## 🚀 5. ProjektBoard installieren
Jetzt wird es ernst. Gehe in den Projektordner auf dem NUC:

```bash
# 1. In den Ordner wechseln
cd projektboard-platform

# 2. In den Deployment-Ordner wechseln
cd deploy

# 3. Installer starten
./install.sh
```

**Was passiert jetzt?**
- Das Skript prüft, ob Docker läuft.
- Es generiert **sichere Passwörter** für die Datenbank.
- Es baut die Anwendung (das kann beim ersten Mal 5-10 Minuten dauern).
- Es startet alles.

---

## ✅ 6. Der erste Start
Sobald das Skript "Installation Complete" meldet:

1.  Gehe an deinem Mac in den Browser.
2.  Tippe die IP-Adresse des NUC ein: `http://IP-ADRESSE-DES-NUC:3000`
3.  Du siehst den Login-Screen!
4.  **Registrierung:** Klicke auf "Sign Up" und erstelle deinen Admin-Account.
    *   Nutze die E-Mail-Adresse, die du im Code als Superuser hinterlegt hast (z.B. `admin@projektboard.de`), um Zugriff auf die System-Steuerung zu haben.

---

## 🔄 Updates einspielen
Wenn du am Code weiterentwickelt hast:
1.  Kopiere die neuen Dateien auf den NUC (überschreiben).
2.  Führe das Update-Skript aus:
    ```bash
    cd projektboard-platform/deploy
    ./update.sh
    ```

**Hinweis zur Datenbank:**
Das Skript prüft automatisch den Ordner `supabase/migrations`. Wenn du neue Tabellen angelegt hast (und eine Migrations-Datei erstellt hast), werden diese automatisch in die Datenbank eingespielt!

Adresse der Datenbank:
http://localhost:54323

---

## 🔑 7. Lizenzierung (Wichtig!)
Damit das System dauerhaft läuft, benötigst du eine **Lizenz**. Ohne diese sperrt sich das System nach dem Start.

1.  **Lizenz generieren (auf deinem Mac):**
    Öffne dein Terminal im Projektordner und führe aus:
    ```bash
    node scripts/generate_license.js 2026-12-12 "xyz-Firma"
    ```
    Das Terminal spuckt einen langen Text aus (den "Token"). Kopiere diesen komplett.

2.  **Lizenz eingeben (im Browser):**
    Sobald du dich auf dem NUC eingeloggt hast, wirst du automatisch auf die Seite `/license` umgeleitet (falls keine Lizenz da ist).
    -   Füge den kopierten Token dort ein.
    -   Klicke "Aktivieren".
    -   Fertig! Das System ist nun für 1 Jahr freigeschaltet.

---

**Viel Erfolg! 🥳**

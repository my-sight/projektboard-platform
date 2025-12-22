
# 📦 ProjektBoard Appliance - Installationsanleitung

Diese Anleitung führt dich Schritt für Schritt durch die Installation der Software auf einem frischen **Intel NUC** (oder jedem anderen Mini-PC).

-----

## 🏗️ 1. Vorab-Checkliste
Du benötigst:
- [ ] Einen **Intel NUC** (oder vergleichbaren PC).
- [ ] Einen **USB-Stick** (min. 8GB) für die Ubuntu-Installation.
- [ ] Einen zweiten USB-Stick (oder Netzwerkzugriff) für die Projekt-Dateien.
- [ ] Eine Internetverbindung (WLAN oder Kabel) am NUC.

**Empfohlene Hardware:**
*   **Minimum:** Intel/AMD Dual-Core, 4GB RAM, 32GB SSD (Nur für kleine Tests/Demos).
*   **Empfohlen:** Intel i3/i5 (oder neuer), **8GB RAM**, 128GB SSD (Für stabilen Dauerbetrieb).
*   **Hinweis:** 4GB RAM sind das absolute Minimum. Mit 8GB läuft das System deutlich flüssiger und stabiler, da die Datenbank und der Server Speicher benötigen.

---

## 💿 2. Betriebssystem installieren
Wir empfehlen **Ubuntu Server 24.04 LTS** (stabil, sicher, kein unnötiger Schnickschnack). Wenn du lieber eine grafische Oberfläche am Gerät möchtest, nimm **Ubuntu Desktop**.

1.  Lade [Ubuntu Server](https://ubuntu.com/download/server) herunter.
2.  Erstelle einen bootfähigen USB-Stick (z.B. mit dem Tool [BalenaEtcher](https://www.balena.io/etcher/)).
3.  Stecke den Stick in den NUC und starte ihn.
4.  Wähle im Menü "Install Ubuntu Server".
5.  Folge den Anweisungen (Sprache, Tastatur, Netzwerk).
    *   **Profile Setup:** Hier legst du deinen **Benutzernamen** und dein **Passwort** fest. (Gut merken! Das brauchst du gleich zum Einloggen).
    *   **Wichtig:** Bei der Frage "SSH Setup" -> **[x] Install OpenSSH server** ankreuzen.
    *   **Festplattenverschlüsselung (Empfohlen):**
        *   Wähle bei "Guided storage configuration": **[x] Use an entire disk**
        *   Setze das Häkchen bei: **[x] Set up this disk as an LVM group**
        *   Setze das Häkchen bei: **[x] Encrypt the LVM group with LUKS**
        *   Erstelle eine **Passphrase** (Achtung: NUC bootet jetzt nur noch mit diesem Passwort, bis wir Schritt 2b gemacht haben!).
    *   **SEHR WICHTIG:** Im Schritt "Featured Server Snaps" musst du **[x] docker** auswählen!
        *   Navigiere mit den Pfeiltasten zu "docker".
        *   Drücke LEERTASTE zum Auswählen (ein Sternchen * erscheint).
        *   Das erspart dir später die manuelle Installation!

---

---

## 🔐 2b. Automatischen Start (TPM Binding) einrichten (Optional)
Damit der NUC **automatisch bootet** (ohne Passworteingabe), aber die Festplatte trotzdem verschlüsselt bleibt (Schutz gegen Diebstahl der Platte), verbinden wir sie mit dem TPM-Chip des NUCs.

1.  Logge dich nach der Installation ein.
2.  Installiere die nötigen Tools:
    ```bash
    sudo apt update
    sudo apt install clevis clevis-tpm2 clevis-luks clevis-initramfs -y
    ```
3.  Verbinde die Festplatte mit dem TPM-Chip:
    Such zuerst deine verschlüsselte Partition (meist `/dev/sda3` oder `/dev/nvme0n1p3`).
    ```bash
    lsblk
    ```
    Dann führe das Binding aus (ersetze `/dev/sdaX` mit deinem Laufwerk):
    ```bash
    sudo clevis luks bind -d /dev/sda3 tpm2 '{"pcr_bank":"sha256","pcr_ids":"7"}'
    ```
    *(Du musst hier noch einmal dein LUKS-Passwort eingeben).*
4.  Update die Boot-Umgebung:
    ```bash
    sudo update-initramfs -u -k 'all'
    ```
5.  **Test:** Starte neu (`sudo reboot`). Der NUC sollte jetzt ohne Passwort hochfahren! 🚀

---

## 📂 3. Dateien übertragen (Per USB-Stick)

Nach dem Neustart siehst du nur schwarzen Text (**Befehlszeile**). Das ist normal!
1.  Bei `login:` deinen Benutzernamen tippen (Enter).
2.  Bei `password:` dein Passwort tippen (Enter – **Achtung:** Man sieht keine Sternchen!).

Sobald du eingeloggt bist, müssen wir den USB-Stick manuell einbinden ("mounten").

1.  **Stick vorbereiten:**
    *   Kopiere den Ordner `projektboard-platform` auf einen USB-Stick (formatiert als **FAT32** oder **ExFAT**).
    *   Stecke den Stick in den NUC.

2.  **Stick finden:**
    Gib diesen Befehl ein, um alle Laufwerke zu sehen:
    ```bash
    lsblk
    ```
    Suche nach deinem Stick. Meistens heißt er `sda1` oder `sdb1` (achte auf die Größe, z.B. "14G").

3.  **Stick einbinden (Mounten):**
    ```bash
    # 1. Ordner erstellen, wo der Stick erscheinen soll
    sudo mkdir -p /media/usb

    # 2. Einbinden (Ersetze 'sdb1' mit deinem Stick-Namen aus Schritt 2)
    sudo mount /dev/sdb1 /media/usb
    ```

4.  **Daten kopieren:**
    Prüfe kurz, wie der Ordner auf dem Stick heißt:
    ```bash
    ls /media/usb
    ```
    (Du solltest hier `projektboard-platform` sehen).

    Dann kopiere ihn in dein Home-Verzeichnis:
    ```bash
    cp -r /media/usb/projektboard-platform ~/
    ```

5.  **Stick auswerfen:**
    ```bash
    sudo umount /media/usb
    ```
    Jetzt kannst du den Stick abziehen.

*(Alternative: Wenn du den Stick nicht nutzen willst, kannst du die Dateien auch per `scp` über das Netzwerk senden).*

---

## � 4. ProjektBoard installieren
(Da du Docker schon bei der Ubuntu-Installation ausgewählt hast, können wir direkt loslegen!)

Gehe in den Projektordner auf dem NUC:

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
- **NEU:** Es fragt dich nach der **IP-Adresse** des NUC. Drücke ENTER für `localhost` (nur lokal) oder gib die echte IP ein (z.B. `192.168.1.50`), damit Zugriff vom Mac möglich ist.
- Es generiert **sichere Passwörter** für die Datenbank.
- Es baut die Anwendung (das kann beim ersten Mal 5-10 Minuten dauern).
- Es startet alles.

---

## ✅ 5. Der erste Start
Sobald das Skript "Installation Complete" meldet:

1.  Gehe an deinem Mac in den Browser.
2.  Tippe die IP-Adresse des NUC ein: `http://IP-ADRESSE-DES-NUC:3000`
3.  Du siehst den Login-Screen!
4.  **Registrierung:** Klicke auf "Sign Up" und erstelle deinen Admin-Account.
    *   Nutze die E-Mail-Adresse, die du im Code als Superuser hinterlegt hast (z.B. `admin@projektboard.de`), um Zugriff auf die System-Steuerung zu haben.

---

## 🔄 6. Updates einspielen
Wenn du am Code weiterentwickelt hast:
1.  Kopiere die neuen Dateien auf den NUC (überschreiben).
2.  Führe das Update-Skript aus:
    ```bash
    cd projektboard-platform/deploy
    ./update.sh
    ```

**Hinweis zur Datenbank:**
Das Skript prüft automatisch den Ordner `supabase/migrations`. Wenn du neue Tabellen angelegt hast (und eine Migrations-Datei erstellt hast), werden diese automatisch in die Datenbank eingespielt!

---

## 🔑 7. Lizenzierung (Wichtig!)
Damit das System dauerhaft läuft, benötigst du eine **Lizenz**. Ohne diese sperrt sich das System nach dem Start.

1.  **Lizenz generieren (auf deinem Mac):**
    Öffne dein Terminal im Projektordner und führe aus:
    ```bash
    node scripts/generate_license.js 2026-12-12 "xyz-Firma" 50
    ```
    *(Das "50" am Ende ist die maximale Anzahl der Benutzer. Wenn du es weglässt, sind es standardmäßig 50).*

    Das Terminal spuckt einen langen Text aus (den "Token"). Kopiere diesen komplett.

2.  **Lizenz eingeben (im Browser):**
    Sobald du dich auf dem NUC eingeloggt hast, wirst du automatisch auf die Seite `/license` umgeleitet (falls keine Lizenz da ist).
    -   Füge den kopierten Token dort ein.
    -   Klicke "Aktivieren".
    -   Fertig! Das System ist nun für 1 Jahr freigeschaltet.

---


---

## 🛠️ 8. Tägliche Arbeit (Entwicklung)

Wenn du am Projekt arbeitest, brauchst du zwei Dinge:

1.  **Datenbank (im Hintergrund)**:
    *   Starten: `npm run db:start`
    *   Stoppen: `npm run db:stop`
    *   Erreichbar unter: http://localhost:54323
    *   *(Muss nur einmal gestartet werden, läuft dann meistens weiter)*

2.  **Webseite (Frontend)**:
    *   Starten: `npm run dev`
    *   Erreichbar unter: [http://localhost:3000]


**Wenn mal gar nichts geht (Alles aus):**
1.  Docker Desktop starten
2.  `npm run db:start` (Warten bis "Started" kommt)
3.  `npm run dev`

---

**Viel Erfolg! 🥳**


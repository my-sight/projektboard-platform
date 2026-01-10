
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
    *   **Falls "docker" nicht in der Liste ist:**
        *   Kein Problem! Wähle nichts aus (LXD ist **nicht** das Richtige).
        *   Wir installieren es später mit einem Befehl nach (siehe Punkt 3).

---

## 🔧 3. Vorbereitung (Falls Docker fehlte)
Falls du Docker bei der Installation nicht auswählen konntest, mache dies **direkt nach dem ersten Einloggen** (noch vor dem USB-Stick):

```bash
sudo apt update
sudo apt install docker.io docker-compose-v2 -y
sudo usermod -aG docker $USER
```
*Danach einmal ausloggen (`exit`) und wieder einloggen, damit die Rechte wirksam werden!*

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

1.  **Stick vorbereiten (am Mac):**
    *   Stecke den USB-Stick an deinen Mac.
    *   Format: **ExFAT** oder **MS-DOS (FAT)** (im Festplattendienstprogramm).
    *   **Kopieren per Terminal (Empfohlen, da schneller & sauberer):**
        ```bash
        # 1. In deinen Projektordner wechseln (wo die Dateien liegen)
        # (Pfad ggf. anpassen)
        cd "/Users/michael/Documents/mysight pmo/projektboard-platform"

        # 2. Prüfen, wo der Stick ist
        ls /Volumes

        # 3. Kopieren (ohne node_modules)
        rsync -av --progress --exclude='node_modules' --exclude='.git' ./ /Volumes/MYSIGHTPMO/projektboard-platform
        ```
    *   Stick auswerfen und abziehen.
    *   Stecke den Stick nun in den **NUC**.

2.  **Stick finden (am NUC):**
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

## 🚀 4. ProjektBoard installieren (Plug & Play)
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
- **NEU:** Es fragt dich nach der **IP-Adresse** des NUC.
    *   **Tipp:** Wenn du die IP nicht kennst, öffne ein zweites Terminal auf dem NUC und gib ein: `hostname -I` (das große I wie Ida).
    *   Gib die echte IP ein (z.B. `192.168.1.50`), damit Zugriff vom Mac möglich ist.
- Es generiert **automatisch** alle nötigen Datenbank-Tabellen (`init_schema.sql`).
- Es legt den **Superuser** `michael@mysight.net` an.
- Es installiert eine **Standard-Lizenz** (2 User).
- Es baut die Anwendung und startet alles.

---

## ✅ 5. Der erste Start (Plug & Play)

Sobald das Skript "Installation Complete" meldet ist alles bereit:

1.  Gehe an deinem Mac in den Browser.
2.  Tippe die IP-Adresse des NUC ein: `http://IP-ADRESSE-DES-NUC:3000`
3.  Du siehst den Login-Screen!
4.  **Einloggen:** Nutze den vorinstallierten Superuser:
    *   **Email:** `michael@mysight.net`
    *   **Passwort:** `Serum4x!`

Du bist sofort eingeloggt und kannst loslegen!

---

## � 6. Umzug zum Kunden (IP-Wechsel)
Wenn du den NUC in der Werkstatt eingerichtet hast und ihn dann zum Kunden bringst, ändert sich meist die IP-Adresse (anderes Netzwerk).

**Das ist kein Problem!**
1.  Schließe den NUC beim Kunden an.
2.  Logge dich ein (Bildschirm/Tastatur oder SSH via neue IP).
3.  Gehe in den Ordner:
    ```bash
    cd projektboard-platform/deploy
    ```
4.  Führe den Installer erneut aus:
    ```bash
    ./install.sh
    ```
5.  Gib die **neue IP-Adresse** ein, die der NUC beim Kunden hat.

Das System passt sich automatisch an. Deine Daten bleiben erhalten! (Es werden nur die Netzwerkgrundeinstellungen aktualisiert).

---

## 🔒 6b. HTTPS / SSL (Produktion)
Falls der Kunde HTTPS (Verschlüsselung) wünscht, benötigst du Zertifikate.

**Anforderungen an das Zertifikat:**
1.  **Format:** PEM-Format (Base64 ASCII).
2.  **Dateinamen:**
    *   `server.crt`: Das öffentliche Zertifikat (inkl. Intermediate Chain, falls vorhanden).
    *   `server.key`: Der private Schlüssel (ohne Passphrase!).
3.  **Hostnames (SAN):** Das Zertifikat muss den Hostnamen enthalten, unter dem der NUC erreichbar ist (z.B. `kanban.kunde.internal` oder `kanban.local`).

**Installation:**
Lege die Dateien auf dem NUC an folgendem Ort ab:
```bash
sudo mkdir -p /etc/nginx/ssl
sudo cp dein-zertifikat.crt /etc/nginx/ssl/server.crt
sudo cp dein-key.key /etc/nginx/ssl/server.key
sudo chmod 600 /etc/nginx/ssl/server.key
```
Danach installiere mit `./install.sh --prod`.

---

## 🔄 7. Updates einspielen
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

## 🔑 7. Lizenzierung (Automatisch)
Das System wird mit einer **Standard-Lizenz** ausgeliefert:
- **Gültig bis:** 31.12.2030
- **Max. Benutzer:** 2

Du musst nichts tun. Das System ist sofort freigeschaltet.

**Falls eine eigene Firmen-Lizenz nötig ist:**
Nur wenn du die Firma ändern oder mehr User brauchst:
1.  **Lizenz generieren (auf deinem Mac):**
    ```bash
    node scripts/generate_license.js 2026-12-31 "Firmenname" 50
    ```
2.  Token kopieren.
3.  Im Browser unter `/license` eingeben.

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

## ❓ 9. Problembehebung (Troubleshooting)

**Falls die Installation fehlschlägt (z.B. Datenbank startet nicht):**
Wenn beim ersten `install.sh` etwas schiefgeht, kann die Datenbank in einem "halb-fertigen" Zustand sein. Das System denkt dann, es sei installiert, aber es fehlen Daten.

**Lösung: Alles zurücksetzen und neu starten**
Führe diese Befehle im `deploy`-Ordner aus:

```bash
# 1. Alles stoppen
docker compose down

# 2. Datenbank-Daten löschen (ACHTUNG: Löscht alle Daten auf dem NUC!)
sudo rm -rf volumes/

# 3. Installation erneut starten
./install.sh
```

---

**Viel Erfolg! 🥳**


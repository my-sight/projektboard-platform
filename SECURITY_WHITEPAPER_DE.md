# 🛡️ Sicherheits-Architektur: ProjektBoard Appliance
**Version:** 1.0 | **Stand:** Januar 2026 | **Klassifizierung:** Öffentlich

## 1. Executive Summary
Die ProjektBoard Appliance ist eine **On-Premise Lösung**, die speziell für den Einsatz in sensiblen Unternehmensnetzwerken (Intranet) entwickelt wurde. Anders als Cloud-Lösungen ("SaaS") verbleiben **100% der Daten** physisch auf der Hardware des Kunden (Data Sovereignty).

Die Sicherheitsarchitektur folgt dem **"Defense in Depth"**-Prinzip und kombiniert Härtungsmaßnahmen auf Netzwerk-, Betriebssystem- und Applikationsebene.

---

## 2. Netzwerksicherheit

### 2.1 TLS Termination Proxy (Nginx)
Der einzige Eintrittspunkt in das System ist ein gehärteter **Nginx Reverse Proxy**.
*   **Protokolle:** Ausschließlich HTTPS (Port 443).
*   **Verschlüsselung:** TLS 1.2 / 1.3 (Modern Ciphers).
*   **HSTS (Strict Transport Security):** Erzwingt browserseitig verschlüsselte Verbindungen (Schutz gegen Downgrade-Attacken).
*   **Zertifikate:** Unterstützung für kundeneigene CA-Zertifikate (X.509/PEM).

### 2.2 Host-Firewall & Port Isolation
*   **UFW (Uncomplicated Firewall):** Der Host operiert nach dem "Default Deny" Prinzip. Alle eingehenden Verbindungen sind blockiert, außer Port 22 (SSH Wait-Limited), 80 (Redirect) und 443 (HTTPS).
*   **Docker Isolation:** Interne Dienste (Datenbank, Admin-Dashboards, APIs) sind an `127.0.0.1` (Localhost) gebunden und **von außen physikalisch nicht erreichbar**. Ein Zugriff ist nur über den gesicherten Nginx-Tunnel möglich.

### 2.3 Intrusion Prevention (Fail2Ban)
Automatisierte Überwachung der Zugriffs-Logs blockiert IP-Adressen temporär, die wiederholte fehlgeschlagene Login-Versuche (Brute Force) auf SSH oder Web-Ebene durchführen.

---

## 3. Applikationssicherheit

### 3.1 Authentifizierung & Autorisierung
*   **Technologie:** Supabase GoTrue (basiert auf Netlify GoTrue).
*   **Standard:** OAuth2 / JWT (JSON Web Tokens).
*   **Flow:** PKCE (Proof Key for Code Exchange) Flow für maximale Sicherheit im Browser.
*   **Session Management:** HttpOnly, Secure, SameSite=Lax Cookies (Schutz gegen XSS und CSRF).

### 3.2 Row Level Security (RLS)
Der Zugriff auf Daten wird nicht nur auf Applikationsebene, sondern direkt in der Datenbank (PostgreSQL) durch **Row Level Security Policies** geprüft.
*   Selbst bei einer Kompromittierung des Applikations-Servers könnte ein Angreifer nicht auf Daten anderer Mandanten oder geschützte Systemtabellen (`profiles`, `system_settings`) zugreifen.

### 3.3 Container Security
*   **Non-Root User:** Die Next.js Applikation läuft innerhalb des Docker-Containers als unprivilegierter Benutzer (`uid: 1001`), um Container-Breakouts zu verhindern.
*   **Minimal Image:** Basierend auf Alpine Linux (Minimaler Angriffsvektor).

---

## 4. Datenschutz & Datenhoheit

### 4.1 Datenspeicherung
*   **Datenbank:** PostgreSQL 15 (Enterprise Standard).
*   **Dateien:** Lokales Dateisystem (kein Upload in öffentliche Clouds wie AWS S3).

### 4.2 Backups & Disaster Recovery
*   **Verschlüsselung:** Alle Backups werden automatisch mit **AES-256** (OpenSSL) verschlüsselt, bevor sie geschrieben werden.
*   **Off-Site Storage:** Das System unterstützt nativ die Einbindung externer Speichermedien (USB, NAS-Mounts). Ein integrierter Prozess ermöglicht die Konfiguration eines dedizierten, externen Backup-Ziels, um IT-Compliance-Anforderungen (z.B. räumliche Trennung) zu erfüllen.
*   **Inhalt:** Vollständiger Dump der Datenbank + Dateispeicher.

### 4.3 Physische Sicherheit (TPM Binding)
*   **Full Disk Encryption:** Die Festplattenverschlüsselung (LUKS2) wird kryptografisch an den **Trusted Platform Module (TPM 2.0)** Chip der Hardware gebunden (Clevis/Tang).
*   **Diebstahlschutz:** Wird das Gerät gestohlen oder die Festplatte ausgebaut, sind die Daten ohne den spezifischen TPM-Chip des Original-Servers **nicht lesbar**.
*   **Redundanz:** Diese Technologie ist vollständig kompatibel mit **RAID-1** (Systemspiegelung). Die Verschlüsselungsebene liegt transparent über dem RAID-Verbund, sodass Ausfallsicherheit und Diebstahlschutz gleichzeitig gewährleistet sind.

---

## 5. Compliance Checkliste für IT-Abteilungen

| Anforderung | Status | Implementierung |
| :--- | :--- | :--- |
| **Verschlüsselung (Transit)** | ✅ Erfüllt | TLS 1.3 über Nginx |
| **Verschlüsselung (Rest)** | ✅ Möglich | LUKS Full-Disk Encryption (OS-Level) |
| **Zugriffskontrolle** | ✅ Erfüllt | Firewall, Internal Binding, JWT Auth |
| **Datenstandort** | ✅ DE/EU | 100% On-Premise beim Kunden |
| **Updates** | ✅ Manuell | Gekapselte Updates via Script, kein Auto-Update "nach Hause" |

---
*Dieses Dokument dient der technischen Übersicht und stellt keine rechtliche Garantie dar.*

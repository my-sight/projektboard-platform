# Admin API Setup

Die Admin-Ansicht verwendet serverseitige API-Routen, um Benutzer- und Abteilungsdaten mit erhöhten Rechten zu ändern. Damit diese Funktionen funktionieren, muss in deiner Umgebung der Supabase Service-Role-Key verfügbar sein.

## Benötigte Umgebungsvariable

```env
SUPABASE_SERVICE_ROLE_KEY=dein-service-role-key
```

> **Wichtig:** Der Service-Role-Key darf niemals im Browser landen. Hinterlege ihn nur in serverseitigen Umgebungen (.env.local, Vercel Project Settings etc.).

## Benötigte Tabellen & Policies

* `profiles` – enthält die Felder `full_name`, `role`, `company`, `is_active` usw.
* `departments` – referenziert die verfügbaren Abteilungen.

Die API-Routen erwarten, dass dein Supabase-Schema INSERT/UPDATE/DELETE über den Service-Role-Key erlaubt. Zusätzliche RLS-Policies sind nicht erforderlich, solange der Service-Role-Key verwendet wird.

## Verfügbare Endpunkte

| Methode & Pfad | Beschreibung |
| --- | --- |
| `PATCH /api/admin/users/:id` | Aktualisiert Name, Rolle, Abteilung oder Aktiv-Status eines Profils. |
| `DELETE /api/admin/users/:id` | Entfernt Benutzer (inklusive Supabase Auth-Account) dauerhaft. |
| `POST /api/admin/departments` | Legt eine neue Abteilung an. |
| `DELETE /api/admin/departments/:id` | Löscht eine vorhandene Abteilung. |

Die Admin-Oberfläche ruft diese Endpunkte direkt auf. Stelle sicher, dass deine Umgebung korrekt konfiguriert ist, bevor du Benutzeränderungen durchführst.

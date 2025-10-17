# Admin API Setup

Die Admin-Ansicht verwendet serverseitige API-Routen, um Benutzer- und Abteilungsdaten mit erhöhten Rechten zu ändern. Wenn verfügbar, nutzen die Routen automatisch den Supabase Service-Role-Key. Fehlt der Key, fällt das System auf den authentifizierten Benutzerkontext zurück und erlaubt damit zumindest Änderungen am eigenen Profil (z. B. sich selbst zum Admin befördern), während privilegierte Aktionen entsprechend mit einem Hinweis abbrechen.

## Benötigte Umgebungsvariable

```env
SUPABASE_SERVICE_ROLE_KEY=dein-service-role-key
```

> **Wichtig:** Der Service-Role-Key darf niemals im Browser landen. Hinterlege ihn nur in serverseitigen Umgebungen (.env.local, Vercel Project Settings etc.). Ohne den Key bleiben sensitive Operationen gesperrt und die API meldet dies mit einem eindeutigen Fehler.

## Benötigte Tabellen & Policies

* `profiles` – enthält die Felder `full_name`, `role`, `company`, `is_active` usw.
* `departments` – referenziert die verfügbaren Abteilungen.

Die API-Routen erwarten, dass dein Supabase-Schema INSERT/UPDATE/DELETE über den Service-Role-Key erlaubt. Zusätzliche RLS-Policies sind nicht erforderlich, solange der Service-Role-Key verwendet wird.

## Verfügbare Endpunkte

| Methode & Pfad | Beschreibung |
| --- | --- |
| `PATCH /api/admin/users/:id` | Aktualisiert Name, Rolle, Abteilung oder Aktiv-Status eines Profils. Ohne Service-Role-Key sind nur Änderungen am eigenen Profil möglich. |
| `DELETE /api/admin/users/:id` | Entfernt Benutzer (inklusive Supabase Auth-Account) dauerhaft. Erfordert zwingend den Service-Role-Key. |
| `POST /api/admin/departments` | Legt eine neue Abteilung an. Erfordert den Service-Role-Key oder angepasste Supabase-Policies. |
| `DELETE /api/admin/departments/:id` | Löscht eine vorhandene Abteilung. Erfordert den Service-Role-Key oder angepasste Supabase-Policies. |

Die Admin-Oberfläche ruft diese Endpunkte direkt auf. Stelle sicher, dass deine Umgebung korrekt konfiguriert ist, bevor du Benutzeränderungen durchführst.

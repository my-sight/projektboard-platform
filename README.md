# mysight Multiprojektplattform

Produktionsreifes Multiprojekt- und Task-Management für Raspberry Pi 4. Enthält Login via NextAuth, drag-and-drop Multiprojektboards, Unterboards pro Karte und Dashboard mit persönlichem FLOW-Überblick.

## Kernfunktionen
- **Authentifizierung**: NextAuth Credentials + Prisma/MariaDB, Rollen ADMIN/OWNER/MEMBER.
- **Multiprojektboards**: Phasen konfigurierbar, Karten in drei Größen, SK/LK-Logik, Status-Popover (1000 ms Hover), Popup zur Detailbearbeitung mit Tabs.
- **Unterboards (Swimlanes)**: Spalten WAIT → USER → NEXT_FLOW → FLOW → DONE, Tasks mit Archivierung und Cleanup nach 6 Monaten.
- **Dashboard**: „Meine Boards“ + Tabelle „Meine Tasks im FLOW“ inkl. Abschließen-Button.
- **APIs**: Vollständige REST-Handlers für Boards, Karten, Status, Team, Subboards, Tasks, persönliche Aufgaben.
- **Sicherheit**: CSRF Double-Submit, Rate-Limiting, HTTPS-Enforcement via Nginx.

## Entwicklung
```bash
npm install
npx prisma generate
npm run dev
```

Environment-Variablen siehe [.env.example](./.env.example).

### Prisma
```bash
npx prisma migrate dev
npx prisma db seed
```

### Tests
```bash
npm run test      # Vitest Unit-Tests
npm run test:e2e  # Playwright E2E (erfordert laufenden Server, Prisma Client und Seed-Daten)
```

## Deployment
- Build: `npm run build`
- Start (Prod): `npm run start`
- PM2: siehe [ecosystem.config.js](./ecosystem.config.js)
- Systemd/Nginx/Cleanup siehe Ordner [deploy](./deploy)

Weitere Details zur Installation auf dem Raspberry Pi im Abschnitt „Install- & Deploy-Anleitung“ im Ergebnisreport.

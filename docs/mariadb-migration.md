# Evaluating a Migration from Supabase to MariaDB

This project relies heavily on Supabase for both data persistence and authentication. Supabase provides:

- Managed Postgres database with row-level security and RPC support.
- Built-in authentication (sign-in, password reset, admin APIs).
- Client SDK used directly in the React application (`@supabase/supabase-js`).

## Current Supabase Touchpoints

Key areas that instantiate Supabase clients or call Supabase-specific features:

- `src/contexts/AuthContext.tsx` – handles login, logout, session refresh, and admin-only user listing via `supabase.auth.admin`.
- `src/app/page.tsx` – loads Kanban boards using direct table queries and the `list_all_boards` RPC.
- `src/components/kanban/OriginalKanbanBoard.tsx` and related helpers – query boards, columns, cards, and updates live via Supabase channels.
- `src/components/admin/UserManagement.tsx` – performs profile CRUD, department assignment, and account provisioning with admin APIs.

## Implications of Switching to MariaDB

Moving to MariaDB would require rebuilding both the authentication flow and data access layer:

1. **Authentication Replacement** – Supabase Auth is Postgres-backed; MariaDB would need an alternative (e.g., NextAuth with credential/OIDC providers) plus new tables for users, sessions, password hashes, and audit trails.
2. **API Layer Introduction** – The frontend currently communicates directly with Supabase. A MariaDB setup would necessitate REST or GraphQL endpoints (Next.js API routes, NestJS, Express) or an ORM like Prisma/TypeORM to bridge the database.
3. **Rewriting RPCs and Triggers** – Functions such as `list_all_boards` and row-level security policies need MariaDB equivalents (stored procedures, views, or service logic).
4. **Model Migration** – Existing tables (`kanban_boards`, `board_columns`, `cards`, `profiles`, `departments`, etc.) depend on Postgres data types (UUID, JSON). These must be adapted to MariaDB-compatible types and constraints.
5. **Frontend Refactor** – Every Supabase call (`createClient`, `.from()`, `.rpc()`) must be redirected to the new API. This affects authentication context, board fetching, admin dashboards, and real-time updates.

## Recommendation

Supabase remains the more practical choice for this codebase because it bundles the necessary auth, database, and real-time capabilities already integrated throughout the app. A MariaDB migration would amount to a comprehensive re-architecture touching most files and introducing significant new backend infrastructure.

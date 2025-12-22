drop extension if exists "pg_net";


  create table "public"."board_attendance" (
    "id" uuid not null default gen_random_uuid(),
    "board_id" uuid not null,
    "profile_id" uuid not null,
    "week_start" date not null,
    "status" text not null default 'present'::text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."board_attendance" enable row level security;


  create table "public"."board_escalation_history" (
    "id" uuid not null default gen_random_uuid(),
    "board_id" uuid not null,
    "card_id" text not null,
    "escalation_id" uuid,
    "changed_by" uuid,
    "changes" jsonb not null default '{}'::jsonb,
    "changed_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."board_escalation_history" enable row level security;


  create table "public"."board_escalations" (
    "id" uuid not null default gen_random_uuid(),
    "board_id" uuid not null,
    "card_id" text not null,
    "category" text not null,
    "project_code" text,
    "project_name" text,
    "reason" text,
    "measure" text,
    "department_id" uuid,
    "responsible_id" uuid,
    "target_date" date,
    "completion_steps" integer not null default 0,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."board_escalations" enable row level security;


  create table "public"."board_favorites" (
    "user_id" uuid not null,
    "board_id" uuid not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."board_favorites" enable row level security;


  create table "public"."board_members" (
    "id" uuid not null default gen_random_uuid(),
    "board_id" uuid not null,
    "profile_id" uuid not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "role" text default 'member'::text
      );


alter table "public"."board_members" enable row level security;


  create table "public"."board_top_topics" (
    "id" uuid not null default gen_random_uuid(),
    "board_id" uuid not null,
    "title" text not null default ''::text,
    "calendar_week" text,
    "position" integer not null default 0,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "due_date" date
      );


alter table "public"."board_top_topics" enable row level security;


  create table "public"."departments" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."departments" enable row level security;


  create table "public"."kanban_board_settings" (
    "board_id" uuid not null,
    "user_id" uuid,
    "settings" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."kanban_board_settings" enable row level security;


  create table "public"."kanban_boards" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "settings" jsonb not null default '{"boardType": "standard"}'::jsonb,
    "visibility" text not null default 'public'::text,
    "owner_id" uuid,
    "user_id" uuid,
    "board_admin_id" uuid,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."kanban_boards" enable row level security;


  create table "public"."kanban_cards" (
    "id" uuid not null default gen_random_uuid(),
    "board_id" uuid not null,
    "card_id" text not null,
    "card_data" jsonb not null,
    "stage" text,
    "position" integer,
    "project_number" text,
    "project_name" text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."kanban_cards" enable row level security;


  create table "public"."personal_notes" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "content" text not null,
    "due_date" date,
    "is_done" boolean default false,
    "created_at" timestamp with time zone default now(),
    "calendar_week" text
      );


alter table "public"."personal_notes" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "email" text not null,
    "full_name" text,
    "avatar_url" text,
    "bio" text,
    "company" text,
    "role" text not null default 'user'::text,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."profiles" enable row level security;


  create table "public"."system_settings" (
    "id" text not null default 'config'::text,
    "primary_color" text default '#4aa3ff'::text,
    "secondary_color" text default '#19c37d'::text,
    "font_family" text default 'Inter'::text,
    "logo_url" text,
    "app_name" text default 'Projektboard'::text,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."system_settings" enable row level security;

CREATE UNIQUE INDEX board_attendance_pkey ON public.board_attendance USING btree (id);

CREATE UNIQUE INDEX board_attendance_unique ON public.board_attendance USING btree (board_id, profile_id, week_start);

CREATE INDEX board_escalation_history_board_card_idx ON public.board_escalation_history USING btree (board_id, card_id, changed_at DESC);

CREATE INDEX board_escalation_history_escalation_idx ON public.board_escalation_history USING btree (escalation_id, changed_at DESC);

CREATE UNIQUE INDEX board_escalation_history_pkey ON public.board_escalation_history USING btree (id);

CREATE UNIQUE INDEX board_escalations_board_card_id_idx ON public.board_escalations USING btree (board_id, card_id);

CREATE INDEX board_escalations_board_category_idx ON public.board_escalations USING btree (board_id, category);

CREATE UNIQUE INDEX board_escalations_pkey ON public.board_escalations USING btree (id);

CREATE UNIQUE INDEX board_favorites_pkey ON public.board_favorites USING btree (user_id, board_id);

CREATE UNIQUE INDEX board_members_pkey ON public.board_members USING btree (id);

CREATE UNIQUE INDEX board_members_unique ON public.board_members USING btree (board_id, profile_id);

CREATE INDEX board_top_topics_board_position_idx ON public.board_top_topics USING btree (board_id, "position");

CREATE UNIQUE INDEX board_top_topics_pkey ON public.board_top_topics USING btree (id);

CREATE UNIQUE INDEX departments_name_key ON public.departments USING btree (name);

CREATE UNIQUE INDEX departments_pkey ON public.departments USING btree (id);

CREATE UNIQUE INDEX kanban_board_settings_pkey ON public.kanban_board_settings USING btree (board_id);

CREATE INDEX kanban_boards_admin_idx ON public.kanban_boards USING btree (board_admin_id);

CREATE INDEX kanban_boards_owner_idx ON public.kanban_boards USING btree (owner_id);

CREATE UNIQUE INDEX kanban_boards_pkey ON public.kanban_boards USING btree (id);

CREATE INDEX kanban_boards_visibility_idx ON public.kanban_boards USING btree (visibility);

CREATE UNIQUE INDEX kanban_cards_board_card_id_idx ON public.kanban_cards USING btree (board_id, card_id);

CREATE UNIQUE INDEX kanban_cards_pkey ON public.kanban_cards USING btree (id);

CREATE INDEX kanban_cards_stage_idx ON public.kanban_cards USING btree (board_id, stage, "position");

CREATE UNIQUE INDEX personal_notes_pkey ON public.personal_notes USING btree (id);

CREATE UNIQUE INDEX profiles_email_key ON public.profiles USING btree (email);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX system_settings_pkey ON public.system_settings USING btree (id);

alter table "public"."board_attendance" add constraint "board_attendance_pkey" PRIMARY KEY using index "board_attendance_pkey";

alter table "public"."board_escalation_history" add constraint "board_escalation_history_pkey" PRIMARY KEY using index "board_escalation_history_pkey";

alter table "public"."board_escalations" add constraint "board_escalations_pkey" PRIMARY KEY using index "board_escalations_pkey";

alter table "public"."board_favorites" add constraint "board_favorites_pkey" PRIMARY KEY using index "board_favorites_pkey";

alter table "public"."board_members" add constraint "board_members_pkey" PRIMARY KEY using index "board_members_pkey";

alter table "public"."board_top_topics" add constraint "board_top_topics_pkey" PRIMARY KEY using index "board_top_topics_pkey";

alter table "public"."departments" add constraint "departments_pkey" PRIMARY KEY using index "departments_pkey";

alter table "public"."kanban_board_settings" add constraint "kanban_board_settings_pkey" PRIMARY KEY using index "kanban_board_settings_pkey";

alter table "public"."kanban_boards" add constraint "kanban_boards_pkey" PRIMARY KEY using index "kanban_boards_pkey";

alter table "public"."kanban_cards" add constraint "kanban_cards_pkey" PRIMARY KEY using index "kanban_cards_pkey";

alter table "public"."personal_notes" add constraint "personal_notes_pkey" PRIMARY KEY using index "personal_notes_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."system_settings" add constraint "system_settings_pkey" PRIMARY KEY using index "system_settings_pkey";

alter table "public"."board_attendance" add constraint "board_attendance_board_id_fkey" FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id) ON DELETE CASCADE not valid;

alter table "public"."board_attendance" validate constraint "board_attendance_board_id_fkey";

alter table "public"."board_attendance" add constraint "board_attendance_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."board_attendance" validate constraint "board_attendance_profile_id_fkey";

alter table "public"."board_attendance" add constraint "board_attendance_status_check" CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text]))) not valid;

alter table "public"."board_attendance" validate constraint "board_attendance_status_check";

alter table "public"."board_attendance" add constraint "board_attendance_unique" UNIQUE using index "board_attendance_unique";

alter table "public"."board_escalation_history" add constraint "board_escalation_history_board_id_fkey" FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id) ON DELETE CASCADE not valid;

alter table "public"."board_escalation_history" validate constraint "board_escalation_history_board_id_fkey";

alter table "public"."board_escalation_history" add constraint "board_escalation_history_changed_by_fkey" FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."board_escalation_history" validate constraint "board_escalation_history_changed_by_fkey";

alter table "public"."board_escalation_history" add constraint "board_escalation_history_escalation_id_fkey" FOREIGN KEY (escalation_id) REFERENCES public.board_escalations(id) ON DELETE CASCADE not valid;

alter table "public"."board_escalation_history" validate constraint "board_escalation_history_escalation_id_fkey";

alter table "public"."board_escalations" add constraint "board_escalations_board_id_fkey" FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id) ON DELETE CASCADE not valid;

alter table "public"."board_escalations" validate constraint "board_escalations_board_id_fkey";

alter table "public"."board_escalations" add constraint "board_escalations_category_check" CHECK ((category = ANY (ARRAY['LK'::text, 'SK'::text, 'Y'::text, 'R'::text]))) not valid;

alter table "public"."board_escalations" validate constraint "board_escalations_category_check";

alter table "public"."board_escalations" add constraint "board_escalations_completion_steps_check" CHECK (((completion_steps >= 0) AND (completion_steps <= 4))) not valid;

alter table "public"."board_escalations" validate constraint "board_escalations_completion_steps_check";

alter table "public"."board_escalations" add constraint "board_escalations_department_id_fkey" FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL not valid;

alter table "public"."board_escalations" validate constraint "board_escalations_department_id_fkey";

alter table "public"."board_escalations" add constraint "board_escalations_responsible_id_fkey" FOREIGN KEY (responsible_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."board_escalations" validate constraint "board_escalations_responsible_id_fkey";

alter table "public"."board_favorites" add constraint "board_favorites_board_id_fkey" FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id) ON DELETE CASCADE not valid;

alter table "public"."board_favorites" validate constraint "board_favorites_board_id_fkey";

alter table "public"."board_favorites" add constraint "board_favorites_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."board_favorites" validate constraint "board_favorites_user_id_fkey";

alter table "public"."board_members" add constraint "board_members_board_id_fkey" FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id) ON DELETE CASCADE not valid;

alter table "public"."board_members" validate constraint "board_members_board_id_fkey";

alter table "public"."board_members" add constraint "board_members_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."board_members" validate constraint "board_members_profile_id_fkey";

alter table "public"."board_members" add constraint "board_members_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text]))) not valid;

alter table "public"."board_members" validate constraint "board_members_role_check";

alter table "public"."board_top_topics" add constraint "board_top_topics_board_id_fkey" FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id) ON DELETE CASCADE not valid;

alter table "public"."board_top_topics" validate constraint "board_top_topics_board_id_fkey";

alter table "public"."departments" add constraint "departments_name_key" UNIQUE using index "departments_name_key";

alter table "public"."kanban_board_settings" add constraint "kanban_board_settings_board_id_fkey" FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id) ON DELETE CASCADE not valid;

alter table "public"."kanban_board_settings" validate constraint "kanban_board_settings_board_id_fkey";

alter table "public"."kanban_board_settings" add constraint "kanban_board_settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."kanban_board_settings" validate constraint "kanban_board_settings_user_id_fkey";

alter table "public"."kanban_boards" add constraint "kanban_boards_board_admin_id_fkey" FOREIGN KEY (board_admin_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."kanban_boards" validate constraint "kanban_boards_board_admin_id_fkey";

alter table "public"."kanban_boards" add constraint "kanban_boards_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."kanban_boards" validate constraint "kanban_boards_owner_id_fkey";

alter table "public"."kanban_boards" add constraint "kanban_boards_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."kanban_boards" validate constraint "kanban_boards_user_id_fkey";

alter table "public"."kanban_boards" add constraint "kanban_boards_visibility_check" CHECK ((visibility = ANY (ARRAY['public'::text, 'private'::text]))) not valid;

alter table "public"."kanban_boards" validate constraint "kanban_boards_visibility_check";

alter table "public"."kanban_cards" add constraint "kanban_cards_board_id_fkey" FOREIGN KEY (board_id) REFERENCES public.kanban_boards(id) ON DELETE CASCADE not valid;

alter table "public"."kanban_cards" validate constraint "kanban_cards_board_id_fkey";

alter table "public"."personal_notes" add constraint "personal_notes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."personal_notes" validate constraint "personal_notes_user_id_fkey";

alter table "public"."profiles" add constraint "profiles_email_key" UNIQUE using index "profiles_email_key";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

set check_function_bodies = off;

create or replace view "public"."board_attendance_matrix" as  SELECT board_id,
    week_start,
    jsonb_object_agg((profile_id)::text, jsonb_build_object('status', status)) AS statuses
   FROM public.board_attendance ba
  GROUP BY board_id, week_start
  ORDER BY board_id, week_start DESC;


create or replace view "public"."board_attendance_week_series" as  WITH bounds AS (
         SELECT board_attendance.board_id,
            min(board_attendance.week_start) AS first_week,
            GREATEST(max(board_attendance.week_start), (date_trunc('week'::text, (CURRENT_DATE)::timestamp with time zone))::date) AS last_week
           FROM public.board_attendance
          GROUP BY board_attendance.board_id
        ), series AS (
         SELECT b.board_id,
            (generate_series((b.first_week)::timestamp with time zone, (b.last_week)::timestamp with time zone, '7 days'::interval))::date AS week_start
           FROM bounds b
        UNION
         SELECT kb.id AS board_id,
            (date_trunc('week'::text, (CURRENT_DATE)::timestamp with time zone))::date AS week_start
           FROM public.kanban_boards kb
        )
 SELECT s.board_id,
    s.week_start,
    COALESCE(m.statuses, '{}'::jsonb) AS statuses
   FROM (series s
     LEFT JOIN public.board_attendance_matrix m ON (((m.board_id = s.board_id) AND (m.week_start = s.week_start))))
  ORDER BY s.board_id, s.week_start DESC;


create or replace view "public"."board_attendance_weeks" as  SELECT board_id,
    week_start,
    min(created_at) AS first_recorded_at
   FROM public.board_attendance
  GROUP BY board_id, week_start
  ORDER BY board_id, week_start DESC;


CREATE OR REPLACE FUNCTION public.cleanup_old_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- A) Anwesenheiten (Team-Board): Alles älter als 52 Wochen löschen
  -- Basierend auf dem 'week_start' Datum
  DELETE FROM public.board_attendance
  WHERE week_start < (current_date - INTERVAL '52 weeks');

  -- B) Eskalations-Historie: Alles älter als 1 Jahr löschen
  DELETE FROM public.board_escalation_history
  WHERE changed_at < (now() - INTERVAL '1 year');

  -- C) (Optional) Archivierte Karten endgültig löschen nach 1 Jahr
  -- Wenn du das möchtest, kannst du diesen Block einkommentieren:
  /*
  DELETE FROM public.kanban_cards
  WHERE (card_data->>'Archived')::text = '1'
    AND (
      (card_data->>'ArchivedDate')::date < (current_date - INTERVAL '1 year')
      OR updated_at < (now() - INTERVAL '1 year')
    );
  */
  
  -- D) Top-Themen bereinigen (älter als 1 Jahr basierend auf letzter Änderung)
  DELETE FROM public.board_top_topics
  WHERE updated_at < (now() - INTERVAL '1 year');

END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_owner_and_admin_in_board_members()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.owner_id is not null then
    insert into public.board_members (board_id, profile_id)
    values (new.id, new.owner_id)
    on conflict do nothing;
  end if;
  if new.board_admin_id is not null and new.board_admin_id <> new.owner_id then
    insert into public.board_members (board_id, profile_id)
    values (new.id, new.board_admin_id)
    on conflict do nothing;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, email, full_name, role, company, is_active)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.email),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'user'),
    nullif(new.raw_user_meta_data->>'company', ''),
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
        -- REMOVED or MODIFIED: Do not overwrite role from metadata on update
        -- role = coalesce(nullif(excluded.role, ''), public.profiles.role), 
        company = coalesce(excluded.company, public.profiles.company),
        is_active = true;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_active_user(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.status = 'active'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  select system_role = 'admin'
  from public.profiles
  where id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.list_all_boards()
 RETURNS SETOF public.kanban_boards
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select *
  from public.kanban_boards
  where visibility = 'public'
  order by coalesce(updated_at, created_at) desc;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$function$
;

grant delete on table "public"."board_attendance" to "anon";

grant insert on table "public"."board_attendance" to "anon";

grant references on table "public"."board_attendance" to "anon";

grant select on table "public"."board_attendance" to "anon";

grant trigger on table "public"."board_attendance" to "anon";

grant truncate on table "public"."board_attendance" to "anon";

grant update on table "public"."board_attendance" to "anon";

grant delete on table "public"."board_attendance" to "authenticated";

grant insert on table "public"."board_attendance" to "authenticated";

grant references on table "public"."board_attendance" to "authenticated";

grant select on table "public"."board_attendance" to "authenticated";

grant trigger on table "public"."board_attendance" to "authenticated";

grant truncate on table "public"."board_attendance" to "authenticated";

grant update on table "public"."board_attendance" to "authenticated";

grant delete on table "public"."board_attendance" to "service_role";

grant insert on table "public"."board_attendance" to "service_role";

grant references on table "public"."board_attendance" to "service_role";

grant select on table "public"."board_attendance" to "service_role";

grant trigger on table "public"."board_attendance" to "service_role";

grant truncate on table "public"."board_attendance" to "service_role";

grant update on table "public"."board_attendance" to "service_role";

grant delete on table "public"."board_escalation_history" to "anon";

grant insert on table "public"."board_escalation_history" to "anon";

grant references on table "public"."board_escalation_history" to "anon";

grant select on table "public"."board_escalation_history" to "anon";

grant trigger on table "public"."board_escalation_history" to "anon";

grant truncate on table "public"."board_escalation_history" to "anon";

grant update on table "public"."board_escalation_history" to "anon";

grant delete on table "public"."board_escalation_history" to "authenticated";

grant insert on table "public"."board_escalation_history" to "authenticated";

grant references on table "public"."board_escalation_history" to "authenticated";

grant select on table "public"."board_escalation_history" to "authenticated";

grant trigger on table "public"."board_escalation_history" to "authenticated";

grant truncate on table "public"."board_escalation_history" to "authenticated";

grant update on table "public"."board_escalation_history" to "authenticated";

grant delete on table "public"."board_escalation_history" to "service_role";

grant insert on table "public"."board_escalation_history" to "service_role";

grant references on table "public"."board_escalation_history" to "service_role";

grant select on table "public"."board_escalation_history" to "service_role";

grant trigger on table "public"."board_escalation_history" to "service_role";

grant truncate on table "public"."board_escalation_history" to "service_role";

grant update on table "public"."board_escalation_history" to "service_role";

grant delete on table "public"."board_escalations" to "anon";

grant insert on table "public"."board_escalations" to "anon";

grant references on table "public"."board_escalations" to "anon";

grant select on table "public"."board_escalations" to "anon";

grant trigger on table "public"."board_escalations" to "anon";

grant truncate on table "public"."board_escalations" to "anon";

grant update on table "public"."board_escalations" to "anon";

grant delete on table "public"."board_escalations" to "authenticated";

grant insert on table "public"."board_escalations" to "authenticated";

grant references on table "public"."board_escalations" to "authenticated";

grant select on table "public"."board_escalations" to "authenticated";

grant trigger on table "public"."board_escalations" to "authenticated";

grant truncate on table "public"."board_escalations" to "authenticated";

grant update on table "public"."board_escalations" to "authenticated";

grant delete on table "public"."board_escalations" to "service_role";

grant insert on table "public"."board_escalations" to "service_role";

grant references on table "public"."board_escalations" to "service_role";

grant select on table "public"."board_escalations" to "service_role";

grant trigger on table "public"."board_escalations" to "service_role";

grant truncate on table "public"."board_escalations" to "service_role";

grant update on table "public"."board_escalations" to "service_role";

grant delete on table "public"."board_favorites" to "anon";

grant insert on table "public"."board_favorites" to "anon";

grant references on table "public"."board_favorites" to "anon";

grant select on table "public"."board_favorites" to "anon";

grant trigger on table "public"."board_favorites" to "anon";

grant truncate on table "public"."board_favorites" to "anon";

grant update on table "public"."board_favorites" to "anon";

grant delete on table "public"."board_favorites" to "authenticated";

grant insert on table "public"."board_favorites" to "authenticated";

grant references on table "public"."board_favorites" to "authenticated";

grant select on table "public"."board_favorites" to "authenticated";

grant trigger on table "public"."board_favorites" to "authenticated";

grant truncate on table "public"."board_favorites" to "authenticated";

grant update on table "public"."board_favorites" to "authenticated";

grant delete on table "public"."board_favorites" to "service_role";

grant insert on table "public"."board_favorites" to "service_role";

grant references on table "public"."board_favorites" to "service_role";

grant select on table "public"."board_favorites" to "service_role";

grant trigger on table "public"."board_favorites" to "service_role";

grant truncate on table "public"."board_favorites" to "service_role";

grant update on table "public"."board_favorites" to "service_role";

grant delete on table "public"."board_members" to "anon";

grant insert on table "public"."board_members" to "anon";

grant references on table "public"."board_members" to "anon";

grant select on table "public"."board_members" to "anon";

grant trigger on table "public"."board_members" to "anon";

grant truncate on table "public"."board_members" to "anon";

grant update on table "public"."board_members" to "anon";

grant delete on table "public"."board_members" to "authenticated";

grant insert on table "public"."board_members" to "authenticated";

grant references on table "public"."board_members" to "authenticated";

grant select on table "public"."board_members" to "authenticated";

grant trigger on table "public"."board_members" to "authenticated";

grant truncate on table "public"."board_members" to "authenticated";

grant update on table "public"."board_members" to "authenticated";

grant delete on table "public"."board_members" to "service_role";

grant insert on table "public"."board_members" to "service_role";

grant references on table "public"."board_members" to "service_role";

grant select on table "public"."board_members" to "service_role";

grant trigger on table "public"."board_members" to "service_role";

grant truncate on table "public"."board_members" to "service_role";

grant update on table "public"."board_members" to "service_role";

grant delete on table "public"."board_top_topics" to "anon";

grant insert on table "public"."board_top_topics" to "anon";

grant references on table "public"."board_top_topics" to "anon";

grant select on table "public"."board_top_topics" to "anon";

grant trigger on table "public"."board_top_topics" to "anon";

grant truncate on table "public"."board_top_topics" to "anon";

grant update on table "public"."board_top_topics" to "anon";

grant delete on table "public"."board_top_topics" to "authenticated";

grant insert on table "public"."board_top_topics" to "authenticated";

grant references on table "public"."board_top_topics" to "authenticated";

grant select on table "public"."board_top_topics" to "authenticated";

grant trigger on table "public"."board_top_topics" to "authenticated";

grant truncate on table "public"."board_top_topics" to "authenticated";

grant update on table "public"."board_top_topics" to "authenticated";

grant delete on table "public"."board_top_topics" to "service_role";

grant insert on table "public"."board_top_topics" to "service_role";

grant references on table "public"."board_top_topics" to "service_role";

grant select on table "public"."board_top_topics" to "service_role";

grant trigger on table "public"."board_top_topics" to "service_role";

grant truncate on table "public"."board_top_topics" to "service_role";

grant update on table "public"."board_top_topics" to "service_role";

grant delete on table "public"."departments" to "anon";

grant insert on table "public"."departments" to "anon";

grant references on table "public"."departments" to "anon";

grant select on table "public"."departments" to "anon";

grant trigger on table "public"."departments" to "anon";

grant truncate on table "public"."departments" to "anon";

grant update on table "public"."departments" to "anon";

grant delete on table "public"."departments" to "authenticated";

grant insert on table "public"."departments" to "authenticated";

grant references on table "public"."departments" to "authenticated";

grant select on table "public"."departments" to "authenticated";

grant trigger on table "public"."departments" to "authenticated";

grant truncate on table "public"."departments" to "authenticated";

grant update on table "public"."departments" to "authenticated";

grant delete on table "public"."departments" to "service_role";

grant insert on table "public"."departments" to "service_role";

grant references on table "public"."departments" to "service_role";

grant select on table "public"."departments" to "service_role";

grant trigger on table "public"."departments" to "service_role";

grant truncate on table "public"."departments" to "service_role";

grant update on table "public"."departments" to "service_role";

grant delete on table "public"."kanban_board_settings" to "anon";

grant insert on table "public"."kanban_board_settings" to "anon";

grant references on table "public"."kanban_board_settings" to "anon";

grant select on table "public"."kanban_board_settings" to "anon";

grant trigger on table "public"."kanban_board_settings" to "anon";

grant truncate on table "public"."kanban_board_settings" to "anon";

grant update on table "public"."kanban_board_settings" to "anon";

grant delete on table "public"."kanban_board_settings" to "authenticated";

grant insert on table "public"."kanban_board_settings" to "authenticated";

grant references on table "public"."kanban_board_settings" to "authenticated";

grant select on table "public"."kanban_board_settings" to "authenticated";

grant trigger on table "public"."kanban_board_settings" to "authenticated";

grant truncate on table "public"."kanban_board_settings" to "authenticated";

grant update on table "public"."kanban_board_settings" to "authenticated";

grant delete on table "public"."kanban_board_settings" to "service_role";

grant insert on table "public"."kanban_board_settings" to "service_role";

grant references on table "public"."kanban_board_settings" to "service_role";

grant select on table "public"."kanban_board_settings" to "service_role";

grant trigger on table "public"."kanban_board_settings" to "service_role";

grant truncate on table "public"."kanban_board_settings" to "service_role";

grant update on table "public"."kanban_board_settings" to "service_role";

grant delete on table "public"."kanban_boards" to "anon";

grant insert on table "public"."kanban_boards" to "anon";

grant references on table "public"."kanban_boards" to "anon";

grant select on table "public"."kanban_boards" to "anon";

grant trigger on table "public"."kanban_boards" to "anon";

grant truncate on table "public"."kanban_boards" to "anon";

grant update on table "public"."kanban_boards" to "anon";

grant delete on table "public"."kanban_boards" to "authenticated";

grant insert on table "public"."kanban_boards" to "authenticated";

grant references on table "public"."kanban_boards" to "authenticated";

grant select on table "public"."kanban_boards" to "authenticated";

grant trigger on table "public"."kanban_boards" to "authenticated";

grant truncate on table "public"."kanban_boards" to "authenticated";

grant update on table "public"."kanban_boards" to "authenticated";

grant delete on table "public"."kanban_boards" to "service_role";

grant insert on table "public"."kanban_boards" to "service_role";

grant references on table "public"."kanban_boards" to "service_role";

grant select on table "public"."kanban_boards" to "service_role";

grant trigger on table "public"."kanban_boards" to "service_role";

grant truncate on table "public"."kanban_boards" to "service_role";

grant update on table "public"."kanban_boards" to "service_role";

grant delete on table "public"."kanban_cards" to "anon";

grant insert on table "public"."kanban_cards" to "anon";

grant references on table "public"."kanban_cards" to "anon";

grant select on table "public"."kanban_cards" to "anon";

grant trigger on table "public"."kanban_cards" to "anon";

grant truncate on table "public"."kanban_cards" to "anon";

grant update on table "public"."kanban_cards" to "anon";

grant delete on table "public"."kanban_cards" to "authenticated";

grant insert on table "public"."kanban_cards" to "authenticated";

grant references on table "public"."kanban_cards" to "authenticated";

grant select on table "public"."kanban_cards" to "authenticated";

grant trigger on table "public"."kanban_cards" to "authenticated";

grant truncate on table "public"."kanban_cards" to "authenticated";

grant update on table "public"."kanban_cards" to "authenticated";

grant delete on table "public"."kanban_cards" to "service_role";

grant insert on table "public"."kanban_cards" to "service_role";

grant references on table "public"."kanban_cards" to "service_role";

grant select on table "public"."kanban_cards" to "service_role";

grant trigger on table "public"."kanban_cards" to "service_role";

grant truncate on table "public"."kanban_cards" to "service_role";

grant update on table "public"."kanban_cards" to "service_role";

grant delete on table "public"."personal_notes" to "anon";

grant insert on table "public"."personal_notes" to "anon";

grant references on table "public"."personal_notes" to "anon";

grant select on table "public"."personal_notes" to "anon";

grant trigger on table "public"."personal_notes" to "anon";

grant truncate on table "public"."personal_notes" to "anon";

grant update on table "public"."personal_notes" to "anon";

grant delete on table "public"."personal_notes" to "authenticated";

grant insert on table "public"."personal_notes" to "authenticated";

grant references on table "public"."personal_notes" to "authenticated";

grant select on table "public"."personal_notes" to "authenticated";

grant trigger on table "public"."personal_notes" to "authenticated";

grant truncate on table "public"."personal_notes" to "authenticated";

grant update on table "public"."personal_notes" to "authenticated";

grant delete on table "public"."personal_notes" to "service_role";

grant insert on table "public"."personal_notes" to "service_role";

grant references on table "public"."personal_notes" to "service_role";

grant select on table "public"."personal_notes" to "service_role";

grant trigger on table "public"."personal_notes" to "service_role";

grant truncate on table "public"."personal_notes" to "service_role";

grant update on table "public"."personal_notes" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."system_settings" to "anon";

grant insert on table "public"."system_settings" to "anon";

grant references on table "public"."system_settings" to "anon";

grant select on table "public"."system_settings" to "anon";

grant trigger on table "public"."system_settings" to "anon";

grant truncate on table "public"."system_settings" to "anon";

grant update on table "public"."system_settings" to "anon";

grant delete on table "public"."system_settings" to "authenticated";

grant insert on table "public"."system_settings" to "authenticated";

grant references on table "public"."system_settings" to "authenticated";

grant select on table "public"."system_settings" to "authenticated";

grant trigger on table "public"."system_settings" to "authenticated";

grant truncate on table "public"."system_settings" to "authenticated";

grant update on table "public"."system_settings" to "authenticated";

grant delete on table "public"."system_settings" to "service_role";

grant insert on table "public"."system_settings" to "service_role";

grant references on table "public"."system_settings" to "service_role";

grant select on table "public"."system_settings" to "service_role";

grant trigger on table "public"."system_settings" to "service_role";

grant truncate on table "public"."system_settings" to "service_role";

grant update on table "public"."system_settings" to "service_role";


  create policy "rbac_manage_attendance"
  on "public"."board_attendance"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = board_attendance.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = board_attendance.board_id) AND (bm.profile_id = auth.uid()))))))
with check (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = board_attendance.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = board_attendance.board_id) AND (bm.profile_id = auth.uid()))))));



  create policy "rbac_read_attendance"
  on "public"."board_attendance"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Authenticated users can read escalation history"
  on "public"."board_escalation_history"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Authenticated users can write escalation history"
  on "public"."board_escalation_history"
  as permissive
  for insert
  to public
with check ((auth.role() = 'authenticated'::text));



  create policy "rbac_delete_escalation_history"
  on "public"."board_escalation_history"
  as permissive
  for delete
  to public
using (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = board_escalation_history.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = board_escalation_history.board_id) AND (bm.profile_id = auth.uid()))))));



  create policy "rbac_read_escalation_history"
  on "public"."board_escalation_history"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "rbac_update_escalation_history"
  on "public"."board_escalation_history"
  as permissive
  for update
  to public
using (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = board_escalation_history.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = board_escalation_history.board_id) AND (bm.profile_id = auth.uid()))))))
with check (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = board_escalation_history.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = board_escalation_history.board_id) AND (bm.profile_id = auth.uid()))))));



  create policy "rbac_write_escalation_history"
  on "public"."board_escalation_history"
  as permissive
  for insert
  to public
with check (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = board_escalation_history.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = board_escalation_history.board_id) AND (bm.profile_id = auth.uid()))))));



  create policy "Authenticated users manage escalations"
  on "public"."board_escalations"
  as permissive
  for all
  to public
using ((auth.role() = 'authenticated'::text))
with check ((auth.role() = 'authenticated'::text));



  create policy "rbac_manage_escalations"
  on "public"."board_escalations"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = board_escalations.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = board_escalations.board_id) AND (bm.profile_id = auth.uid()))))))
with check (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = board_escalations.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = board_escalations.board_id) AND (bm.profile_id = auth.uid()))))));



  create policy "rbac_read_escalations"
  on "public"."board_escalations"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Users can add their own favorites"
  on "public"."board_favorites"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can remove their own favorites"
  on "public"."board_favorites"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can view their own favorites"
  on "public"."board_favorites"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "rbac_manage_board_members"
  on "public"."board_members"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = board_members.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid())))))))
with check (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = board_members.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid())))))));



  create policy "rbac_read_board_members"
  on "public"."board_members"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "rbac_manage_top_topics"
  on "public"."board_top_topics"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = board_top_topics.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = board_top_topics.board_id) AND (bm.profile_id = auth.uid()))))))
with check (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = board_top_topics.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = board_top_topics.board_id) AND (bm.profile_id = auth.uid()))))));



  create policy "rbac_read_top_topics"
  on "public"."board_top_topics"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "rbac_read_departments"
  on "public"."departments"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Admins manage settings"
  on "public"."kanban_board_settings"
  as permissive
  for all
  to public
using (((auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.role = 'admin'::text))) OR ((auth.jwt() ->> 'email'::text) = 'michael@mysight.net'::text)));



  create policy "Board owners manage board settings"
  on "public"."kanban_board_settings"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards
  WHERE ((kanban_boards.id = kanban_board_settings.board_id) AND ((kanban_boards.owner_id = auth.uid()) OR (kanban_boards.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members
  WHERE ((board_members.board_id = board_members.board_id) AND (board_members.profile_id = auth.uid()) AND (board_members.role = 'admin'::text))))));



  create policy "rbac_manage_board_settings"
  on "public"."kanban_board_settings"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = kanban_board_settings.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = kanban_board_settings.board_id) AND (bm.profile_id = auth.uid()))))))
with check (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = kanban_board_settings.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = kanban_board_settings.board_id) AND (bm.profile_id = auth.uid()))))));



  create policy "rbac_manage_boards"
  on "public"."kanban_boards"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (auth.uid() = owner_id) OR (auth.uid() = board_admin_id)))
with check (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (auth.uid() = owner_id) OR (auth.uid() = board_admin_id)));



  create policy "rbac_read_boards"
  on "public"."kanban_boards"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Admins manage cards"
  on "public"."kanban_cards"
  as permissive
  for all
  to public
using (((auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.role = 'admin'::text))) OR ((auth.jwt() ->> 'email'::text) = 'michael@mysight.net'::text)));



  create policy "Authenticated users can read board cards"
  on "public"."kanban_cards"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Board members can modify cards"
  on "public"."kanban_cards"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards
  WHERE ((kanban_boards.id = kanban_cards.board_id) AND ((kanban_boards.owner_id = auth.uid()) OR (kanban_boards.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members
  WHERE ((board_members.board_id = board_members.board_id) AND (board_members.profile_id = auth.uid()))))));



  create policy "Members can delete cards on their boards"
  on "public"."kanban_cards"
  as permissive
  for delete
  to public
using (((EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = kanban_cards.board_id) AND (bm.profile_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = kanban_cards.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid())))))));



  create policy "Members can insert cards on their boards"
  on "public"."kanban_cards"
  as permissive
  for insert
  to public
with check (((EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = kanban_cards.board_id) AND (bm.profile_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = kanban_cards.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid())))))));



  create policy "Members can read cards on their boards"
  on "public"."kanban_cards"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = kanban_cards.board_id) AND (bm.profile_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = kanban_cards.board_id) AND (b.visibility = 'public'::text)))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = kanban_cards.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid())))))));



  create policy "Members can update cards on their boards"
  on "public"."kanban_cards"
  as permissive
  for update
  to public
using (((EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = kanban_cards.board_id) AND (bm.profile_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = kanban_cards.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid())))))))
with check (((EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = kanban_cards.board_id) AND (bm.profile_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = kanban_cards.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid())))))));



  create policy "rbac_manage_cards"
  on "public"."kanban_cards"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = kanban_cards.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = kanban_cards.board_id) AND (bm.profile_id = auth.uid()))))))
with check (((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(p.role) = ANY (ARRAY['admin'::text, 'owner'::text, 'manager'::text, 'superuser'::text]))))) OR (EXISTS ( SELECT 1
   FROM public.kanban_boards b
  WHERE ((b.id = kanban_cards.board_id) AND ((b.owner_id = auth.uid()) OR (b.board_admin_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM public.board_members bm
  WHERE ((bm.board_id = kanban_cards.board_id) AND (bm.profile_id = auth.uid()))))));



  create policy "rbac_read_cards"
  on "public"."kanban_cards"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Users can manage their own notes"
  on "public"."personal_notes"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "rbac_read_profiles"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "rbac_update_own_profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id))
with check ((auth.uid() = id));



  create policy "Auth User Insert"
  on "public"."system_settings"
  as permissive
  for insert
  to public
with check ((auth.role() = 'authenticated'::text));



  create policy "Auth User Update"
  on "public"."system_settings"
  as permissive
  for update
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Public Read Settings"
  on "public"."system_settings"
  as permissive
  for select
  to public
using (true);


CREATE TRIGGER set_board_attendance_updated_at BEFORE UPDATE ON public.board_attendance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_board_escalations_updated_at BEFORE UPDATE ON public.board_escalations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_board_top_topics_updated_at BEFORE UPDATE ON public.board_top_topics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_board_settings_updated_at BEFORE UPDATE ON public.kanban_board_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER ensure_owner_and_admin_in_board_members AFTER INSERT ON public.kanban_boards FOR EACH ROW EXECUTE FUNCTION public.ensure_owner_and_admin_in_board_members();

CREATE TRIGGER set_kanban_boards_updated_at BEFORE UPDATE ON public.kanban_boards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_cards_updated_at BEFORE UPDATE ON public.kanban_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sync_profile_from_auth AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


  create policy "Auth Update"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'branding'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Auth Upload"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'branding'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Jeder darf Logos sehen"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'branding'::text));




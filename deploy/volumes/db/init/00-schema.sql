


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."cleanup_old_data"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."cleanup_old_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_owner_and_admin_in_board_members"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."ensure_owner_and_admin_in_board_members"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_active_user"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_active_user"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select system_role = 'admin'
  from public.profiles
  where id = auth.uid();
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."kanban_boards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "settings" "jsonb" DEFAULT '{"boardType": "standard"}'::"jsonb" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "owner_id" "uuid",
    "user_id" "uuid",
    "board_admin_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "kanban_boards_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."kanban_boards" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_all_boards"() RETURNS SETOF "public"."kanban_boards"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select *
  from public.kanban_boards
  where visibility = 'public'
  order by coalesce(updated_at, created_at) desc;
$$;


ALTER FUNCTION "public"."list_all_boards"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "week_start" "date" NOT NULL,
    "status" "text" DEFAULT 'present'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "board_attendance_status_check" CHECK (("status" = ANY (ARRAY['present'::"text", 'absent'::"text"])))
);


ALTER TABLE "public"."board_attendance" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."board_attendance_matrix" AS
 SELECT "board_id",
    "week_start",
    "jsonb_object_agg"(("profile_id")::"text", "jsonb_build_object"('status', "status")) AS "statuses"
   FROM "public"."board_attendance" "ba"
  GROUP BY "board_id", "week_start"
  ORDER BY "board_id", "week_start" DESC;


ALTER VIEW "public"."board_attendance_matrix" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."board_attendance_week_series" AS
 WITH "bounds" AS (
         SELECT "board_attendance"."board_id",
            "min"("board_attendance"."week_start") AS "first_week",
            GREATEST("max"("board_attendance"."week_start"), ("date_trunc"('week'::"text", (CURRENT_DATE)::timestamp with time zone))::"date") AS "last_week"
           FROM "public"."board_attendance"
          GROUP BY "board_attendance"."board_id"
        ), "series" AS (
         SELECT "b"."board_id",
            ("generate_series"(("b"."first_week")::timestamp with time zone, ("b"."last_week")::timestamp with time zone, '7 days'::interval))::"date" AS "week_start"
           FROM "bounds" "b"
        UNION
         SELECT "kb"."id" AS "board_id",
            ("date_trunc"('week'::"text", (CURRENT_DATE)::timestamp with time zone))::"date" AS "week_start"
           FROM "public"."kanban_boards" "kb"
        )
 SELECT "s"."board_id",
    "s"."week_start",
    COALESCE("m"."statuses", '{}'::"jsonb") AS "statuses"
   FROM ("series" "s"
     LEFT JOIN "public"."board_attendance_matrix" "m" ON ((("m"."board_id" = "s"."board_id") AND ("m"."week_start" = "s"."week_start"))))
  ORDER BY "s"."board_id", "s"."week_start" DESC;


ALTER VIEW "public"."board_attendance_week_series" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."board_attendance_weeks" AS
 SELECT "board_id",
    "week_start",
    "min"("created_at") AS "first_recorded_at"
   FROM "public"."board_attendance"
  GROUP BY "board_id", "week_start"
  ORDER BY "board_id", "week_start" DESC;


ALTER VIEW "public"."board_attendance_weeks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_escalation_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "card_id" "text" NOT NULL,
    "escalation_id" "uuid",
    "changed_by" "uuid",
    "changes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."board_escalation_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_escalations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "card_id" "text" NOT NULL,
    "category" "text" NOT NULL,
    "project_code" "text",
    "project_name" "text",
    "reason" "text",
    "measure" "text",
    "department_id" "uuid",
    "responsible_id" "uuid",
    "target_date" "date",
    "completion_steps" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "board_escalations_category_check" CHECK (("category" = ANY (ARRAY['LK'::"text", 'SK'::"text", 'Y'::"text", 'R'::"text"]))),
    CONSTRAINT "board_escalations_completion_steps_check" CHECK ((("completion_steps" >= 0) AND ("completion_steps" <= 4)))
);


ALTER TABLE "public"."board_escalations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_favorites" (
    "user_id" "uuid" NOT NULL,
    "board_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."board_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    CONSTRAINT "board_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."board_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_top_topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "calendar_week" "text",
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "due_date" "date"
);


ALTER TABLE "public"."board_top_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kanban_board_settings" (
    "board_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."kanban_board_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kanban_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "card_id" "text" NOT NULL,
    "card_data" "jsonb" NOT NULL,
    "stage" "text",
    "position" integer,
    "project_number" "text",
    "project_name" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."kanban_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."personal_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "due_date" "date",
    "is_done" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "calendar_week" "text"
);


ALTER TABLE "public"."personal_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "bio" "text",
    "company" "text",
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."board_attendance"
    ADD CONSTRAINT "board_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."board_attendance"
    ADD CONSTRAINT "board_attendance_unique" UNIQUE ("board_id", "profile_id", "week_start");



ALTER TABLE ONLY "public"."board_escalation_history"
    ADD CONSTRAINT "board_escalation_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."board_escalations"
    ADD CONSTRAINT "board_escalations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."board_favorites"
    ADD CONSTRAINT "board_favorites_pkey" PRIMARY KEY ("user_id", "board_id");



ALTER TABLE ONLY "public"."board_members"
    ADD CONSTRAINT "board_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."board_top_topics"
    ADD CONSTRAINT "board_top_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kanban_board_settings"
    ADD CONSTRAINT "kanban_board_settings_pkey" PRIMARY KEY ("board_id");



ALTER TABLE ONLY "public"."kanban_boards"
    ADD CONSTRAINT "kanban_boards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kanban_cards"
    ADD CONSTRAINT "kanban_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."personal_notes"
    ADD CONSTRAINT "personal_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key");



CREATE INDEX "board_escalation_history_board_card_idx" ON "public"."board_escalation_history" USING "btree" ("board_id", "card_id", "changed_at" DESC);



CREATE INDEX "board_escalation_history_escalation_idx" ON "public"."board_escalation_history" USING "btree" ("escalation_id", "changed_at" DESC);



CREATE UNIQUE INDEX "board_escalations_board_card_id_idx" ON "public"."board_escalations" USING "btree" ("board_id", "card_id");



CREATE INDEX "board_escalations_board_category_idx" ON "public"."board_escalations" USING "btree" ("board_id", "category");



CREATE UNIQUE INDEX "board_members_unique" ON "public"."board_members" USING "btree" ("board_id", "profile_id");



CREATE INDEX "board_top_topics_board_position_idx" ON "public"."board_top_topics" USING "btree" ("board_id", "position");



CREATE INDEX "kanban_boards_admin_idx" ON "public"."kanban_boards" USING "btree" ("board_admin_id");



CREATE INDEX "kanban_boards_owner_idx" ON "public"."kanban_boards" USING "btree" ("owner_id");



CREATE INDEX "kanban_boards_visibility_idx" ON "public"."kanban_boards" USING "btree" ("visibility");



CREATE UNIQUE INDEX "kanban_cards_board_card_id_idx" ON "public"."kanban_cards" USING "btree" ("board_id", "card_id");



CREATE INDEX "kanban_cards_stage_idx" ON "public"."kanban_cards" USING "btree" ("board_id", "stage", "position");



CREATE OR REPLACE TRIGGER "ensure_owner_and_admin_in_board_members" AFTER INSERT ON "public"."kanban_boards" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_owner_and_admin_in_board_members"();



CREATE OR REPLACE TRIGGER "set_board_attendance_updated_at" BEFORE UPDATE ON "public"."board_attendance" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_board_escalations_updated_at" BEFORE UPDATE ON "public"."board_escalations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_board_settings_updated_at" BEFORE UPDATE ON "public"."kanban_board_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_board_top_topics_updated_at" BEFORE UPDATE ON "public"."board_top_topics" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_cards_updated_at" BEFORE UPDATE ON "public"."kanban_cards" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_departments_updated_at" BEFORE UPDATE ON "public"."departments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_kanban_boards_updated_at" BEFORE UPDATE ON "public"."kanban_boards" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."board_attendance"
    ADD CONSTRAINT "board_attendance_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_attendance"
    ADD CONSTRAINT "board_attendance_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_escalation_history"
    ADD CONSTRAINT "board_escalation_history_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_escalation_history"
    ADD CONSTRAINT "board_escalation_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."board_escalation_history"
    ADD CONSTRAINT "board_escalation_history_escalation_id_fkey" FOREIGN KEY ("escalation_id") REFERENCES "public"."board_escalations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_escalations"
    ADD CONSTRAINT "board_escalations_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_escalations"
    ADD CONSTRAINT "board_escalations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."board_escalations"
    ADD CONSTRAINT "board_escalations_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."board_favorites"
    ADD CONSTRAINT "board_favorites_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_favorites"
    ADD CONSTRAINT "board_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_members"
    ADD CONSTRAINT "board_members_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_members"
    ADD CONSTRAINT "board_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_top_topics"
    ADD CONSTRAINT "board_top_topics_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kanban_board_settings"
    ADD CONSTRAINT "kanban_board_settings_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kanban_board_settings"
    ADD CONSTRAINT "kanban_board_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kanban_boards"
    ADD CONSTRAINT "kanban_boards_board_admin_id_fkey" FOREIGN KEY ("board_admin_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kanban_boards"
    ADD CONSTRAINT "kanban_boards_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kanban_boards"
    ADD CONSTRAINT "kanban_boards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kanban_cards"
    ADD CONSTRAINT "kanban_cards_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."personal_notes"
    ADD CONSTRAINT "personal_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins manage cards" ON "public"."kanban_cards" USING ((("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))) OR (("auth"."jwt"() ->> 'email'::"text") = 'michael@mysight.net'::"text")));



CREATE POLICY "Admins manage settings" ON "public"."kanban_board_settings" USING ((("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."role" = 'admin'::"text"))) OR (("auth"."jwt"() ->> 'email'::"text") = 'michael@mysight.net'::"text")));



CREATE POLICY "Allow anon to update license_key" ON "public"."system_settings" USING (("key" = 'license_key'::"text")) WITH CHECK (("key" = 'license_key'::"text"));



CREATE POLICY "Allow read access to system_settings" ON "public"."system_settings" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can read board cards" ON "public"."kanban_cards" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can read escalation history" ON "public"."board_escalation_history" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can write escalation history" ON "public"."board_escalation_history" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users manage escalations" ON "public"."board_escalations" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Board members can modify cards" ON "public"."kanban_cards" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards"
  WHERE (("kanban_boards"."id" = "kanban_cards"."board_id") AND (("kanban_boards"."owner_id" = "auth"."uid"()) OR ("kanban_boards"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members"
  WHERE (("board_members"."board_id" = "board_members"."board_id") AND ("board_members"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "Board owners manage board settings" ON "public"."kanban_board_settings" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards"
  WHERE (("kanban_boards"."id" = "kanban_board_settings"."board_id") AND (("kanban_boards"."owner_id" = "auth"."uid"()) OR ("kanban_boards"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members"
  WHERE (("board_members"."board_id" = "board_members"."board_id") AND ("board_members"."profile_id" = "auth"."uid"()) AND ("board_members"."role" = 'admin'::"text"))))));



CREATE POLICY "Enable insert for authenticated users" ON "public"."system_settings" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."system_settings" FOR SELECT USING (true);



CREATE POLICY "Enable update for authenticated users" ON "public"."system_settings" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Members can delete cards on their boards" ON "public"."kanban_cards" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "kanban_cards"."board_id") AND ("bm"."profile_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "kanban_cards"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"())))))));



CREATE POLICY "Members can insert cards on their boards" ON "public"."kanban_cards" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "kanban_cards"."board_id") AND ("bm"."profile_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "kanban_cards"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"())))))));



CREATE POLICY "Members can read cards on their boards" ON "public"."kanban_cards" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "kanban_cards"."board_id") AND ("bm"."profile_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "kanban_cards"."board_id") AND ("b"."visibility" = 'public'::"text")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "kanban_cards"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"())))))));



CREATE POLICY "Members can update cards on their boards" ON "public"."kanban_cards" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "kanban_cards"."board_id") AND ("bm"."profile_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "kanban_cards"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "kanban_cards"."board_id") AND ("bm"."profile_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "kanban_cards"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"())))))));



CREATE POLICY "Users can add their own favorites" ON "public"."board_favorites" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own notes" ON "public"."personal_notes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can remove their own favorites" ON "public"."board_favorites" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own favorites" ON "public"."board_favorites" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."board_attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."board_escalation_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."board_escalations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."board_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."board_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."board_top_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kanban_board_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kanban_boards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kanban_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."personal_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rbac_delete_escalation_history" ON "public"."board_escalation_history" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "board_escalation_history"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "board_escalation_history"."board_id") AND ("bm"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "rbac_manage_attendance" ON "public"."board_attendance" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "board_attendance"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "board_attendance"."board_id") AND ("bm"."profile_id" = "auth"."uid"())))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "board_attendance"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "board_attendance"."board_id") AND ("bm"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "rbac_manage_board_members" ON "public"."board_members" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "board_members"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "board_members"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"())))))));



CREATE POLICY "rbac_manage_board_settings" ON "public"."kanban_board_settings" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "kanban_board_settings"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "kanban_board_settings"."board_id") AND ("bm"."profile_id" = "auth"."uid"())))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "kanban_board_settings"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "kanban_board_settings"."board_id") AND ("bm"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "rbac_manage_boards" ON "public"."kanban_boards" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR ("auth"."uid"() = "owner_id") OR ("auth"."uid"() = "board_admin_id"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR ("auth"."uid"() = "owner_id") OR ("auth"."uid"() = "board_admin_id")));



CREATE POLICY "rbac_manage_cards" ON "public"."kanban_cards" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "kanban_cards"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "kanban_cards"."board_id") AND ("bm"."profile_id" = "auth"."uid"())))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "kanban_cards"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "kanban_cards"."board_id") AND ("bm"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "rbac_manage_escalations" ON "public"."board_escalations" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "board_escalations"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "board_escalations"."board_id") AND ("bm"."profile_id" = "auth"."uid"())))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "board_escalations"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "board_escalations"."board_id") AND ("bm"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "rbac_manage_top_topics" ON "public"."board_top_topics" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "board_top_topics"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "board_top_topics"."board_id") AND ("bm"."profile_id" = "auth"."uid"())))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "board_top_topics"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "board_top_topics"."board_id") AND ("bm"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "rbac_read_attendance" ON "public"."board_attendance" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "rbac_read_board_members" ON "public"."board_members" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "rbac_read_boards" ON "public"."kanban_boards" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "rbac_read_cards" ON "public"."kanban_cards" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "rbac_read_departments" ON "public"."departments" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "rbac_read_escalation_history" ON "public"."board_escalation_history" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "rbac_read_escalations" ON "public"."board_escalations" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "rbac_read_profiles" ON "public"."profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "rbac_read_top_topics" ON "public"."board_top_topics" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "rbac_update_escalation_history" ON "public"."board_escalation_history" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "board_escalation_history"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "board_escalation_history"."board_id") AND ("bm"."profile_id" = "auth"."uid"())))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "board_escalation_history"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "board_escalation_history"."board_id") AND ("bm"."profile_id" = "auth"."uid"()))))));



CREATE POLICY "rbac_update_own_profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "rbac_write_escalation_history" ON "public"."board_escalation_history" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("lower"("p"."role") = ANY (ARRAY['admin'::"text", 'owner'::"text", 'manager'::"text", 'superuser'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kanban_boards" "b"
  WHERE (("b"."id" = "board_escalation_history"."board_id") AND (("b"."owner_id" = "auth"."uid"()) OR ("b"."board_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."board_members" "bm"
  WHERE (("bm"."board_id" = "board_escalation_history"."board_id") AND ("bm"."profile_id" = "auth"."uid"()))))));



ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."cleanup_old_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_owner_and_admin_in_board_members"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_owner_and_admin_in_board_members"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_owner_and_admin_in_board_members"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_active_user"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_active_user"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_active_user"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON TABLE "public"."kanban_boards" TO "anon";
GRANT ALL ON TABLE "public"."kanban_boards" TO "authenticated";
GRANT ALL ON TABLE "public"."kanban_boards" TO "service_role";



GRANT ALL ON FUNCTION "public"."list_all_boards"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_all_boards"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_all_boards"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."board_attendance" TO "anon";
GRANT ALL ON TABLE "public"."board_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."board_attendance" TO "service_role";



GRANT ALL ON TABLE "public"."board_attendance_matrix" TO "anon";
GRANT ALL ON TABLE "public"."board_attendance_matrix" TO "authenticated";
GRANT ALL ON TABLE "public"."board_attendance_matrix" TO "service_role";



GRANT ALL ON TABLE "public"."board_attendance_week_series" TO "anon";
GRANT ALL ON TABLE "public"."board_attendance_week_series" TO "authenticated";
GRANT ALL ON TABLE "public"."board_attendance_week_series" TO "service_role";



GRANT ALL ON TABLE "public"."board_attendance_weeks" TO "anon";
GRANT ALL ON TABLE "public"."board_attendance_weeks" TO "authenticated";
GRANT ALL ON TABLE "public"."board_attendance_weeks" TO "service_role";



GRANT ALL ON TABLE "public"."board_escalation_history" TO "anon";
GRANT ALL ON TABLE "public"."board_escalation_history" TO "authenticated";
GRANT ALL ON TABLE "public"."board_escalation_history" TO "service_role";



GRANT ALL ON TABLE "public"."board_escalations" TO "anon";
GRANT ALL ON TABLE "public"."board_escalations" TO "authenticated";
GRANT ALL ON TABLE "public"."board_escalations" TO "service_role";



GRANT ALL ON TABLE "public"."board_favorites" TO "anon";
GRANT ALL ON TABLE "public"."board_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."board_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."board_members" TO "anon";
GRANT ALL ON TABLE "public"."board_members" TO "authenticated";
GRANT ALL ON TABLE "public"."board_members" TO "service_role";



GRANT ALL ON TABLE "public"."board_top_topics" TO "anon";
GRANT ALL ON TABLE "public"."board_top_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."board_top_topics" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."kanban_board_settings" TO "anon";
GRANT ALL ON TABLE "public"."kanban_board_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."kanban_board_settings" TO "service_role";



GRANT ALL ON TABLE "public"."kanban_cards" TO "anon";
GRANT ALL ON TABLE "public"."kanban_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."kanban_cards" TO "service_role";



GRANT ALL ON TABLE "public"."personal_notes" TO "anon";
GRANT ALL ON TABLE "public"."personal_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."personal_notes" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































-- RLS for system_settings (License Check)
ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to system_settings" 
ON "public"."system_settings" 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated update to system_settings"
ON "public"."system_settings"
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert system_settings"
ON "public"."system_settings"
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow anon to insert/update LICENSE KEY ONLY (for initial setup)
CREATE POLICY "Allow anon to insert license"
ON "public"."system_settings"
FOR INSERT
TO anon
WITH CHECK (key = 'license_key');

CREATE POLICY "Allow anon to update license"
ON "public"."system_settings"
FOR UPDATE
TO anon
USING (key = 'license_key')
WITH CHECK (key = 'license_key');

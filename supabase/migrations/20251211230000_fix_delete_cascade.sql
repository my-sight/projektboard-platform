-- Fix user deletion by adding ON DELETE CASCADE to personal_notes foreign key

ALTER TABLE "public"."personal_notes" DROP CONSTRAINT IF EXISTS "personal_notes_user_id_fkey";

ALTER TABLE "public"."personal_notes" 
    ADD CONSTRAINT "personal_notes_user_id_fkey" 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

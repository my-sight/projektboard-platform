-- Enable pg_cron extension if it's not already enabled
create extension if not exists pg_cron with schema extensions;

-- Schedule the cleanup function to run every day at 03:00 AM
-- The function 'cleanup_old_data' was defined in a previous migration (20251211142522_remote_schema.sql)
select cron.schedule(
  'cleanup-old-data-daily', -- name of the job
  '0 3 * * *',              -- cron schedule (03:00 every day)
  'select public.cleanup_old_data()'
);

-- Note: To un-schedule, you would run: select cron.unschedule('cleanup-old-data-daily');

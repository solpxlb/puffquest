-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule update-global-stats to run every 15 minutes
SELECT cron.schedule(
  'update-global-stats-every-15min',
  '*/15 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://xgisixdxffyvwsfsnjsu.supabase.co/functions/v1/update-global-stats',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnaXNpeGR4ZmZ5dndzZnNuanN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MTg0NTgsImV4cCI6MjA3NTM5NDQ1OH0.Asxw-PCtM7hQQpjhPbzPYiXue_EEwq4GPYyo9LZySR0"}'::jsonb,
      body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Schedule calculate-passive-income to run every 1 hour
SELECT cron.schedule(
  'calculate-passive-income-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://xgisixdxffyvwsfsnjsu.supabase.co/functions/v1/calculate-passive-income',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnaXNpeGR4ZmZ5dndzZnNuanN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MTg0NTgsImV4cCI6MjA3NTM5NDQ1OH0.Asxw-PCtM7hQQpjhPbzPYiXue_EEwq4GPYyo9LZySR0"}'::jsonb,
      body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);
-- Rate limit compartilhado entre todas as instancias da aplicacao.
begin;

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  rate_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
  p_rate_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_row public.api_rate_limits%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_rate_key IS NULL OR btrim(p_rate_key) = '' OR p_limit <= 0 OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'Parametros de rate limit invalidos';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_rate_key));

  SELECT * INTO current_row
    FROM public.api_rate_limits
   WHERE rate_key = p_rate_key
   FOR UPDATE;

  IF NOT FOUND OR current_row.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN
    INSERT INTO public.api_rate_limits(rate_key, window_started_at, request_count, updated_at)
    VALUES (p_rate_key, v_now, 1, v_now)
    ON CONFLICT (rate_key) DO UPDATE
      SET window_started_at = EXCLUDED.window_started_at,
          request_count = 1,
          updated_at = EXCLUDED.updated_at;
    RETURN true;
  END IF;

  IF current_row.request_count >= p_limit THEN
    RETURN false;
  END IF;

  UPDATE public.api_rate_limits
     SET request_count = request_count + 1,
         updated_at = v_now
   WHERE rate_key = p_rate_key;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(text, integer, integer) TO service_role;

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_updated_at
  ON public.api_rate_limits(updated_at);

commit;

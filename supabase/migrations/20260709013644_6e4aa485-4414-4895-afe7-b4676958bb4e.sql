CREATE TABLE public.anomaly_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anomaly_key TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  description TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  hypotheses JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_action TEXT,
  emirate_code TEXT,
  emirate_name TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_slug TEXT,
  source TEXT NOT NULL DEFAULT 'live_view_rule_based',
  confidence_score NUMERIC,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dismissed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX anomaly_events_status_idx ON public.anomaly_events (status);
CREATE INDEX anomaly_events_severity_idx ON public.anomaly_events (severity);
CREATE INDEX anomaly_events_emirate_idx ON public.anomaly_events (emirate_code);
CREATE INDEX anomaly_events_created_at_idx ON public.anomaly_events (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anomaly_events TO authenticated;
GRANT ALL ON public.anomaly_events TO service_role;

ALTER TABLE public.anomaly_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage anomaly events"
  ON public.anomaly_events
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER anomaly_events_touch_updated_at
  BEFORE UPDATE ON public.anomaly_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
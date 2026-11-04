-- Annual completion is separate from asset valuations so declining also finishes the year.
CREATE TABLE IF NOT EXISTS public.annual_asset_reviews (
  user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  review_year integer NOT NULL CHECK (review_year >= 2027),
  completed_at timestamptz NOT NULL DEFAULT now(),
  adjustment_percent numeric NOT NULL CHECK (adjustment_percent BETWEEN -10 AND 20),
  kept_unchanged boolean NOT NULL,
  asset_count integer NOT NULL CHECK (asset_count >= 0),
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (user_id, review_year)
);

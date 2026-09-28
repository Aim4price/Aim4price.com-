-- Requires the existing guest_businesses table. Usage survives link revocation/deletion.
CREATE TABLE IF NOT EXISTS guest_enquiry_usage (
 email text NOT NULL REFERENCES guest_businesses(email) ON DELETE CASCADE,
 token text NOT NULL,
 opened_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(email,token)
);

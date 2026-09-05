CREATE TABLE public.legal_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('terms', 'privacy', 'disclaimer')),
  document_version TEXT NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, consent_type, document_version)
);
GRANT SELECT, INSERT ON public.legal_consents TO authenticated;
GRANT ALL ON public.legal_consents TO service_role;
ALTER TABLE public.legal_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own consents" ON public.legal_consents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can record their own consents" ON public.legal_consents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
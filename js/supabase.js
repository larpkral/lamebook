import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Replace these with your Supabase project URL and anon key
// Found at: https://supabase.com/dashboard/project/<your-project>/settings/api
const SUPABASE_URL = 'https://dpqypilvrhybfmfckyye.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwcXlwaWx2cmh5YmZtZmNreXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDU0MDksImV4cCI6MjA5NDUyMTQwOX0.pwasP3N5sPHeVQXBcFR-Glz68kw8jtzATzYstTXj61Q';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

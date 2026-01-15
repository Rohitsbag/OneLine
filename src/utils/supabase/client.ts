import { createClient } from '@supabase/supabase-js';

// Vite uses import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        flowType: 'pkce', // Implicit flow is deprecated/flaky on mobile
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // REQUIRED for PKCE and Email Confirmation links
    }
});

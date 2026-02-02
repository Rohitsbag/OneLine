import { createClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';

// Custom storage adapter for Capacitor
// This ensures the session is stored in native Android/iOS storage instead of flaky WebView localStorage
const CapacitorStorage = {
    getItem: async (key: string) => {
        const { value } = await Preferences.get({ key });
        return value;
    },
    setItem: async (key: string, value: string) => {
        await Preferences.set({ key, value });
    },
    removeItem: async (key: string) => {
        await Preferences.remove({ key });
    }
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        storage: CapacitorStorage,
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // Better for mobile apps to avoid hijacking local deep links
    }
});

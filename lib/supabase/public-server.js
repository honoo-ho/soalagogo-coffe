import { createClient } from "@supabase/supabase-js";

export function createSupabasePublicServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Konfigurasi Supabase belum lengkap. Pastikan SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY sudah diatur di environment server."
    );
  }

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

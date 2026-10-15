import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * İstemci TEMBEL oluşturulur ve env doğrulaması ilk çağrıya ertelenir.
 *
 * Modül gövdesinde `createClient` çağrılırsa, `page.tsx` bu modülü dolaylı
 * olarak içe aktardığı için `next build` sayfayı prerender ederken env
 * yoksa build kırılır. Prerender bu fonksiyonu hiç çağırmaz: store yalnızca
 * istemcide, oturum hazır olunca başlatılır.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase yapılandırması eksik. NEXT_PUBLIC_SUPABASE_URL ve " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY değerleri .env.local dosyasına " +
        "girilmeli; gereken anahtar adları için .env.local.example dosyasına bakın.",
    );
  }

  client = createClient(url, anonKey);
  return client;
}

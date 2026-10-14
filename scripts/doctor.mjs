/**
 * Kurulum sağlık kontrolü.
 *
 * Sırayla: .env.local -> bağlantı -> şema -> "Confirm email" ayarı ->
 * kayıt tetikleyicisi. Her adım bir sonrakinin ön koşulu, bu yüzden ilk
 * hatada durur ve ne yapılacağını söyler.
 *
 * Çalıştırma: npm run doctor
 */
import { createClient } from "@supabase/supabase-js";
import { cross, info, loadEnv, testEmail, tick } from "./_env.mjs";

console.log("\nBayatlamaSavar kurulum kontrolu\n");

// 1) env
const env = await loadEnv();
if (!env.ok) {
  if (env.reason === "missing-file") {
    cross(".env.local bulunamadi");
    info(`Beklenen konum: ${env.path}`);
    info("Cozum: cp .env.local.example .env.local  (sonra iki degeri doldur)");
  } else {
    cross(".env.local var ama degerler eksik");
    info(`NEXT_PUBLIC_SUPABASE_URL: ${env.url ? "var" : "YOK"}`);
    info(`NEXT_PUBLIC_SUPABASE_ANON_KEY: ${env.anonKey ? "var" : "YOK"}`);
    info("Supabase panelinde: Project Settings -> API");
  }
  process.exit(1);
}
tick(".env.local okundu");
info(`URL: ${env.url}`);

const supabase = createClient(env.url, env.anonKey);

// 2) baglanti + sema
// Oturum yokken RLS satirlari gizler ama tablo YOKSA hata kodu 42P01 gelir.
const probe = await supabase.from("products").select("id").limit(1);
if (probe.error) {
  const code = probe.error.code ?? "";
  if (code === "42P01" || /does not exist|schema cache/i.test(probe.error.message)) {
    cross("products tablosu bulunamadi — sema uygulanmamis");
    info("Cozum: supabase/migrations/0001_initial_schema.sql dosyasinin");
    info("tamamini Supabase panelindeki SQL Editor'e yapistirip calistir.");
  } else {
    cross(`Baglanti/sorgu hatasi: ${probe.error.message}`);
    info("URL ve anon key dogru mu? Proje duraklatilmis olabilir.");
  }
  process.exit(1);
}
tick("Baglanti kuruldu ve products tablosu goruldu");

if ((probe.data ?? []).length === 0) {
  tick("Oturumsuz sorgu bos dondu — RLS okumayi kisitliyor (beklenen)");
} else {
  cross("UYARI: oturum olmadan satir dondu — RLS acik degil olabilir!");
  info("products tablosunda 'enable row level security' calistirilmis mi?");
}

// 3) "Confirm email" ayari + 4) kayit tetikleyicisi
const email = testEmail("doctor");
const password = `Test-${Math.random().toString(36).slice(2, 10)}!`;

const signUp = await supabase.auth.signUp({ email, password });
if (signUp.error) {
  cross(`Kayit denemesi basarisiz: ${signUp.error.message}`);
  info("Authentication -> Sign In / Up ayarlarini kontrol et.");
  process.exit(1);
}

if (!signUp.data.session) {
  cross('Kayit oldu ama oturum donmedi — "Confirm email" ACIK');
  info("Cozum: Authentication -> Sign In / Up -> Confirm email -> kapat");
  info(`(Olusan test kullanicisi: ${email} — panelden silebilirsin)`);
  process.exit(1);
}
tick('Kayit aninda oturum dondu — "Confirm email" kapali (beklenen)');

const members = await supabase.from("household_members").select("household_id");
if (members.error) {
  cross(`household_members okunamadi: ${members.error.message}`);
  process.exit(1);
}
if ((members.data ?? []).length !== 1) {
  cross(
    `Kayit tetikleyicisi calismamis: beklenen 1 uyelik, bulunan ${
      (members.data ?? []).length
    }`,
  );
  info("handle_new_user tetikleyicisi ve on_auth_user_created olusmus mu?");
  info("Semayi tekrar uygula ve bu betigi yeniden calistir.");
  process.exit(1);
}
tick("Kayit tetikleyicisi calisti — kullaniciya kisisel ev acildi");

// 5) Yazma yolu gercekten calisiyor mu
const householdId = members.data[0].household_id;
const userId = signUp.data.user?.id;
const insert = await supabase.from("products").insert({
  id: crypto.randomUUID(),
  household_id: householdId,
  name: "Kontrol Urunu",
  category: "Diğer",
  opened_at: "2026-10-14",
  shelf_life_days: 3,
  created_by: userId,
});
if (insert.error) {
  cross(`Urun eklenemedi: ${insert.error.message}`);
  info("products_insert politikasi ve kisitlar dogru mu?");
  process.exit(1);
}
tick("Urun eklendi ve geri okundu — yazma yolu calisiyor");

console.log("\n  Kurulum tamam. Simdi: npm run rls-check\n");
info(`Bu betik bir test kullanicisi olusturdu: ${email}`);
info("Panelden (Authentication -> Users) silebilirsin.\n");

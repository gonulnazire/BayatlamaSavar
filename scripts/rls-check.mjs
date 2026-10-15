/**
 * RLS doğrulaması — spec bölüm 9'daki 6 maddelik elle listenin otomatiği.
 *
 * RLS bu uygulamada TEK güvenlik sınırı (route koruması ve middleware yok),
 * bu yüzden bu kontrol atlanamaz.
 *
 * Önemli incelik: RLS'in engellediği bir UPDATE/DELETE hata DÖNDÜRMEZ —
 * yalnızca 0 satır etkiler. Bu yüzden "reddedildi" ölçütü, hata değil
 * "etkilenen satır yok + veri gerçekten değişmemiş".
 *
 * İki test hesabı oluşturur. Çalıştırma: npm run rls-check
 */
import { createClient } from "@supabase/supabase-js";
import { cross, info, loadEnv, testEmail, tick } from "./_env.mjs";

const env = await loadEnv();
if (!env.ok) {
  cross(".env.local okunamadi — once: npm run doctor");
  process.exit(1);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const clientFor = () => createClient(env.url, env.anonKey, options);

let failures = 0;
const check = (ok, text) => {
  if (ok) tick(text);
  else {
    cross(text);
    failures += 1;
  }
};

console.log("\nRLS dogrulamasi\n");

// --- 1) Iki hesap ---
async function makeAccount(tag) {
  const client = clientFor();
  const email = testEmail(tag);
  const password = `Test-${Math.random().toString(36).slice(2, 10)}!`;
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw new Error(`${tag} hesabi acilamadi: ${error.message}`);
  if (!data.session) {
    throw new Error(
      `${tag} icin oturum donmedi — "Confirm email" acik olabilir (npm run doctor)`,
    );
  }
  return { client, email, userId: data.user.id };
}

const A = await makeAccount("a");
const B = await makeAccount("b");
tick(`Iki hesap olusturuldu (${A.email} / ${B.email})`);

// --- 5) Kayit tetikleyicisi (sirasi burada daha dogal) ---
const aMembers = await A.client.from("household_members").select("household_id");
check(
  !aMembers.error && (aMembers.data ?? []).length === 1,
  "Yeni hesaba kisisel ev ve uyelik acildi (tetikleyici)",
);
if (aMembers.error || !aMembers.data?.length) {
  cross("Devam edilemiyor: household_id alinamadi");
  process.exit(1);
}
const aHousehold = aMembers.data[0].household_id;

const bMembers = await B.client.from("household_members").select("household_id");
const bHousehold = bMembers.data?.[0]?.household_id;
check(
  Boolean(bHousehold) && bHousehold !== aHousehold,
  "Iki hesabin evleri AYRI",
);

// --- A bir urun ekler ---
const productId = crypto.randomUUID();
const inserted = await A.client.from("products").insert({
  id: productId,
  household_id: aHousehold,
  name: "A Urunu",
  category: "Süt Ürünü",
  opened_at: "2026-10-14",
  shelf_life_days: 3,
  created_by: A.userId,
});
check(!inserted.error, "A kendi evine urun ekleyebiliyor");
if (inserted.error) {
  info(inserted.error.message);
  process.exit(1);
}

// --- 2) B, A'nin urunlerini GOREMEMELI ---
const bSees = await B.client.from("products").select("id");
check(
  !bSees.error && (bSees.data ?? []).every((r) => r.id !== productId),
  "B, A'nin urununu GOREMIYOR",
);

// --- 3) B, A'nin household_id'sine insert DENEYEMEMELI ---
const crossInsert = await B.client.from("products").insert({
  id: crypto.randomUUID(),
  household_id: aHousehold,
  name: "Sizma Denemesi",
  category: "Diğer",
  opened_at: "2026-10-14",
  shelf_life_days: 1,
  created_by: B.userId,
});
check(
  Boolean(crossInsert.error),
  "B, A'nin evine urun EKLEYEMIYOR (insert politikasi reddetti)",
);

// --- 4) B, A'nin urununu UPDATE edememeli ---
// RLS engelli update hata vermez, 0 satir etkiler -> .select() bos donmeli
const crossUpdate = await B.client
  .from("products")
  .update({ name: "Ele gecirildi" })
  .eq("id", productId)
  .select("id");
check(
  !crossUpdate.error && (crossUpdate.data ?? []).length === 0,
  "B'nin update'i 0 satir etkiledi",
);

const afterUpdate = await A.client
  .from("products")
  .select("name")
  .eq("id", productId)
  .maybeSingle();
check(
  afterUpdate.data?.name === "A Urunu",
  "A'nin urunu GERCEKTEN degismedi (update sizmadi)",
);

// --- 4b) B, A'nin urununu DELETE edememeli ---
const crossDelete = await B.client
  .from("products")
  .delete()
  .eq("id", productId)
  .select("id");
check(
  !crossDelete.error && (crossDelete.data ?? []).length === 0,
  "B'nin delete'i 0 satir etkiledi",
);

const afterDelete = await A.client
  .from("products")
  .select("id")
  .eq("id", productId)
  .maybeSingle();
check(afterDelete.data?.id === productId, "A'nin urunu HALA duruyor");

// --- 6) Anahtarsiz istek reddedilmeli ---
const noKey = await fetch(`${env.url}/rest/v1/products?select=id`);
check(
  noKey.status === 401,
  `Anahtarsiz istek reddedildi (HTTP ${noKey.status})`,
);

// --- Temizlik ---
await A.client.from("products").delete().eq("id", productId);

console.log("");
if (failures === 0) {
  console.log("  TUM RLS KONTROLLERI GECTI\n");
  info("Olusan iki test hesabini Authentication -> Users altindan silebilirsin.");
  info(`${A.email}`);
  info(`${B.email}\n`);
  process.exit(0);
}
console.log(`  ${failures} KONTROL BASARISIZ — goc tamamlanmis sayilmaz.\n`);
info("Politikalari duzeltip semayi tekrar uygula, sonra bu betigi yeniden kostur.\n");
process.exit(1);

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * .env.local dosyasını okur. Next.js bu dosyayı kendisi yükler ama düz
 * `node` yüklemediği için burada elle ayrıştırıyoruz (bağımlılık eklemeden).
 */
export async function loadEnv(root = process.cwd()) {
  const path = resolve(root, ".env.local");

  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return { ok: false, reason: "missing-file", path };
  }

  const values = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  const url = values.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = values.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { ok: false, reason: "missing-values", path, url, anonKey };
  }

  return { ok: true, path, url, anonKey };
}

export function fail(message) {
  console.error(`\n  HATA  ${message}\n`);
  process.exit(1);
}

export const tick = (text) => console.log(`  [ok]   ${text}`);
export const cross = (text) => console.log(`  [HATA] ${text}`);
export const info = (text) => console.log(`         ${text}`);

/** Test hesapları için çakışmayan e-posta üretir */
export function testEmail(tag) {
  const id = Math.random().toString(36).slice(2, 10);
  return `bayatlamasavar-${tag}-${id}@test.local`;
}

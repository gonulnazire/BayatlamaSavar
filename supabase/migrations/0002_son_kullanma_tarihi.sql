-- BayatlamaSavar - sema surumu 1 -> 2
--
-- Model "acilis tarihi + raf omru"nden "SON KULLANMA TARIHI"ne gecti.
-- Ek olarak: miktar/birim, saklama yeri, acildi mi, durum (aktif/tuketildi/
-- cope gitti) ve eklenme tarihi.
--
-- NOT: Turkce metinler Postgres'in Unicode kacis sozdizimiyle (U&'...')
-- yazildi. Boylece dosyada tek bir ASCII disi karakter yok ve panele
-- kopyalarken kodlama bozulamaz. Kacis yanlis cozulseydi check kisiti ilk
-- eklemeyi reddederdi; sessizce yanlis veri olusamaz.
--
-- Bu dosya TEK PARCA calistirilmalidir; adimlar birbirinin on kosulu.

-- ---------------------------------------------------------------------------
-- 1) Yeni kolonlar
-- ---------------------------------------------------------------------------
alter table public.products
  add column quantity double precision not null default 1
    check (quantity > 0),
  add column unit text not null default 'adet'
    check (unit in ('adet', 'g', 'kg', 'ml', 'L', 'paket')),
  add column expires_on date,
  add column storage_place text not null default U&'Buzdolab\0131'
    check (storage_place in (U&'Buzdolab\0131', 'Dondurucu', 'Kiler')),
  add column is_opened boolean not null default false,
  add column state text not null default 'active'
    check (state in ('active', 'consumed', 'discarded')),
  add column state_changed_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2) Son kullanma tarihini mevcut veriden uret
--    v1'de bu bilgi HIC yoktu; acilis tarihi + raf omru ile hesaplaniyordu.
--    Hesap burada bir kez yapilip kalici hale getiriliyor.
-- ---------------------------------------------------------------------------
update public.products
   set expires_on = opened_at + shelf_life_days;

alter table public.products
  alter column expires_on set not null;

-- Eski model yalnizca ambalaji ACILMIS urunleri takip ediyordu
update public.products
   set is_opened = true
 where opened_at is not null;

-- consumed_at dolu olan kayitlar "tuketildi" sayilir (cop ayrimi v1'de yoktu)
update public.products
   set state = 'consumed',
       state_changed_at = consumed_at
 where consumed_at is not null;

-- ---------------------------------------------------------------------------
-- 3) Kategori kumesi 4 -> 7
--    Kisit once dusurulur, degerler esitlenir, sonra yeni kisit konur.
-- ---------------------------------------------------------------------------
alter table public.products
  drop constraint products_category_check;

update public.products
   set category = 'Et'
 where category = U&'Et/\015Eark\00FCteri';

update public.products
   set category = U&'Di\011Fer'
 where category = 'Sos/Konserve';

alter table public.products
  add constraint products_category_check check (category in (
    U&'S\00FCt \00DCr\00FCn\00FC',
    'Et',
    'Sebze',
    'Meyve',
    'Ekmek',
    U&'\0130\00E7ecek',
    U&'Di\011Fer'
  ));

-- ---------------------------------------------------------------------------
-- 4) Eski alanlari kaldir
--    opened_at kaliyor ama artik zorunlu degil: acilmamis urunde bos olur.
-- ---------------------------------------------------------------------------
alter table public.products
  alter column opened_at drop not null;

alter table public.products
  drop column shelf_life_days,
  drop column consumed_at;

-- ---------------------------------------------------------------------------
-- 5) Asil sorgu artik "durumu aktif olanlar"
-- ---------------------------------------------------------------------------
drop index products_active_idx;

create index products_active_idx
  on public.products (household_id) where state = 'active';

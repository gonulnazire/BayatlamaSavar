-- BayatlamaSavar - sema surumu 1 -> 2
--
-- Model "acilis tarihi + raf omru"nden "SON KULLANMA TARIHI"ne gecti.
-- Ek olarak: miktar/birim, saklama yeri, acildi mi, durum (aktif/tuketildi/
-- cope gitti) ve eklenme tarihi.
--
-- NOT 1: Turkce metinler Postgres'in Unicode kacis sozdizimiyle (U&'...')
-- yazildi. Boylece dosyada tek bir ASCII disi karakter yok ve panele
-- kopyalarken kodlama bozulamaz. Kacis yanlis cozulseydi check kisiti ilk
-- eklemeyi reddederdi; sessizce yanlis veri olusamaz.
--
-- NOT 2: Bu betik TEKRAR CALISTIRILABILIR. Ilk yazimda bir sira hatasi vardi:
-- consumed_at kolonu dusurulunce Postgres ona bagli products_active_idx
-- indeksini de kendiliginde dusuruyor, sonraki "drop index" ise olmayan bir
-- nesneyi ariyordu (42704). Artik tum dusurmeler "if exists" ile korunuyor ve
-- veri doldurma adimlari yalnizca eski kolonlar hala duruyorsa calisiyor.

-- ---------------------------------------------------------------------------
-- 1) Yeni kolonlar
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists quantity double precision not null default 1
    check (quantity > 0),
  add column if not exists unit text not null default 'adet'
    check (unit in ('adet', 'g', 'kg', 'ml', 'L', 'paket')),
  add column if not exists expires_on date,
  add column if not exists storage_place text not null default U&'Buzdolab\0131'
    check (storage_place in (U&'Buzdolab\0131', 'Dondurucu', 'Kiler')),
  add column if not exists is_opened boolean not null default false,
  add column if not exists state text not null default 'active'
    check (state in ('active', 'consumed', 'discarded')),
  add column if not exists state_changed_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2) Mevcut veriyi tasi
--    v1'de son kullanma tarihi HIC yoktu; acilis tarihi + raf omru ile
--    hesaplaniyordu. Hesap burada bir kez yapilip kalici hale getiriliyor.
--    Eski kolonlar zaten dusmusse bu blok atlanir.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'products'
       and column_name = 'shelf_life_days'
  ) then
    update public.products
       set expires_on = opened_at + shelf_life_days
     where expires_on is null;

    -- Eski model yalnizca ambalaji ACILMIS urunleri takip ediyordu
    update public.products
       set is_opened = true
     where opened_at is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'products'
       and column_name = 'consumed_at'
  ) then
    -- cop ayrimi v1'de yoktu; hepsi "tuketildi" sayilir
    update public.products
       set state = 'consumed',
           state_changed_at = consumed_at
     where consumed_at is not null;
  end if;
end $$;

alter table public.products
  alter column expires_on set not null;

-- ---------------------------------------------------------------------------
-- 3) Kategori kumesi 4 -> 7
--    Kisit once dusurulur, degerler esitlenir, sonra yeni kisit konur.
-- ---------------------------------------------------------------------------
alter table public.products
  drop constraint if exists products_category_check;

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
--    Indeks consumed_at'e bagli oldugu icin ONCE o dusurulur; kolon dusurmek
--    indeksi de goturur ve geriye "olmayan indeksi silme" hatasi birakirdi.
-- ---------------------------------------------------------------------------
alter table public.products
  alter column opened_at drop not null;

drop index if exists products_active_idx;

alter table public.products
  drop column if exists shelf_life_days,
  drop column if exists consumed_at;

-- ---------------------------------------------------------------------------
-- 5) Asil sorgu artik "durumu aktif olanlar"
-- ---------------------------------------------------------------------------
create index if not exists products_active_idx
  on public.products (household_id) where state = 'active';

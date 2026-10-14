-- BayatlamaSavar — ilk şema
-- Spec: docs/superpowers/specs/2026-10-14-supabase-gocu-design.md (bölüm 4)
--
-- "Tek kişilik ev": paylaşım bugün arayüzde yok, şema ona hazır. Paylaşım
-- eklendiğinde politikalar DEĞİŞMEZ, yalnızca household_members'a satır eklenir.

create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Dolabım',
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         text not null default 'owner' check (role in ('owner','member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.products (
  id              uuid primary key,              -- istemciden gelir (crypto.randomUUID)
  household_id    uuid not null references public.households on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  category        text not null check (category in
                    ('Süt Ürünü','Sos/Konserve','Et/Şarküteri','Diğer')),
  opened_at       date not null,                 -- YYYY-MM-DD; saat dilimi taşımaz
  shelf_life_days int  not null check (shelf_life_days between 0 and 365),
  created_by      uuid not null references auth.users,
  created_at      timestamptz not null default now(),
  consumed_at     timestamptz                    -- null = hâlâ takipte (soft delete)
);

-- Asıl sorgu her zaman "tüketilmemişler"
create index products_active_idx
  on public.products (household_id) where consumed_at is null;

-- ---------------------------------------------------------------------------
-- Üyelik kontrolü
--
-- household_members'a bakan bir politika doğrudan tabloyu okursa sonsuz
-- özyinelemeye girer (politika tabloyu okur, tablo politikayı tetikler).
-- Çözüm security definer bir fonksiyon.
--
-- `set search_path = ''` ATLANAMAZ: security definer fonksiyon tanımlayanın
-- yetkisiyle çalışır; search_path sabitlenmezse çağıran kendi şemasına aynı
-- adlı bir tablo koyup fonksiyonu kandırabilir. Bu yüzden tablo adları da
-- tam nitelikli yazılır.
-- ---------------------------------------------------------------------------
create function public.is_household_member(hid uuid) returns boolean
  language sql
  security definer
  stable
  set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS — bu uygulamada tek güvenlik sınırı (route koruması yok)
-- ---------------------------------------------------------------------------
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.products          enable row level security;

create policy households_select on public.households
  for select using (public.is_household_member(id));

create policy household_members_select on public.household_members
  for select using (user_id = auth.uid());

create policy products_select on public.products
  for select using (public.is_household_member(household_id));

create policy products_insert on public.products
  for insert with check (public.is_household_member(household_id));

create policy products_update on public.products
  for update using (public.is_household_member(household_id))
          with check (public.is_household_member(household_id));

create policy products_delete on public.products
  for delete using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Kayıt tetikleyicisi: her yeni kullanıcıya bir kişisel ev ve owner üyeliği.
-- Böylece uygulama hiç "evim yok" durumuyla uğraşmaz.
-- search_path gerekçesi yukarıdakiyle aynı.
-- ---------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  new_household_id uuid;
begin
  insert into public.households (name)
  values ('Dolabım')
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_household_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

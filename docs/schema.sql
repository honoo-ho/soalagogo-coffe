-- Skema database Katalog UMKM
-- Cara pakai: Supabase > SQL Editor > New query > tempel seluruh isi file ini > Run.
-- Aman dijalankan ulang.

-- 1. Tabel produk
create table if not exists public.produk (
  id bigint generated always as identity primary key,
  nama text not null,
  harga integer not null check (harga >= 0),
  harga_diskon integer check (harga_diskon >= 0),
  badge text check (badge in ('baru', 'terlaris')),
  deskripsi text,
  foto_url text,
  kategori text,
  stok integer check (stok >= 0),
  aktif boolean not null default true,
  urutan integer,
  created_at timestamptz not null default now()
);

-- Tambahkan kolom stok untuk tabel produk yang sudah dibuat sebelumnya.
alter table public.produk
  add column if not exists stok integer check (stok >= 0);
alter table public.produk
  add column if not exists harga_diskon integer check (harga_diskon >= 0);
alter table public.produk
  add column if not exists badge text check (badge in ('baru', 'terlaris'));
alter table public.produk
  add column if not exists aktif boolean not null default true;
alter table public.produk
  add column if not exists urutan integer;

-- Isi urutan produk lama secara konsisten sebelum mengaktifkan nilai wajib dan default.
with urutan_awal as (
  select id, row_number() over (order by created_at asc, id asc)::integer as nomor
  from public.produk
)
update public.produk
set urutan = urutan_awal.nomor
from urutan_awal
where public.produk.id = urutan_awal.id and public.produk.urutan is null;

alter table public.produk alter column urutan set not null;

create sequence if not exists public.produk_urutan_seq;
select setval(
  'public.produk_urutan_seq'::regclass,
  greatest(coalesce(max(urutan), 0), 1),
  coalesce(max(urutan), 0) > 0
)
from public.produk;
alter table public.produk alter column urutan
  set default nextval('public.produk_urutan_seq'::regclass);
grant usage, select on sequence public.produk_urutan_seq to authenticated;
create index if not exists produk_urutan_id on public.produk (urutan, id);

-- Varian ukuran dan harganya untuk setiap produk.
create table if not exists public.varian_produk (
  id bigint generated always as identity primary key,
  produk_id bigint not null references public.produk (id) on delete cascade,
  nama text not null check (nama = btrim(nama) and length(nama) between 1 and 80),
  harga integer not null check (harga > 0),
  created_at timestamptz not null default now(),
  unique (produk_id, nama)
);

create index if not exists varian_produk_produk_id on public.varian_produk (produk_id, id);
alter table public.varian_produk enable row level security;
drop policy if exists "pengunjung_baca_varian_produk" on public.varian_produk;
drop policy if exists "admin_baca_varian_produk" on public.varian_produk;
drop policy if exists "admin_tambah_varian_produk" on public.varian_produk;
drop policy if exists "admin_ubah_varian_produk" on public.varian_produk;
drop policy if exists "admin_hapus_varian_produk" on public.varian_produk;

create policy "pengunjung_baca_varian_produk" on public.varian_produk
  for select to anon, authenticated using (true);
create policy "admin_baca_varian_produk" on public.varian_produk
  for select to authenticated using (true);
create policy "admin_tambah_varian_produk" on public.varian_produk
  for insert to authenticated with check (true);
create policy "admin_ubah_varian_produk" on public.varian_produk
  for update to authenticated using (true) with check (true);
create policy "admin_hapus_varian_produk" on public.varian_produk
  for delete to authenticated using (true);

-- Bersihkan trigger dari versi migrasi sebelumnya jika schema dijalankan ulang.
drop trigger if exists produk_tetapkan_urutan on public.produk;
drop function if exists public.tetapkan_urutan_produk();

create or replace function public.atur_urutan_produk(p_produk_id bigint, p_arah text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  produk_dipilih public.produk%rowtype;
  produk_tetangga public.produk%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sesi admin diperlukan.' using errcode = '42501';
  end if;
  if p_arah is null or p_arah not in ('naik', 'turun') then
    return 'invalid_direction';
  end if;

  -- Kunci daftar agar dua aksi pengurutan tidak saling menimpa.
  perform id from public.produk order by urutan, id for update;

  select * into produk_dipilih
  from public.produk
  where id = p_produk_id;
  if not found then return 'not_found'; end if;

  if p_arah = 'naik' then
    select * into produk_tetangga
    from public.produk
    where (urutan, id) < (produk_dipilih.urutan, produk_dipilih.id)
    order by urutan desc, id desc
    limit 1;
  else
    select * into produk_tetangga
    from public.produk
    where (urutan, id) > (produk_dipilih.urutan, produk_dipilih.id)
    order by urutan asc, id asc
    limit 1;
  end if;
  if not found then return 'boundary'; end if;

  update public.produk
  set urutan = case
    when id = produk_dipilih.id then produk_tetangga.urutan
    when id = produk_tetangga.id then produk_dipilih.urutan
    else urutan
  end
  where id in (produk_dipilih.id, produk_tetangga.id);

  return 'updated';
end;
$$;

revoke all on function public.atur_urutan_produk(bigint, text) from public;
grant execute on function public.atur_urutan_produk(bigint, text) to authenticated;

-- 2. Row Level Security
-- Tidak ada izin untuk publik: akses langsung ke tabel dari luar aplikasi ditolak.
-- Hanya admin yang sudah login yang boleh membaca dan mengubah data.
alter table public.produk enable row level security;

drop policy if exists "admin_baca_produk" on public.produk;
drop policy if exists "admin_tambah_produk" on public.produk;
drop policy if exists "admin_ubah_produk" on public.produk;
drop policy if exists "admin_hapus_produk" on public.produk;

create policy "admin_baca_produk" on public.produk
  for select to authenticated using (true);

create policy "admin_tambah_produk" on public.produk
  for insert to authenticated with check (true);

create policy "admin_ubah_produk" on public.produk
  for update to authenticated using (true) with check (true);

create policy "admin_hapus_produk" on public.produk
  for delete to authenticated using (true);

-- Log perubahan produk. Tidak memakai foreign key agar catatan tetap ada setelah produk dihapus.
create table if not exists public.log_aktivitas_admin (
  id bigint generated always as identity primary key,
  admin_id uuid,
  admin_email text,
  aksi text not null check (aksi in ('tambah_produk', 'ubah_produk', 'hapus_produk')),
  produk_id bigint not null,
  nama_produk text not null,
  created_at timestamptz not null default now()
);

create index if not exists log_aktivitas_admin_dibuat
  on public.log_aktivitas_admin (created_at desc);

alter table public.log_aktivitas_admin enable row level security;
drop policy if exists "admin_baca_log_aktivitas" on public.log_aktivitas_admin;

create policy "admin_baca_log_aktivitas" on public.log_aktivitas_admin
  for select to authenticated using (true);

create or replace function public.catat_aktivitas_produk()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Abaikan perubahan administratif SQL yang tidak berasal dari sesi admin aplikasi.
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.log_aktivitas_admin (admin_id, admin_email, aksi, produk_id, nama_produk)
    values (auth.uid(), auth.jwt() ->> 'email', 'tambah_produk', new.id, new.nama);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.log_aktivitas_admin (admin_id, admin_email, aksi, produk_id, nama_produk)
    values (auth.uid(), auth.jwt() ->> 'email', 'ubah_produk', new.id, new.nama);
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.log_aktivitas_admin (admin_id, admin_email, aksi, produk_id, nama_produk)
    values (auth.uid(), auth.jwt() ->> 'email', 'hapus_produk', old.id, old.nama);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists produk_log_aktivitas_admin on public.produk;
create trigger produk_log_aktivitas_admin
  after insert or update or delete on public.produk
  for each row execute function public.catat_aktivitas_produk();

-- Catatan klik pesan WhatsApp. Baris hanya menyimpan produk dan waktu, tanpa data pengunjung.
create table if not exists public.klik_whatsapp (
  id bigint generated always as identity primary key,
  produk_id bigint not null references public.produk (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists klik_whatsapp_produk_dibuat
  on public.klik_whatsapp (produk_id, created_at desc);

alter table public.klik_whatsapp enable row level security;
drop policy if exists "admin_baca_klik_whatsapp" on public.klik_whatsapp;

create policy "admin_baca_klik_whatsapp" on public.klik_whatsapp
  for select to authenticated using (true);

-- Banner promosi yang dapat dikelola admin dan dibaca publik saat aktif.
create table if not exists public.banner_promo (
  id bigint generated always as identity primary key,
  judul text not null check (judul = btrim(judul) and length(judul) between 1 and 120),
  teks text not null check (teks = btrim(teks) and length(teks) between 1 and 500),
  gambar_url text not null check (length(gambar_url) between 1 and 2048),
  tautan text not null check (length(tautan) between 1 and 2048),
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.banner_promo enable row level security;
drop policy if exists "pengunjung_baca_banner_aktif" on public.banner_promo;
drop policy if exists "admin_baca_semua_banner" on public.banner_promo;
drop policy if exists "admin_tambah_banner" on public.banner_promo;
drop policy if exists "admin_ubah_banner" on public.banner_promo;

create policy "pengunjung_baca_banner_aktif" on public.banner_promo
  for select to anon, authenticated using (aktif = true);

create policy "admin_baca_semua_banner" on public.banner_promo
  for select to authenticated using (true);

create policy "admin_tambah_banner" on public.banner_promo
  for insert to authenticated with check (true);

create policy "admin_ubah_banner" on public.banner_promo
  for update to authenticated using (true) with check (true);

-- Pengaturan identitas toko. Satu baris publik dipakai sebagai sumber konfigurasi toko.
create table if not exists public.pengaturan_toko (
  id smallint primary key default 1 check (id = 1),
  nama_toko text not null check (nama_toko = btrim(nama_toko) and length(nama_toko) between 1 and 120),
  nomor_whatsapp text not null check (nomor_whatsapp ~ '^[1-9][0-9]{7,14}$'),
  alamat text not null check (alamat = btrim(alamat) and length(alamat) between 1 and 250),
  jam_buka text not null check (jam_buka = btrim(jam_buka) and length(jam_buka) between 1 and 120),
  updated_at timestamptz not null default now()
);

alter table public.pengaturan_toko enable row level security;
drop policy if exists "pengunjung_baca_pengaturan_toko" on public.pengaturan_toko;
drop policy if exists "admin_baca_pengaturan_toko" on public.pengaturan_toko;
drop policy if exists "admin_tambah_pengaturan_toko" on public.pengaturan_toko;
drop policy if exists "admin_ubah_pengaturan_toko" on public.pengaturan_toko;

create policy "pengunjung_baca_pengaturan_toko" on public.pengaturan_toko
  for select to anon, authenticated using (true);

create policy "admin_baca_pengaturan_toko" on public.pengaturan_toko
  for select to authenticated using (true);

create policy "admin_tambah_pengaturan_toko" on public.pengaturan_toko
  for insert to authenticated with check (true);

create policy "admin_ubah_pengaturan_toko" on public.pengaturan_toko
  for update to authenticated using (true) with check (true);

-- Ulasan publik: pengunjung hanya dapat membaca ulasan yang ditampilkan dan menambahkan ulasan baru.
create table if not exists public.ulasan (
  id bigint generated always as identity primary key,
  produk_id bigint not null references public.produk (id) on delete cascade,
  nama text not null check (nama = btrim(nama) and length(nama) between 1 and 80),
  rating smallint not null check (rating between 1 and 5),
  komentar text not null check (komentar = btrim(komentar) and length(komentar) between 1 and 1000),
  ditampilkan boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ulasan_produk_tampil_dibuat
  on public.ulasan (produk_id, ditampilkan, created_at desc);

alter table public.ulasan enable row level security;
drop policy if exists "pengunjung_baca_ulasan_tampil" on public.ulasan;
drop policy if exists "pengunjung_kirim_ulasan" on public.ulasan;
drop policy if exists "admin_baca_semua_ulasan" on public.ulasan;
drop policy if exists "admin_ubah_ulasan" on public.ulasan;
drop policy if exists "admin_hapus_ulasan" on public.ulasan;

create policy "pengunjung_baca_ulasan_tampil" on public.ulasan
  for select to anon, authenticated using (ditampilkan = true);

create policy "pengunjung_kirim_ulasan" on public.ulasan
  for insert to anon, authenticated
  with check (ditampilkan = true);

create policy "admin_baca_semua_ulasan" on public.ulasan
  for select to authenticated using (true);

create policy "admin_ubah_ulasan" on public.ulasan
  for update to authenticated using (true) with check (true);

create policy "admin_hapus_ulasan" on public.ulasan
  for delete to authenticated using (true);

-- 3. Daftar kategori yang dikelola admin.
create table if not exists public.kategori (
  nama text primary key check (nama = btrim(nama) and length(nama) between 1 and 80),
  created_at timestamptz not null default now()
);

create unique index if not exists kategori_nama_tanpa_beda_huruf
  on public.kategori (lower(nama));

-- Kategori bawaan diperlukan sebelum data contoh produk dimasukkan.
insert into public.kategori (nama)
select bawaan.nama
from (values
  ('Minuman'), ('Camilan'), ('Bumbu'), ('Kue kering'), ('Kerajinan'), ('Kain')
) as bawaan (nama)
where not exists (
  select 1 from public.kategori existing
  where lower(existing.nama) = lower(bawaan.nama)
);

-- 4. Supabase Storage untuk foto produk.
-- Bucket publik agar URL foto dapat ditampilkan di katalog; unggah/hapus dibatasi ke pengguna login.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'foto-produk',
  'foto-produk',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin_unggah_foto_produk" on storage.objects;
drop policy if exists "admin_hapus_foto_produk" on storage.objects;
drop policy if exists "admin_baca_foto_produk" on storage.objects;

create policy "admin_baca_foto_produk" on storage.objects
  for select to authenticated using (bucket_id = 'foto-produk');

create policy "admin_unggah_foto_produk" on storage.objects
  for insert to authenticated with check (bucket_id = 'foto-produk');

create policy "admin_hapus_foto_produk" on storage.objects
  for delete to authenticated using (bucket_id = 'foto-produk');

-- 5. Data produk awal (hanya diisi jika tabel masih kosong)
insert into public.produk (nama, harga, deskripsi, foto_url, kategori)
select * from (values
  ('Kopi Bubuk Robusta 250 g', 45000, 'Biji robusta disangrai sedang lalu digiling halus. Cocok untuk kopi tubruk dan kopi susu.', '/produk/kopi.svg', 'Minuman'),
  ('Keripik Singkong Balado', 15000, 'Singkong iris tipis, digoreng renyah, dibalut bumbu balado pedas manis.', '/produk/keripik.svg', 'Camilan'),
  ('Sambal Bawang Botol 150 ml', 25000, 'Cabai rawit dan bawang putih goreng dengan minyak, tahan hingga 2 bulan.', '/produk/sambal.svg', 'Bumbu'),
  ('Kue Nastar Toples 500 g', 85000, 'Nastar lembut dengan selai nanas buatan sendiri. Dikemas toples kedap udara.', '/produk/nastar.svg', 'Kue kering'),
  ('Tas Anyaman Pandan', 120000, 'Dianyam tangan dari daun pandan kering, dilapisi kain di bagian dalam.', '/produk/tas.svg', 'Kerajinan'),
  ('Kain Batik Cap 2 m', 175000, 'Batik cap motif parang di atas kain katun primisima, panjang 2 meter.', '/produk/batik.svg', 'Kain')
) as data_awal (nama, harga, deskripsi, foto_url, kategori)
where not exists (select 1 from public.produk);

-- 6. Data tambahan untuk menguji paginasi, urutan, filter, dan pencarian (54 produk).
--    Bersama data awal jadi 60 produk, 10 per kategori, dengan harga dan waktu dibuat berbeda.
--    Hanya diisi sekali; kalau tidak dibutuhkan, hapus dengan:
--    delete from public.produk where deskripsi like 'Contoh untuk uji paginasi%';
with kategori (urut, kategori, foto_url, harga_dasar, langkah, daftar) as (values
  (1, 'Minuman', '/produk/kopi.svg', 20000, 4000, array[
    'Kopi Arabika Gayo 250 g', 'Kopi Luwak Liar 100 g', 'Teh Melati Tubruk 100 g',
    'Wedang Uwuh Isi 10', 'Jahe Merah Instan 250 g', 'Kopi Susu Gula Aren 250 ml',
    'Teh Rosella Kering 50 g', 'Bajigur Instan Isi 5', 'Cokelat Bubuk Murni 200 g']),
  (2, 'Camilan', '/produk/keripik.svg', 10000, 1500, array[
    'Keripik Tempe Original', 'Keripik Pisang Cokelat', 'Rempeyek Kacang 250 g',
    'Basreng Pedas Daun Jeruk', 'Makaroni Bantat Pedas', 'Kerupuk Kulit Sapi 100 g',
    'Emping Melinjo Manis', 'Keripik Kentang Balado', 'Kacang Telur 250 g']),
  (3, 'Bumbu', '/produk/sambal.svg', 18000, 2500, array[
    'Sambal Cumi Asin 150 ml', 'Sambal Teri Medan 150 ml', 'Bumbu Rendang Instan',
    'Bumbu Pecel Kacang 250 g', 'Sambal Matah Botol 150 ml', 'Petis Udang 200 g',
    'Bumbu Rawon Instan', 'Saus Kacang Sate 250 g', 'Terasi Udang Bakar 100 g']),
  (4, 'Kue kering', '/produk/nastar.svg', 60000, 5000, array[
    'Kastengel Keju Toples 500 g', 'Putri Salju Toples 500 g', 'Lidah Kucing Toples 400 g',
    'Kue Semprit Toples 500 g', 'Sagu Keju Toples 400 g', 'Kue Kacang Toples 500 g',
    'Choco Chip Cookies 400 g', 'Bolu Kering Jadul 300 g', 'Kue Bawang 250 g']),
  (5, 'Kerajinan', '/produk/tas.svg', 35000, 15000, array[
    'Dompet Anyaman Rotan', 'Topi Pandan Pantai', 'Keranjang Bambu Serbaguna',
    'Tatakan Gelas Eceng Gondok Isi 6', 'Gantungan Kunci Kayu Ukir', 'Tas Rajut Benang Katun',
    'Vas Bunga Gerabah', 'Sandal Anyaman Mendong', 'Kotak Tisu Kayu Jati']),
  (6, 'Kain', '/produk/batik.svg', 150000, 25000, array[
    'Kain Batik Tulis Lasem 2 m', 'Sarung Tenun Samarinda', 'Kain Tenun Ikat NTT 2 m',
    'Selendang Songket Palembang', 'Kain Lurik Klaten 2 m', 'Batik Kawung Katun 2 m',
    'Kain Jumputan Palembang 2 m', 'Syal Batik Sutra', 'Kain Sasirangan Banjar 2 m'])
)
insert into public.produk (nama, harga, deskripsi, foto_url, kategori, created_at)
select
  p.nama,
  k.harga_dasar + p.ke * k.langkah,
  format('Contoh untuk uji paginasi, urutan, dan pencarian. Produk %s nomor %s.', lower(k.kategori), p.ke),
  k.foto_url,
  k.kategori,
  now() - make_interval(hours => ((k.urut - 1) * 9 + p.ke)::int)
from kategori k
cross join lateral unnest(k.daftar) with ordinality as p (nama, ke)
where not exists (select 1 from public.produk where deskripsi like 'Contoh untuk uji paginasi%');

-- 7. Sinkronkan kategori lama dan aktifkan relasi kategori produk.
-- Rapikan spasi dan satukan kategori yang hanya berbeda kapitalisasi.
with nama_kategori_canonical as (
  select distinct on (lower(btrim(kategori)))
    lower(btrim(kategori)) as kunci,
    btrim(kategori) as nama
  from public.produk
  where nullif(btrim(kategori), '') is not null
  order by lower(btrim(kategori)), btrim(kategori)
)
update public.produk
set kategori = nama_kategori_canonical.nama
from nama_kategori_canonical
where lower(btrim(public.produk.kategori)) = nama_kategori_canonical.kunci
  and public.produk.kategori is distinct from nama_kategori_canonical.nama;

update public.produk
set kategori = null
where kategori is not null and nullif(btrim(kategori), '') is null;

insert into public.kategori (nama)
select distinct kategori
from public.produk
where kategori is not null
on conflict (nama) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'produk_kategori_fkey'
      and conrelid = 'public.produk'::regclass
  ) then
    alter table public.produk
      add constraint produk_kategori_fkey
      foreign key (kategori) references public.kategori (nama)
      on update cascade on delete restrict;
  end if;
end $$;

alter table public.kategori enable row level security;
drop policy if exists "admin_baca_kategori" on public.kategori;
drop policy if exists "admin_tambah_kategori" on public.kategori;
drop policy if exists "admin_ubah_kategori" on public.kategori;
drop policy if exists "admin_hapus_kategori" on public.kategori;

create policy "admin_baca_kategori" on public.kategori
  for select to authenticated using (true);
create policy "admin_tambah_kategori" on public.kategori
  for insert to authenticated with check (true);
create policy "admin_ubah_kategori" on public.kategori
  for update to authenticated using (true) with check (true);
create policy "admin_hapus_kategori" on public.kategori
  for delete to authenticated using (true);

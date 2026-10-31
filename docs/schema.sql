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

create policy "pengunjung_baca_ulasan_tampil" on public.ulasan
  for select to anon, authenticated using (ditampilkan = true);

create policy "pengunjung_kirim_ulasan" on public.ulasan
  for insert to anon, authenticated
  with check (ditampilkan = true);

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

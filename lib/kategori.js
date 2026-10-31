export async function ambilDaftarKategori(supabase) {
  const { data, error } = await supabase
    .from("kategori")
    .select("nama")
    .order("nama", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

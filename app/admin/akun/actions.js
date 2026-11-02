"use server";

import { createSupabaseSessionClient } from "@/lib/supabase/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/log-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function clientAdminUntukKelolaAkun() {
  let sessionClient;
  let user;

  try {
    sessionClient = await createSupabaseSessionClient();
    const { data, error } = await sessionClient.auth.getUser();
    user = error ? null : data.user;
  } catch {
    user = null;
  }

  if (!user) redirect("/admin/login");

  try {
    return { supabase: createSupabaseServerClient(), user };
  } catch (error) {
    logServerError("Konfigurasi pengelolaan akun admin tidak tersedia:", error);
    redirect("/admin/akun?status=service_unavailable");
  }
}

function emailValid(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function undangAdmin(formData) {
  const { supabase } = await clientAdminUntukKelolaAkun();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailValid(email)) redirect("/admin/akun?status=invalid_email");

  let error;
  try {
    ({ error } = await supabase.auth.admin.inviteUserByEmail(email));
  } catch (inviteError) {
    logServerError("Gagal mengundang akun admin:", inviteError);
    redirect("/admin/akun?status=invite_failed");
  }
  if (error) {
    logServerError("Gagal mengundang akun admin:", error);
    redirect("/admin/akun?status=invite_failed");
  }

  revalidatePath("/admin/akun");
  redirect("/admin/akun?status=invited");
}

export async function ubahStatusAdmin(formData) {
  const { supabase, user } = await clientAdminUntukKelolaAkun();
  const id = String(formData.get("id") ?? "").trim();
  const aksi = String(formData.get("aksi") ?? "");
  if (aksi !== "nonaktifkan" && aksi !== "aktifkan") {
    redirect("/admin/akun?status=invalid_action");
  }
  const nonaktifkan = aksi === "nonaktifkan";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    redirect("/admin/akun?status=invalid_id");
  }
  if (id === user.id) redirect("/admin/akun?status=self_action_denied");

  let error;
  try {
    ({ error } = await supabase.auth.admin.updateUserById(id, {
      ban_duration: nonaktifkan ? "876000h" : "none",
    }));
  } catch (updateError) {
    logServerError("Gagal mengubah status akun admin:", updateError);
    redirect("/admin/akun?status=update_failed");
  }
  if (error) {
    logServerError("Gagal mengubah status akun admin:", error);
    redirect("/admin/akun?status=update_failed");
  }

  revalidatePath("/admin/akun");
  redirect(`/admin/akun?status=${nonaktifkan ? "disabled" : "enabled"}`);
}

export async function hapusAdmin(formData) {
  const { supabase, user } = await clientAdminUntukKelolaAkun();
  const id = String(formData.get("id") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    redirect("/admin/akun?status=invalid_id");
  }
  if (id === user.id) redirect("/admin/akun?status=self_action_denied");

  let error;
  try {
    ({ error } = await supabase.auth.admin.deleteUser(id));
  } catch (deleteError) {
    logServerError("Gagal menghapus akun admin:", deleteError);
    redirect("/admin/akun?status=delete_failed");
  }
  if (error) {
    logServerError("Gagal menghapus akun admin:", error);
    redirect("/admin/akun?status=delete_failed");
  }

  revalidatePath("/admin/akun");
  redirect("/admin/akun?status=deleted");
}


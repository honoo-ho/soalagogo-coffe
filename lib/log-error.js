const LABELS = new Map([
  ["Gagal membersihkan upload foto", "admin.photo_cleanup"],
  ["Gagal mengunggah foto produk", "admin.photo_upload"],
  ["Gagal menyimpan produk", "admin.product_create"],
  ["Gagal menyimpan varian produk", "admin.product_variant_save"],
  ["Gagal mengubah produk", "admin.product_update"],
  ["Gagal menghapus produk", "admin.product_delete"],
  ["Gagal membaca status produk", "admin.product_status_read"],
  ["Gagal mengubah status produk", "admin.product_status_update"],
  ["Gagal mengubah urutan produk", "admin.product_order_update"],
  ["OpenAI API gagal membuat deskripsi", "admin.ai_description"],
  ["Permintaan deskripsi AI gagal", "admin.ai_description_request"],
  ["Gagal menyimpan pengaturan toko", "admin.store_settings_update"],
  ["Konfigurasi pengelolaan akun admin tidak tersedia", "admin.account_config"],
  ["Gagal mengundang akun admin", "admin.account_invite"],
  ["Gagal mengubah status akun admin", "admin.account_status_update"],
  ["Gagal menghapus akun admin", "admin.account_delete"],
  ["Gagal membaca kategori untuk impor CSV", "admin.csv_categories_read"],
  ["Gagal menyimpan hasil impor produk", "admin.csv_products_import"],
  ["Gagal mengambil ringkasan klik WhatsApp", "admin.whatsapp_summary_read"],
  ["Gagal mengambil daftar produk admin", "admin.products_read"],
  ["Gagal mengambil daftar akun admin", "admin.accounts_read"],
  ["Gagal mengambil log aktivitas admin", "admin.activity_read"],
  ["Gagal mengambil banner admin", "admin.banners_read"],
  ["Gagal mengambil pengaturan admin toko", "admin.store_settings_read"],
  ["Gagal mengekspor produk", "admin.products_export"],
  ["Gagal mengambil daftar ulasan admin", "admin.reviews_read"],
  ["Gagal memeriksa produk untuk pencatatan WhatsApp", "api.whatsapp_product_read"],
  ["Gagal menyimpan pencatatan klik WhatsApp", "api.whatsapp_click_write"],
  ["Gagal mencatat klik WhatsApp", "api.whatsapp_click"],
  ["Gagal mengambil banner promo", "public.banners_read"],
  ["Gagal mengambil daftar produk dari Supabase", "public.products_read"],
  ["Gagal menyimpan ulasan", "public.review_create"],
  ["Gagal menyiapkan konteks asisten produk", "public.ai_context_read"],
  ["OpenAI gagal menjawab pertanyaan produk", "public.ai_answer"],
  ["Permintaan asisten produk gagal", "public.ai_request"],
  ["Gagal mengambil ulasan produk", "public.product_reviews_read"],
  ["Gagal mengambil varian produk", "public.product_variants_read"],
  ["Gagal mengambil produk terkait", "public.related_products_read"],
  ["Gagal mengambil pengaturan toko, menggunakan nilai cadangan", "public.store_settings_read"],
]);

const SAFE_CODES = new Set([
  "22P02",
  "23502",
  "23503",
  "23505",
  "23514",
  "42501",
  "42P01",
  "PGRST116",
  "rate_limit_exceeded",
  "server_error",
  "invalid_request_error",
  "insufficient_quota",
  "model_not_found",
]);

/** Logs an allowlisted context and safe metadata only; never prints raw errors. */
export function logServerError(context, ...details) {
  const contextKey = typeof context === "string" ? context.replace(/:$/, "") : "";
  const label = LABELS.get(contextKey) ?? "server.unclassified_error";
  const metadata = {};

  for (const detail of details) {
    if (typeof detail === "string" && SAFE_CODES.has(detail)) {
      metadata.code = detail;
      continue;
    }

    if (Number.isInteger(detail) && detail >= 100 && detail <= 599) {
      metadata.status = detail;
      continue;
    }

    if (!detail || typeof detail !== "object") continue;

    if (typeof detail.code === "string" && SAFE_CODES.has(detail.code)) {
      metadata.code = detail.code;
    }

    if (
      Number.isInteger(detail.status) &&
      detail.status >= 100 &&
      detail.status <= 599
    ) {
      metadata.status = detail.status;
    }
  }

  console.error(label, Object.keys(metadata).length ? metadata : "detail_redacted");
}

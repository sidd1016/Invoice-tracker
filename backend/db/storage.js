import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "invoice-files";

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Storage is optional: if it isn't configured, uploads still work — the app
// just won't keep a copy of the original file for re-download.
export function storageEnabled() {
  return !!supabase;
}

export async function uploadOriginalFile(path, buffer, contentType) {
  if (!supabase) return null;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: true
  });
  if (error) {
    console.error("Supabase Storage upload failed:", error.message);
    return null;
  }
  return path;
}

export async function getSignedDownloadUrl(path, expiresInSeconds = 300) {
  if (!supabase || !path) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("Supabase Storage signed URL failed:", error.message);
    return null;
  }
  return data.signedUrl;
}

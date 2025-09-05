"use client";
import { browserSupabase } from "@/lib/supabase/client";

export async function uploadToMedia(file: File, folder = "homepage") {
  const supabase = browserSupabase();
  const ext = file.name.split(".").pop() || "jpg";
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from("media").upload(key, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("media").getPublicUrl(key);
  return data.publicUrl; // copy into image_url
}

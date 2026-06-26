/**
 * Supabase Storage uploader — reads config from /api/supabase-config
 * 
 * Falls back to base64 encoding if Supabase Storage is not configured yet.
 */

let supabaseUrl = "";
let supabaseAnonKey = "";
let supabaseConfigured = false;
let configChecked = false;

async function tryInitSupabase(): Promise<boolean> {
  if (configChecked) return supabaseConfigured;
  configChecked = true;

  try {
    const res = await fetch("/api/supabase-config");
    if (!res.ok) return false;
    const config = await res.json();

    if (
      !config.supabaseUrl ||
      config.supabaseUrl === "YOUR_SUPABASE_URL" ||
      !config.supabaseAnonKey ||
      config.supabaseAnonKey === "YOUR_SUPABASE_ANON_KEY"
    ) {
      console.warn("[Supabase Storage] Not configured yet — using base64 fallback mode.");
      return false;
    }

    supabaseUrl = config.supabaseUrl;
    supabaseAnonKey = config.supabaseAnonKey;
    supabaseConfigured = true;
    console.log("[Supabase Storage] Initialized successfully.");
    return true;
  } catch (e) {
    console.warn("[Supabase Storage] Init failed, using base64 fallback:", e);
    return false;
  }
}

function readFileAsBase64(file: File, onProgress?: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 85));
      }
    };
    reader.onload = () => {
      if (onProgress) onProgress(100);
      resolve(reader.result as string);
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

export async function uploadDocumentToStorage(
  file: File,
  employeeId: string,
  docType: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const isOk = await tryInitSupabase();

  if (!isOk) {
    if (onProgress) onProgress(10);
    return await readFileAsBase64(file, onProgress);
  }

  // Supabase Storage path
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const bucketName = "documents";
  const storagePath = `${employeeId}/${docType}/${timestamp}_${safeName}`;

  if (onProgress) onProgress(15);

  try {
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketName}/${storagePath}`;
    
    if (onProgress) onProgress(30);

    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "apikey": supabaseAnonKey,
        "Authorization": `Bearer ${supabaseAnonKey}`,
        "Content-Type": file.type
      },
      body: file
    });

    if (onProgress) onProgress(85);

    if (uploadRes.status === 200 || uploadRes.ok) {
      if (onProgress) onProgress(100);
      // Return public URL of the uploaded file
      return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${storagePath}`;
    } else {
      const errMsg = await uploadRes.text();
      console.error("[Supabase Storage] Upload failed:", errMsg);
      console.warn("[Supabase Storage] Falling back to base64 mode...");
      return await readFileAsBase64(file, onProgress);
    }
  } catch (error) {
    console.error("[Supabase Storage] Upload exception:", error);
    console.warn("[Supabase Storage] Falling back to base64 mode...");
    return await readFileAsBase64(file, onProgress);
  }
}

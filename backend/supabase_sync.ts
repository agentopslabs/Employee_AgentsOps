import fs from "fs";
import path from "path";

const configPath = path.join(process.cwd(), "supabase-config.json");
let supabaseConfig: any = {};
try {
  if (fs.existsSync(configPath)) {
    supabaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (err) {
  console.warn("[Supabase Sync] Failed to load supabase-config.json:", err);
}

const SUPABASE_URL = process.env.SUPABASE_URL || supabaseConfig.supabaseUrl;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseConfig.supabaseServiceRoleKey;

const isPlaceholder = !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || SUPABASE_URL === "YOUR_SUPABASE_URL";

const collectionsInfo = [
  { name: "users", key: "users", type: "array" },
  { name: "passwords", key: "passwords", type: "map" },
  { name: "applications", key: "applications", type: "array" },
  { name: "documents", key: "documents", type: "array" },
  { name: "tests", key: "tests", type: "array" },
  { name: "assignedTests", key: "assignedTests", type: "array" },
  { name: "checklists", key: "checklists", type: "array" },
  { name: "activityLogs", key: "activityLogs", type: "array" },
  { name: "emails", key: "emails", type: "array" },
  { name: "notifications", key: "notifications", type: "array" },
  { name: "annotations", key: "annotations", type: "array" },
  { name: "messages", key: "messages", type: "array" },
  { name: "tasks", key: "tasks", type: "array" },
  { name: "taskSubmissions", key: "taskSubmissions", type: "array" },
  { name: "attendance", key: "attendance", type: "array" },
  { name: "leaves", key: "leaves", type: "array" }
];

const getId = (item: any, colName: string): string => {
  if (colName === "applications") return item.employeeId;
  return item.id;
};

export async function loadFromFirestore(memoryDb: any): Promise<boolean> {
  // Named loadFromFirestore for seamless backward compatibility with backend/server.ts imports
  if (isPlaceholder) {
    console.log("[Supabase Sync] Supabase credentials missing or placeholder, bypassing load.");
    return false;
  }

  try {
    const promises = collectionsInfo.map(async (colInfo) => {
      try {
        const url = `${SUPABASE_URL}/rest/v1/${colInfo.name.toLowerCase()}?select=id,data`;
        const res = await fetch(url, {
          headers: {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        });
        if (res.status === 200) {
          const rows: any = await res.json();
          if (colInfo.type === "array") {
            memoryDb[colInfo.key] = rows.map((r: any) => r.data).filter(Boolean);
          } else {
            memoryDb[colInfo.key] = {};
            rows.forEach((r: any) => {
              if (r.data) {
                memoryDb[colInfo.key][r.id] = r.data.password;
              }
            });
          }
        } else {
          console.warn(`[Supabase Sync] Failed to load table "${colInfo.name}" (status ${res.status})`);
        }
      } catch (colErr: any) {
        console.warn(`[Supabase Sync] Failed to load table "${colInfo.name}":`, colErr.message || colErr);
        if (!(colInfo.key in memoryDb)) {
          memoryDb[colInfo.key] = colInfo.type === "array" ? [] : {};
        }
      }
    });

    await Promise.all(promises);
    return true;
  } catch (err) {
    console.error("[Supabase Sync] Critical error in loadFromFirestore:", err);
    return false;
  }
}

export async function syncToFirestore(memoryDb: any): Promise<void> {
  // Named syncToFirestore for seamless backward compatibility with backend/server.ts imports
  if (isPlaceholder) {
    console.log("[Supabase Sync] Supabase credentials missing or placeholder, bypassing sync.");
    return;
  }

  try {
    const promises = collectionsInfo.map(async (colInfo) => {
      try {
        // Fetch existing IDs to perform deletion if items are removed
        const scanUrl = `${SUPABASE_URL}/rest/v1/${colInfo.name.toLowerCase()}?select=id`;
        const scanRes = await fetch(scanUrl, {
          headers: {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        });
        const existingIds = new Set<string>();
        if (scanRes.status === 200) {
          const rows: any = await scanRes.json();
          rows.forEach((r: any) => existingIds.add(r.id));
        }

        const subPromises: Promise<any>[] = [];

        if (colInfo.type === "array") {
          const items = memoryDb[colInfo.key] || [];
          const presentIds = new Set<string>();

          const upsertPayloads = [];
          for (const item of items) {
            const id = getId(item, colInfo.name);
            if (id) {
              presentIds.add(id);
              upsertPayloads.push({ id, data: item });
            }
          }

          if (upsertPayloads.length > 0) {
            const upsertUrl = `${SUPABASE_URL}/rest/v1/${colInfo.name.toLowerCase()}?on_conflict=id`;
            subPromises.push(
              fetch(upsertUrl, {
                method: "POST",
                headers: {
                  "apikey": SUPABASE_SERVICE_ROLE_KEY,
                  "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  "Content-Type": "application/json",
                  "Prefer": "resolution=merge-duplicates"
                },
                body: JSON.stringify(upsertPayloads)
              })
            );
          }

          // Delete items
          for (const existingId of existingIds) {
            if (!presentIds.has(existingId)) {
              const deleteUrl = `${SUPABASE_URL}/rest/v1/${colInfo.name.toLowerCase()}?id=eq.${existingId}`;
              subPromises.push(
                fetch(deleteUrl, {
                  method: "DELETE",
                  headers: {
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                  }
                })
              );
            }
          }
        } else {
          // map type (passwords)
          const passwordsMap = memoryDb[colInfo.key] || {};
          const presentIds = new Set(Object.keys(passwordsMap));

          const upsertPayloads = [];
          for (const [userId, password] of Object.entries(passwordsMap)) {
            upsertPayloads.push({ id: userId, data: { id: userId, password } });
          }

          if (upsertPayloads.length > 0) {
            const upsertUrl = `${SUPABASE_URL}/rest/v1/${colInfo.name.toLowerCase()}?on_conflict=id`;
            subPromises.push(
              fetch(upsertUrl, {
                method: "POST",
                headers: {
                  "apikey": SUPABASE_SERVICE_ROLE_KEY,
                  "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  "Content-Type": "application/json",
                  "Prefer": "resolution=merge-duplicates"
                },
                body: JSON.stringify(upsertPayloads)
              })
            );
          }

          // Delete passwords
          for (const existingId of existingIds) {
            if (!presentIds.has(existingId)) {
              const deleteUrl = `${SUPABASE_URL}/rest/v1/${colInfo.name.toLowerCase()}?id=eq.${existingId}`;
              subPromises.push(
                fetch(deleteUrl, {
                  method: "DELETE",
                  headers: {
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                  }
                })
              );
            }
          }
        }

        await Promise.all(subPromises);
      } catch (colErr: any) {
        console.warn(`[Supabase Sync] Failed to sync table "${colInfo.name}":`, colErr.message || colErr);
      }
    });

    await Promise.all(promises);
    console.log("[Supabase Sync] Completed sync attempt to Supabase.");
  } catch (err) {
    console.error("[Supabase Sync] Critical error in syncToFirestore:", err);
  }
}

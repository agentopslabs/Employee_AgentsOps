var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// netlify/functions/api.ts
var api_exports = {};
__export(api_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(api_exports);
var import_serverless_http = __toESM(require("serverless-http"), 1);
var import_fs3 = __toESM(require("fs"), 1);
var import_path3 = __toESM(require("path"), 1);
var import_os2 = __toESM(require("os"), 1);

// backend/server.ts
var import_express = __toESM(require("express"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_http = __toESM(require("http"), 1);
var import_os = __toESM(require("os"), 1);
var import_child_process = require("child_process");

// backend/supabase_sync.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var configPath = import_path.default.join(process.cwd(), "supabase-config.json");
var supabaseConfig = {};
try {
  if (import_fs.default.existsSync(configPath)) {
    supabaseConfig = JSON.parse(import_fs.default.readFileSync(configPath, "utf-8"));
  }
} catch (err) {
  console.warn("[Supabase Sync] Failed to load supabase-config.json:", err);
}
var SUPABASE_URL = process.env.SUPABASE_URL || supabaseConfig.supabaseUrl;
var SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseConfig.supabaseServiceRoleKey;
var isPlaceholder = !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || SUPABASE_URL === "YOUR_SUPABASE_URL";
var collectionsInfo = [
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
async function loadFromFirestore(memoryDb) {
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
          const rows = await res.json();
          if (colInfo.type === "array") {
            memoryDb[colInfo.key] = rows.map((r) => r.data).filter(Boolean);
          } else {
            memoryDb[colInfo.key] = {};
            rows.forEach((r) => {
              if (r.data) {
                memoryDb[colInfo.key][r.id] = r.data.password;
              }
            });
          }
        } else {
          console.warn(`[Supabase Sync] Failed to load table "${colInfo.name}" (status ${res.status})`);
        }
      } catch (colErr) {
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

// backend/server.ts
var PORT = 3005;
var isServerless = process.env.VERCEL || process.env.NODE_ENV === "production";
var DB_PATH = isServerless ? import_path2.default.join(import_os.default.tmpdir(), "db_agentops.json") : import_path2.default.join(process.cwd(), "db_agentops.json");
var db = {
  users: [],
  passwords: {},
  applications: [],
  documents: [],
  tests: [],
  assignedTests: [],
  checklists: [],
  activityLogs: [],
  emails: [],
  notifications: [],
  annotations: [],
  messages: [],
  tasks: [],
  taskSubmissions: [],
  attendance: [],
  leaves: []
};
async function loadDatabaseFromFirestore(silent = false) {
  if (!silent) console.log("[Node Server] Pulling database from Firestore...");
  if (isServerless && !import_fs2.default.existsSync(DB_PATH)) {
    const baselinePath2 = import_path2.default.join(process.cwd(), "db_agentops.json");
    if (import_fs2.default.existsSync(baselinePath2)) {
      try {
        import_fs2.default.copyFileSync(baselinePath2, DB_PATH);
        if (!silent) console.log("[Node Server] Seeded /tmp database from git baseline.");
      } catch (copyErr) {
        console.error("[Node Server] Failed to seed /tmp database from baseline:", copyErr);
      }
    }
  }
  try {
    if (import_fs2.default.existsSync(DB_PATH)) {
      const fileData = import_fs2.default.readFileSync(DB_PATH, "utf-8");
      const localDb = JSON.parse(fileData);
      for (const key of Object.keys(db)) {
        if (localDb[key] !== void 0) {
          db[key] = localDb[key];
        }
      }
    }
  } catch (err) {
    console.error("[Node Server] Failed to pre-load disk cache:", err);
  }
  let firestoreLoaded = false;
  try {
    firestoreLoaded = await Promise.race([
      loadFromFirestore(db),
      new Promise((resolve) => {
        setTimeout(() => {
          if (!silent) console.warn("[Node Server] Firestore load timeout fallback. Using disk cache.");
          resolve(false);
        }, 4500);
      })
    ]);
  } catch (err) {
    console.error("[Node Server] Firestore restoration crashed:", err);
  }
  if (firestoreLoaded) {
    if (!silent) console.log("[Node Server] Database state successfully hydrated from Firestore.");
    db.messages = db.messages || [];
    db.annotations = db.annotations || [];
    try {
      import_fs2.default.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
    } catch (_) {
    }
  } else {
    if (!silent) console.log("[Node Server] Direct load failed, verifying disk cache fallback.");
    if (!import_fs2.default.existsSync(DB_PATH)) {
      if (!silent) console.log("[Node Server] Disk cache missing, seeding default blank state.");
      import_fs2.default.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
    }
  }
}
var pythonProcess = null;
function startPythonFastAPI() {
  console.log("[Python Spawner] Booting Python FastAPI subprocess...");
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  const pythonEnv = { ...process.env, DB_PATH };
  pythonProcess = (0, import_child_process.spawn)(pythonCmd, ["backend/main.py"], { env: pythonEnv });
  pythonProcess.stdout.on("data", (data) => {
    console.log(`[Python FastAPI stdout] ${data.toString().trim()}`);
  });
  pythonProcess.stderr.on("data", (data) => {
    console.warn(`[Python FastAPI stderr] ${data.toString().trim()}`);
  });
  pythonProcess.on("close", (code) => {
    console.log(`[Python Process] Ended with exit status ${code}. Restarting in 5 seconds...`);
    setTimeout(startPythonFastAPI, 5e3);
  });
}
var app = (0, import_express.default)();
app.use("/api", (req, res) => {
  const targetPath = `/api${req.url}`;
  const headers = { ...req.headers };
  headers.host = "127.0.0.1:8005";
  const proxyReq = import_http.default.request({
    host: "127.0.0.1",
    port: 8005,
    path: targetPath,
    method: req.method,
    headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", (err) => {
    console.error("[Proxy Error] FastAPI server unavailable:", err.message);
    res.status(502).json({
      error: "FastAPI server unavailable.",
      details: err.message
    });
  });
  req.pipe(proxyReq);
});
async function startLocalServer() {
  await loadDatabaseFromFirestore();
  startPythonFastAPI();
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Server] Core operating successfully at http://localhost:${PORT}`);
    });
  }
}
startLocalServer().catch((e) => {
  console.error("Critical server failure on startup:", e);
});
var server_default = app;

// netlify/functions/api.ts
var DB_PATH2 = import_path3.default.join(import_os2.default.tmpdir(), "db_agentops.json");
var baselinePath = import_path3.default.join(process.cwd(), "db_agentops.json");
if (!import_fs3.default.existsSync(DB_PATH2) && import_fs3.default.existsSync(baselinePath)) {
  try {
    import_fs3.default.copyFileSync(baselinePath, DB_PATH2);
  } catch (_) {
  }
}
var handler = (0, import_serverless_http.default)(server_default);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});

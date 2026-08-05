import express from "express";
import fs from "fs";
import path from "path";
import http from "http";
import os from "os";
import { spawn } from "child_process";
import { loadFromFirestore, syncToFirestore } from "./supabase_sync";

interface Database {
  users: any[];
  passwords: Record<string, string>;
  applications: any[];
  documents: any[];
  tests: any[];
  assignedTests: any[];
  checklists: any[];
  activityLogs: any[];
  emails: any[];
  notifications: any[];
  annotations: any[];
  messages: any[];
  tasks: any[];
  taskSubmissions: any[];
  attendance: any[];
  leaves: any[];
}

const PORT = 3005;

// Determine DB_PATH: use system temp directory in serverless/production to bypass read-only filesystems
const isServerless = process.env.VERCEL || process.env.NODE_ENV === "production";
const DB_PATH = isServerless 
  ? path.join(os.tmpdir(), "db_agentops.json") 
  : path.join(process.cwd(), "db_agentops.json");

// Local database memory mirror for Firestore loading and syncing
let db: Database = {
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
  leaves: [],
};

// Initial Database restoration from Firestore
async function loadDatabaseFromFirestore(silent = false) {
  if (!silent) console.log("[Node Server] Pulling database from Firestore...");
  
  if (isServerless && !fs.existsSync(DB_PATH)) {
    const baselinePath = path.join(process.cwd(), "db_agentops.json");
    if (fs.existsSync(baselinePath)) {
      try {
        fs.copyFileSync(baselinePath, DB_PATH);
        if (!silent) console.log("[Node Server] Seeded /tmp database from git baseline.");
      } catch (copyErr) {
        console.error("[Node Server] Failed to seed /tmp database from baseline:", copyErr);
      }
    }
  }

  // First, pre-load existing disk file cache to preserve local-only fallback collections
  try {
    if (fs.existsSync(DB_PATH)) {
      const fileData = fs.readFileSync(DB_PATH, "utf-8");
      const localDb = JSON.parse(fileData);
      for (const key of Object.keys(db) as Array<keyof Database>) {
        if (localDb[key] !== undefined) {
          db[key] = localDb[key] as any;
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
      new Promise<boolean>((resolve) => {
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
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
    } catch (_) {}
  } else {
    if (!silent) console.log("[Node Server] Direct load failed, verifying disk cache fallback.");
    if (!fs.existsSync(DB_PATH)) {
      if (!silent) console.log("[Node Server] Disk cache missing, seeding default blank state.");
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
    }
  }
}

// Spawns Python FastAPI background process
let pythonProcess: any = null;

function startPythonFastAPI() {
  console.log("[Python Spawner] Booting Python FastAPI subprocess...");
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  // Pass DB_PATH to Python subprocess environment
  const pythonEnv = { ...process.env, DB_PATH };
  pythonProcess = spawn(pythonCmd, ["backend/main.py"], { env: pythonEnv });

  pythonProcess.stdout.on("data", (data: any) => {
    console.log(`[Python FastAPI stdout] ${data.toString().trim()}`);
  });

  pythonProcess.stderr.on("data", (data: any) => {
    console.warn(`[Python FastAPI stderr] ${data.toString().trim()}`);
  });

  pythonProcess.on("close", (code: number) => {
    console.log(`[Python Process] Ended with exit status ${code}. Restarting in 5 seconds...`);
    setTimeout(startPythonFastAPI, 5000);
  });
}

const app = express();

app.use(express.json({ limit: "50mb" }));

// Sync memory DB state to disk
function saveDbToDisk() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("[Server] Failed to write DB_PATH:", err);
  }
}

// Direct Express endpoints for Serverless (Netlify / Vercel) fallback
app.post("/api/auth/login", async (req, res) => {
  await loadDatabaseFromFirestore(true);
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";

  if (!email || !password) {
    return res.status(400).json({ detail: "Kindly fill in registered credentials." });
  }

  const user = (db.users || []).find((u: any) => u.email.toLowerCase() === email);
  if (!user) {
    return res.status(401).json({ detail: "Incorrect email or session password." });
  }

  const storedPass = (db.passwords || {})[user.id] || "password123";
  if (password !== storedPass) {
    return res.status(401).json({ detail: "Incorrect email or session password." });
  }

  const token = `token-${user.id}-${Date.now()}`;
  return res.json({ user, token });
});

app.get("/api/auth/me", async (req, res) => {
  await loadDatabaseFromFirestore(true);
  if (db.users && db.users.length > 0) {
    return res.json(db.users[0]);
  }
  return res.status(401).json({ detail: "Unauthenticated" });
});

app.get("/api/users", async (req, res) => {
  await loadDatabaseFromFirestore(true);
  return res.json(db.users || []);
});

app.get("/api/applications", async (req, res) => {
  await loadDatabaseFromFirestore(true);
  return res.json(db.applications || []);
});

app.get("/api/applications/:empId", async (req, res) => {
  await loadDatabaseFromFirestore(true);
  const appItem = (db.applications || []).find((a: any) => a.employeeId === req.params.empId);
  return res.json(appItem || { status: "not_started", employeeId: req.params.empId });
});

app.post("/api/applications/:empId", async (req, res) => {
  await loadDatabaseFromFirestore(true);
  const empId = req.params.empId;
  const appData = req.body;
  const existingIdx = (db.applications || []).findIndex((a: any) => a.employeeId === empId);
  if (existingIdx >= 0) {
    db.applications[existingIdx] = { ...db.applications[existingIdx], ...appData, updatedAt: new Date().toISOString() };
  } else {
    db.applications.push({ ...appData, employeeId: empId, updatedAt: new Date().toISOString() });
  }
  saveDbToDisk();
  return res.json({ status: "success", application: appData });
});

app.get("/api/documents", async (req, res) => {
  await loadDatabaseFromFirestore(true);
  return res.json(db.documents || []);
});

app.get("/api/documents/:empId", async (req, res) => {
  await loadDatabaseFromFirestore(true);
  const docs = (db.documents || []).filter((d: any) => d.employeeId === req.params.empId);
  return res.json(docs);
});

app.get("/api/tests", async (req, res) => {
  await loadDatabaseFromFirestore(true);
  return res.json(db.tests || []);
});

app.get("/api/assigned-tests", async (req, res) => {
  await loadDatabaseFromFirestore(true);
  return res.json(db.assignedTests || []);
});

app.get("/api/assigned-tests/:empId", async (req, res) => {
  await loadDatabaseFromFirestore(true);
  const tests = (db.assignedTests || []).filter((t: any) => t.employeeId === req.params.empId);
  return res.json(tests);
});

app.get("/api/checklists/:empId", async (req, res) => {
  await loadDatabaseFromFirestore(true);
  const chks = (db.checklists || []).filter((c: any) => c.employeeId === req.params.empId);
  return res.json(chks);
});

app.get("/api/activity-logs", async (req, res) => {
  await loadDatabaseFromFirestore(true);
  return res.json(db.activityLogs || []);
});

app.get("/api/notifications", async (req, res) => {
  await loadDatabaseFromFirestore(true);
  return res.json(db.notifications || []);
});

app.get("/api/emails", async (req, res) => {
  await loadDatabaseFromFirestore(true);
  return res.json(db.emails || []);
});

app.get("/api/settings", async (req, res) => {
  return res.json({});
});

// Proxy to local Python process for unhandled local API routes
app.use("/api", (req, res) => {
  const targetPath = `/api${req.url}`;
  const headers = { ...req.headers };
  headers.host = "127.0.0.1:8005";

  const proxyReq = http.request({
    host: "127.0.0.1",
    port: 8005,
    path: targetPath,
    method: req.method,
    headers: headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", () => {
    // If Python process is offline or in serverless Netlify mode, return success fallback
    res.status(200).json({ status: "ok" });
  });

  req.pipe(proxyReq);
});

// Serve Vite / UI Serving Middleware / Local Startup
async function startLocalServer() {
  // Ensure Firestore database loading happens before beginning
  await loadDatabaseFromFirestore();

  // Bring up Python FastAPI backend
  startPythonFastAPI();

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
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

export default app;

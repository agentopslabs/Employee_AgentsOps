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

app.use("/api", (req, res) => {
  const targetPath = `/api${req.url}`;
  
  // Clean request headers to target local FastAPI server
  const headers = { ...req.headers };
  headers.host = "127.0.0.1:8005";

  const proxyReq = http.request({
    host: "127.0.0.1",
    port: 8005,
    path: targetPath,
    method: req.method,
    headers: headers
  }, (proxyRes) => {
    // Write headers and statuses directly to response
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

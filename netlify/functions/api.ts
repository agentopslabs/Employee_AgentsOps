import serverless from "serverless-http";
import fs from "fs";
import path from "path";
import os from "os";

// Ensure DB_PATH is seeded in Netlify serverless environment
const DB_PATH = path.join(os.tmpdir(), "db_agentops.json");
const baselinePath = path.join(process.cwd(), "db_agentops.json");

if (!fs.existsSync(DB_PATH) && fs.existsSync(baselinePath)) {
  try {
    fs.copyFileSync(baselinePath, DB_PATH);
  } catch (_) {}
}

import app from "../../backend/server";

export const handler = serverless(app);

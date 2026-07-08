import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const starterDb = {
  meta: {
    appName: "QR Asset System",
    version: 1,
    updatedAt: new Date().toISOString()
  },
  categories: [
    {
      id: "cat-machines",
      name: "Machines",
      description: "Production machines and major fixed equipment",
      fields: [
        { id: "field-area", label: "Area", type: "text", required: true, placeholder: "Example: Savoury / Dressings" },
        { id: "field-line", label: "Line", type: "text", required: false, placeholder: "Example: CL3" },
        { id: "field-model", label: "Model", type: "text", required: false, placeholder: "Machine model" },
        { id: "field-last-pm", label: "Last PM Date", type: "date", required: false },
        { id: "field-next-check", label: "Next Check Date", type: "date", required: true }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: "cat-devices",
      name: "Devices",
      description: "Portable devices, instruments, tablets, sensors, and similar assets",
      fields: [
        { id: "field-serial", label: "Serial Number", type: "text", required: true },
        { id: "field-owner", label: "Owner / Custodian", type: "text", required: false },
        { id: "field-next-calibration", label: "Next Calibration Date", type: "date", required: true }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: "cat-tools",
      name: "Tools",
      description: "Tools that need registration, tracking, or validity checks",
      fields: [
        { id: "field-condition", label: "Condition", type: "select", required: true, options: ["Good", "Needs Repair", "For Checking"] },
        { id: "field-next-inspection", label: "Next Inspection Date", type: "date", required: true }
      ],
      createdAt: new Date().toISOString()
    }
  ],
  requests: [],
  items: []
};

async function ensureDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(starterDb, null, 2));
  }
}

export async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, "utf8");
  return JSON.parse(raw);
}

export async function writeDb(db) {
  await ensureDb();
  const next = {
    ...db,
    meta: {
      ...(db.meta || {}),
      updatedAt: new Date().toISOString()
    }
  };
  await fs.writeFile(DB_PATH, JSON.stringify(next, null, 2));
  return next;
}

export function getDbPath() {
  return DB_PATH;
}

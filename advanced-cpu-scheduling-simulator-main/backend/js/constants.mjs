import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BACKEND_DIR = path.resolve(__dirname, "..");
export const ENGINE_SOURCE_DIR = path.join(BACKEND_DIR, "cpp");
export const ENGINE_BIN = path.join(BACKEND_DIR, "scheduler_engine");
export const PORT = Number(process.env.PORT || 3001);

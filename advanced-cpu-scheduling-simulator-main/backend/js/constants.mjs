import path from "node:path";
import { fileURLToPath } from "node:url";
import { accessSync, constants as fsConstants } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BACKEND_DIR = path.resolve(__dirname, "..");
export const ENGINE_SOURCE_DIR = path.join(BACKEND_DIR, "cpp");
// On Windows a compiled binary may be emitted as `scheduler_engine.exe`.
// Prefer an existing `.exe` when present, otherwise fall back to the plain name
// (useful when running on Unix-like systems or when a prebuilt binary without
// extension exists).
let engineBin = path.join(BACKEND_DIR, "scheduler_engine");
if (process.platform === "win32") {
	const exePath = `${engineBin}.exe`;
	try {
		accessSync(exePath, fsConstants.F_OK);
		engineBin = exePath;
	} catch {
		// keep fallback
	}
}
export const ENGINE_BIN = engineBin;
export const PORT = Number(process.env.PORT || 3001);

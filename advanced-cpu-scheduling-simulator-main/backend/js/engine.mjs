import { spawnSync } from "node:child_process";
import { accessSync, constants, readdirSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
import { ENGINE_BIN, ENGINE_SOURCE_DIR } from "./constants.mjs";
import { parseEngineOutput } from "./parser.mjs";

function listCppSources(dir) {
  const out = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listCppSources(full));
      continue;
    }
    if (entry.name.endsWith(".cpp") || entry.name.endsWith(".hpp")) {
      out.push(full);
    }
  }

  return out;
}

function needsRebuild(sourceFiles) {
  try {
    accessSync(ENGINE_BIN, constants.X_OK);
  } catch {
    return true;
  }

  const binStat = statSync(ENGINE_BIN);
  return sourceFiles.some((file) => statSync(file).mtimeMs > binStat.mtimeMs);
}

export function ensureEngineBuilt() {
  const sourceFiles = listCppSources(ENGINE_SOURCE_DIR);
  if (sourceFiles.length === 0) {
    throw new Error("No C++ source files found for scheduler engine");
  }

  if (!needsRebuild(sourceFiles)) return;

  const compileTargets = sourceFiles.filter((file) => file.endsWith(".cpp"));
  let compile;
  try {
    compile = spawnSync(
      "clang++",
      ["-std=c++17", "-O2", ...compileTargets, "-o", ENGINE_BIN],
      { encoding: "utf8" }
    );
  } catch (err) {
    // spawnSync may throw if binary isn't found on some platforms/environments
    // Fall through — we'll inspect result below and attempt to use any existing binary.
    compile = { status: null, stderr: String(err), stdout: "" };
  }

  // If compilation failed, try to fall back to any existing engine binary. This
  // helps running on Windows where `clang++` may not be installed. If no binary
  // exists or compilation produced useful output, surface the error.
  if (compile.status !== 0) {
    try {
      // If an existing binary is present, prefer that over failing completely.
      accessSync(ENGINE_BIN, constants.F_OK);
      // eslint-disable-next-line no-console
      console.warn("clang++ not available or compilation failed — using existing scheduler_engine binary if present.");
      return;
    } catch {
      throw new Error(`Failed to compile C++ scheduler:\n${compile.stderr || compile.stdout}`);
    }
  }
}

export function runSchedulerEngine(payload) {
  const processes = Array.isArray(payload.processes) ? payload.processes : [];

  const lines = [
    String(payload.algorithm ?? "FCFS"),
    payload.isPreemptive ? "1" : "0",
    String(Number(payload.contextSwitchTime ?? 0)),
    String(Math.max(1, Number(payload.timeQuantum ?? 1))),
    String(processes.length),
  ];

  for (const process of processes) {
    lines.push(
      [
        process.id ?? "",
        Number(process.arrivalTime ?? 0),
        Number(process.burstTime ?? 0),
        process.priority === undefined || process.priority === null ? "NA" : Number(process.priority),
        process.color ?? "",
      ].join("|")
    );
  }

  // Attempt to execute the engine. On Windows the bundled binary may be a
  // Linux ELF executable (for example if it was built on Linux and checked
  // into the repo). In that case, attempt to run it through WSL (if
  // available). Fall back to spawning the native binary directly.
  let exec;

  // Helper: try running via WSL when on Windows and the binary looks like ELF
  if (process.platform === "win32") {
    try {
      const header = readFileSync(ENGINE_BIN, { encoding: null, length: 4 });
      // ELF magic: 0x7f 'E' 'L' 'F'
        if (
        header[0] === 0x7f &&
        header[1] === 0x45 &&
        header[2] === 0x4c &&
        header[3] === 0x46
      ) {
        // Convert Windows path to WSL path: C:\a\b -> /mnt/c/a/b
        const winPath = ENGINE_BIN;
        const drive = winPath[0].toLowerCase();
        let rest = winPath.slice(2).replace(/\\/g, "/");
        if (rest.startsWith("/")) rest = rest.slice(1);
        const wslPath = `/mnt/${drive}/${rest}`;

        // Try a named distro first (Ubuntu), then fall back to generic `wsl`.
        // Some environments (Docker Desktop) register a distro that doesn't
        // provide /bin/bash and cause `wsl <cmd>` to fail — specifying `-d
        // Ubuntu` avoids that when Ubuntu is installed.
        try {
          exec = spawnSync("wsl", ["-d", "Ubuntu", wslPath], {
            input: `${lines.join("\n")}\n`,
            encoding: "utf8",
          });
          // If ubuntu attempt produced a clear ENOENT or similar, fall back
          // to plain wsl invocation.
          if (!exec || exec.error) {
            exec = spawnSync("wsl", [wslPath], {
              input: `${lines.join("\n")}\n`,
              encoding: "utf8",
            });
          }
        } catch (err) {
          // Ignore and let the generic spawn below handle the error.
          exec = undefined;
        }
      }
    } catch (err) {
      // If reading the binary or running WSL fails, we'll fall back to trying
      // to spawn the binary directly and then surface a helpful error.
      exec = undefined;
    }
  }

  if (!exec) {
    exec = spawnSync(ENGINE_BIN, {
      input: `${lines.join("\n")}\n`,
      encoding: "utf8",
    });
  }

  // If the spawn failed to start the process, Node will set exec.error.
  if (exec.error) {
    // Common causes: binary missing, wrong platform/format (macOS/Linux binary on Windows),
    // or permission issues. Try to provide a clearer hint based on the file header
    // when possible.
    const cause = exec.error.code || exec.error.message || String(exec.error);
    let detected = null;
    try {
      // If the file exists, read its magic bytes to guess platform/format.
      accessSync(ENGINE_BIN, constants.F_OK);
      const hdr = readFileSync(ENGINE_BIN, { encoding: null, length: 4 });
      if (hdr && hdr.length >= 4) {
        const b0 = hdr[0], b1 = hdr[1], b2 = hdr[2], b3 = hdr[3];
        // ELF "\x7FELF"
        if (b0 === 0x7f && b1 === 0x45 && b2 === 0x4c && b3 === 0x46) detected = "ELF (Linux) binary";
        // PE/MZ
        else if (b0 === 0x4d && b1 === 0x5a) detected = "PE/Windows (MZ) binary";
        // Mach-O (multiple magic possibilities)
        else if ((b0 === 0xcf && b1 === 0xfa && b2 === 0xed && b3 === 0xfe) || // 0xCFFAEDFE (fat/mach-o)
                 (b0 === 0xfe && b1 === 0xed && b2 === 0xfa && b3 === 0xce) || // 0xFEEDFACE
                 (b0 === 0xce && b1 === 0xfa && b2 === 0xed && b3 === 0xfe) || // 0xCEFAEDFE
                 (b0 === 0xca && b1 === 0xfe && b2 === 0xba && b3 === 0xbe)) detected = "Mach-O (macOS) binary";
      }
    } catch (e) {
      // ignore read errors - we'll still surface the original cause below
    }

    let help = "Common fixes: ensure a native scheduler binary exists and is executable, or build it from source.\n" +
      "- On Windows: install LLVM/Clang (clang++) and run `npm run build:backend`, or use WSL to build/run the project.\n" +
      "- If you already have a binary, ensure it's named `backend/scheduler_engine` (or update BACKEND_DIR/ENGINE_BIN) and is executable.\n";

    if (detected) {
      help = `Detected bundled binary type: ${detected}.\n` +
        (detected.includes("Mach-O")
          ? "This looks like a macOS binary — it cannot be executed on Windows. Rebuild a Windows binary or run the backend inside WSL/macOS.\n"
          : detected.includes("ELF")
          ? "This looks like a Linux binary — on Windows you can run it via WSL, or build a native Windows binary.\n"
          : "");
      help += "Otherwise follow the general fixes: install/build a native binary as described above.\n";
    }

    throw new Error(
      `C++ scheduler execution failed: ${cause}.\n${help}` +
        (exec.stderr ? `\nCompiler/runtime stderr:\n${exec.stderr}` : "")
    );
  }

  if (exec.status !== 0) {
    throw new Error(exec.stderr?.trim() || exec.stdout || "C++ scheduler execution failed");
  }

  return parseEngineOutput(exec.stdout);
}

export function buildComparison(payload) {
  const base = {
    processes: payload.processes,
    contextSwitchTime: payload.contextSwitchTime,
    timeQuantum: payload.timeQuantum,
  };

  return {
    FCFS: runSchedulerEngine({ ...base, algorithm: "FCFS", isPreemptive: false }),
    "SJF (Non-Preemptive)": runSchedulerEngine({ ...base, algorithm: "SJF", isPreemptive: false }),
    "SJF (Preemptive)": runSchedulerEngine({ ...base, algorithm: "SJF", isPreemptive: true }),
    "Priority (Non-Preemptive)": runSchedulerEngine({ ...base, algorithm: "Priority", isPreemptive: false }),
    "Priority (Preemptive)": runSchedulerEngine({ ...base, algorithm: "Priority", isPreemptive: true }),
    "Round Robin": runSchedulerEngine({ ...base, algorithm: "RR", isPreemptive: false }),
  };
}

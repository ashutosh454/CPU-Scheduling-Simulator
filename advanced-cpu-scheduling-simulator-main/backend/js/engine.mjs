import { spawnSync } from "node:child_process";
import { accessSync, constants, readdirSync, statSync } from "node:fs";
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
  const compile = spawnSync(
    "clang++",
    ["-std=c++17", "-O2", ...compileTargets, "-o", ENGINE_BIN],
    { encoding: "utf8" }
  );

  if (compile.status !== 0) {
    throw new Error(`Failed to compile C++ scheduler:\n${compile.stderr || compile.stdout}`);
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

  const exec = spawnSync(ENGINE_BIN, {
    input: `${lines.join("\n")}\n`,
    encoding: "utf8",
  });

  if (exec.status !== 0) {
    throw new Error(exec.stderr?.trim() || "C++ scheduler execution failed");
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

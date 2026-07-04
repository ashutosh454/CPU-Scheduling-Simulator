#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from 'node:url';

function listCpp(dir) {
  const out = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listCpp(full));
    else if (e.name.endsWith('.cpp')) out.push(full);
  }
  return out;
}

function tryCompile(cmd, args, env) {
  console.log(`Trying: ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: { ...process.env, ...(env || {}) } });
  if (r.error) {
    console.error(`spawn error for ${cmd}:`, r.error && r.error.message ? r.error.message : r.error);
    return { ok: false, r };
  }
  console.log(`status=${r.status}`);
  if (r.stdout) console.log('stdout:', r.stdout);
  if (r.stderr) console.error('stderr:', r.stderr);
  return { ok: r.status === 0, r };
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const backendDir = path.join(__dirname, '..');
  const srcDir = path.join(backendDir, 'cpp');
  const outBin = path.join(backendDir, process.platform === 'win32' ? 'scheduler_engine.exe' : 'scheduler_engine');

  const sources = listCpp(srcDir);
  if (sources.length === 0) {
    console.error('No C++ sources found in', srcDir);
    process.exit(1);
  }

  // Try clang++
  const clangArgs = ['-std=c++17', '-O2', ...sources, '-o', outBin];
  let res = tryCompile('clang++', clangArgs);
  if (res.ok) {
    console.log('Built with clang++ ->', outBin);
    process.exit(0);
  }

  // Try g++
  const gppArgs = ['-std=c++17', '-O2', ...sources, '-o', outBin];
  res = tryCompile('g++', gppArgs);
  if (res.ok) {
    console.log('Built with g++ ->', outBin);
    process.exit(0);
  }

  // Try MSVC (cl.exe) on Windows. This requires MSVC dev environment to be set.
  if (process.platform === 'win32') {
    // Prepare cl arguments: /EHsc for C++ exceptions, /O2 for optimization
    const clArgs = ['/EHsc', '/O2', '/std:c++17'];
    // Output name via /Fe
    clArgs.push('/Fe:' + outBin);
    // Add all source files
    for (const s of sources) clArgs.push(s);

    res = tryCompile('cl.exe', clArgs);
    if (res.ok) {
      console.log('Built with cl.exe ->', outBin);
      process.exit(0);
    }
  }

  console.error('\nAll compiler attempts failed. Summary:');
  console.error(' - clang++ status:', res && res.r ? res.r.status : 'n/a');
  console.error(' - g++ tried (if present) above.');
  console.error(' - cl.exe tried on Windows (if present) above.');
  console.error('\nPlease install a C++ toolchain on your system and re-run:');
  console.error(' - On Windows: install LLVM (clang) or Visual Studio (MSVC) or MinGW (g++).');
  console.error(' - Or use WSL with clang/g++: build inside WSL and run backend from Windows (the server attempts to run ELF via WSL).');
  process.exit(1);
}

main();

function parseNumber(raw) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function parseOptionalNumber(raw) {
  if (raw === "NA" || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function parseEngineOutput(stdout) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length || lines[0] !== "OK") {
    throw new Error("Unexpected scheduler output");
  }

  const metricsLine = lines[1]?.split("|");
  if (!metricsLine || metricsLine[0] !== "METRICS") {
    throw new Error("Missing metrics from scheduler output");
  }

  const ganttHeader = lines[2]?.split("|");
  if (!ganttHeader || ganttHeader[0] !== "GANTT") {
    throw new Error("Missing gantt header from scheduler output");
  }

  const ganttCount = parseInt(ganttHeader[1], 10);
  let cursor = 3;
  const ganttChart = [];

  for (let i = 0; i < ganttCount; i += 1) {
    const parts = lines[cursor++]?.split("|") ?? [];
    if (parts[0] !== "G") {
      throw new Error("Malformed gantt row from scheduler output");
    }

    ganttChart.push({
      processId: parts[1],
      startTime: parseNumber(parts[2]),
      endTime: parseNumber(parts[3]),
      color: parts[4] || undefined,
    });
  }

  const processHeader = lines[cursor++]?.split("|");
  if (!processHeader || processHeader[0] !== "PROCESSES") {
    throw new Error("Missing process header from scheduler output");
  }

  const processCount = parseInt(processHeader[1], 10);
  const processes = [];

  for (let i = 0; i < processCount; i += 1) {
    const parts = lines[cursor++]?.split("|") ?? [];
    if (parts[0] !== "P") {
      throw new Error("Malformed process row from scheduler output");
    }

    processes.push({
      id: parts[1],
      arrivalTime: parseNumber(parts[2]),
      burstTime: parseNumber(parts[3]),
      priority: parseOptionalNumber(parts[4]),
      color: parts[5] || undefined,
      remainingTime: parseOptionalNumber(parts[6]),
      startTime: parseOptionalNumber(parts[7]),
      completionTime: parseOptionalNumber(parts[8]),
      waitingTime: parseOptionalNumber(parts[9]),
      turnaroundTime: parseOptionalNumber(parts[10]),
      responseTime: parseOptionalNumber(parts[11]),
    });
  }

  return {
    ganttChart,
    processes,
    averageWaitingTime: parseNumber(metricsLine[1]),
    averageTurnaroundTime: parseNumber(metricsLine[2]),
    averageResponseTime: parseNumber(metricsLine[3]),
    cpuUtilization: parseNumber(metricsLine[4]),
    throughput: parseNumber(metricsLine[5]),
  };
}

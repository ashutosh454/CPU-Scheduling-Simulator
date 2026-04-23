import { Process, SchedulerResult } from "@/lib/schedulers";

async function postJson<T>(url: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Scheduler API request failed");
  }

  return data as T;
}

export async function runSchedulerApi(
  algorithm: string,
  processes: Process[],
  isPreemptive = false,
  contextSwitchTime = 0,
  timeQuantum = 1
): Promise<SchedulerResult> {
  return postJson<SchedulerResult>("/api/simulate", {
    algorithm,
    processes,
    isPreemptive,
    contextSwitchTime,
    timeQuantum,
  });
}

export async function compareAlgorithmsApi(
  processes: Process[],
  contextSwitchTime = 0,
  timeQuantum = 1
): Promise<Record<string, SchedulerResult>> {
  return postJson<Record<string, SchedulerResult>>("/api/compare", {
    processes,
    contextSwitchTime,
    timeQuantum,
  });
}

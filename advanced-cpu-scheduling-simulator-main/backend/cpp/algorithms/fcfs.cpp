#include "algorithms.hpp"

#include <algorithm>

namespace {
double safeDivide(double a, double b) {
  if (b == 0) return 0;
  return a / b;
}
}  // namespace

SchedulerResult fcfs(const std::vector<Process>& processes, int contextSwitchTime) {
  std::vector<Process> sortedProcesses = processes;
  std::stable_sort(sortedProcesses.begin(), sortedProcesses.end(), [](const Process& a, const Process& b) {
    return a.arrivalTime < b.arrivalTime;
  });

  SchedulerResult result;
  int currentTime = 0;
  double totalWaitingTime = 0;
  double totalTurnaroundTime = 0;
  double totalResponseTime = 0;
  double totalBurstTime = 0;

  for (size_t i = 0; i < sortedProcesses.size(); ++i) {
    Process p = sortedProcesses[i];

    if (currentTime < p.arrivalTime) {
      currentTime = p.arrivalTime;
    }

    p.startTime = currentTime;
    p.responseTime = currentTime - p.arrivalTime;
    p.completionTime = currentTime + p.burstTime;
    p.waitingTime = currentTime - p.arrivalTime;
    p.turnaroundTime = p.completionTime - p.arrivalTime;
    p.remainingTime = 0;

    result.ganttChart.push_back({p.id, currentTime, p.completionTime, p.color});

    currentTime = p.completionTime;
    if (i < sortedProcesses.size() - 1) {
      currentTime += contextSwitchTime;
    }

    totalWaitingTime += p.waitingTime;
    totalTurnaroundTime += p.turnaroundTime;
    totalResponseTime += p.responseTime;
    totalBurstTime += p.burstTime;

    result.processes.push_back(p);
  }

  if (!sortedProcesses.empty()) {
    result.averageWaitingTime = totalWaitingTime / sortedProcesses.size();
    result.averageTurnaroundTime = totalTurnaroundTime / sortedProcesses.size();
    result.averageResponseTime = totalResponseTime / sortedProcesses.size();
    result.cpuUtilization = safeDivide(totalBurstTime, currentTime) * 100.0;
    result.throughput = safeDivide(sortedProcesses.size(), currentTime);
  }

  return result;
}

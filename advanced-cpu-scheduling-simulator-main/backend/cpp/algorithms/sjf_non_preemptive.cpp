#include "algorithms.hpp"

#include <limits>

namespace {
int findMetricIndex(const std::vector<Process>& metrics, const std::string& id) {
  for (size_t i = 0; i < metrics.size(); ++i) {
    if (metrics[i].id == id) return static_cast<int>(i);
  }
  return -1;
}

double safeDivide(double a, double b) {
  if (b == 0) return 0;
  return a / b;
}
}  // namespace

SchedulerResult sjfNonPreemptive(const std::vector<Process>& processes, int contextSwitchTime) {
  std::vector<Process> pool = processes;
  for (auto& p : pool) p.remainingTime = p.burstTime;

  std::vector<Process> metrics = processes;
  for (auto& p : metrics) p.remainingTime = p.burstTime;

  SchedulerResult result;
  int currentTime = 0;
  int completed = 0;
  double totalWaitingTime = 0;
  double totalTurnaroundTime = 0;
  double totalResponseTime = 0;
  double totalBurstTime = 0;

  while (completed < static_cast<int>(processes.size())) {
    int selectedIdx = -1;
    int shortest = std::numeric_limits<int>::max();

    for (size_t i = 0; i < pool.size(); ++i) {
      if (pool[i].arrivalTime <= currentTime && pool[i].remainingTime > 0 && pool[i].remainingTime < shortest) {
        shortest = pool[i].remainingTime;
        selectedIdx = static_cast<int>(i);
      }
    }

    if (selectedIdx == -1) {
      currentTime++;
      continue;
    }

    Process& selected = pool[selectedIdx];
    Process& m = metrics[findMetricIndex(metrics, selected.id)];

    if (m.startTime < 0) {
      m.startTime = currentTime;
      m.responseTime = currentTime - m.arrivalTime;
    }

    result.ganttChart.push_back({selected.id, currentTime, currentTime + selected.remainingTime, selected.color});

    currentTime += selected.remainingTime;
    m.completionTime = currentTime;
    m.turnaroundTime = m.completionTime - m.arrivalTime;
    m.waitingTime = m.turnaroundTime - m.burstTime;
    m.remainingTime = 0;

    if (completed < static_cast<int>(processes.size()) - 1) {
      currentTime += contextSwitchTime;
    }

    totalWaitingTime += m.waitingTime;
    totalTurnaroundTime += m.turnaroundTime;
    totalResponseTime += m.responseTime;
    totalBurstTime += m.burstTime;

    selected.remainingTime = 0;
    completed++;
  }

  result.processes = metrics;

  if (!processes.empty()) {
    result.averageWaitingTime = totalWaitingTime / processes.size();
    result.averageTurnaroundTime = totalTurnaroundTime / processes.size();
    result.averageResponseTime = totalResponseTime / processes.size();
    result.cpuUtilization = safeDivide(totalBurstTime, currentTime) * 100.0;
    result.throughput = safeDivide(processes.size(), currentTime);
  }

  return result;
}

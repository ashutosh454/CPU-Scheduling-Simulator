#include "algorithms.hpp"

#include <algorithm>
#include <limits>

namespace {
int findMetricIndex(const std::vector<Process>& metrics, const std::string& id) {
  for (size_t i = 0; i < metrics.size(); ++i) {
    if (metrics[i].id == id) return static_cast<int>(i);
  }
  return -1;
}

int selectHighestPriority(const std::vector<Process>& pool, int currentTime) {
  int selectedIdx = -1;
  int highestPriority = std::numeric_limits<int>::max();

  for (size_t i = 0; i < pool.size(); ++i) {
    if (pool[i].arrivalTime <= currentTime && pool[i].remainingTime > 0 && pool[i].priority < highestPriority) {
      highestPriority = pool[i].priority;
      selectedIdx = static_cast<int>(i);
    }
  }

  return selectedIdx;
}

double safeDivide(double a, double b) {
  if (b == 0) return 0;
  return a / b;
}

void normalizePriority(std::vector<Process>& items) {
  for (auto& p : items) {
    p.remainingTime = p.burstTime;
    if (!p.hasPriority) p.priority = std::numeric_limits<int>::max();
  }
}
}  // namespace

SchedulerResult priorityPreemptive(const std::vector<Process>& processes, int contextSwitchTime) {
  std::vector<Process> pool = processes;
  std::vector<Process> metrics = processes;
  normalizePriority(pool);
  normalizePriority(metrics);

  SchedulerResult result;
  int currentTime = std::numeric_limits<int>::max();
  for (const auto& p : processes) currentTime = std::min(currentTime, p.arrivalTime);
  if (currentTime == std::numeric_limits<int>::max()) currentTime = 0;

  int completed = 0;
  int prevIdx = -1;
  double totalWaitingTime = 0;
  double totalTurnaroundTime = 0;
  double totalResponseTime = 0;
  double totalBurstTime = 0;

  while (completed < static_cast<int>(processes.size())) {
    int selectedIdx = selectHighestPriority(pool, currentTime);

    if (selectedIdx == -1) {
      currentTime++;
      continue;
    }

    if (prevIdx != -1 && prevIdx != selectedIdx) {
      int reevaluatedIdx = selectHighestPriority(pool, currentTime + contextSwitchTime);
      if (reevaluatedIdx != prevIdx) {
        currentTime += contextSwitchTime;
        selectedIdx = reevaluatedIdx;
      } else {
        selectedIdx = prevIdx;
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

    int nextArrival = std::numeric_limits<int>::max();
    for (const auto& p : pool) {
      if (p.arrivalTime > currentTime && p.remainingTime > 0) {
        nextArrival = std::min(nextArrival, p.arrivalTime);
      }
    }

    int completion = currentTime + selected.remainingTime;
    int runUntil = (nextArrival < completion && nextArrival != std::numeric_limits<int>::max()) ? nextArrival : completion;

    result.ganttChart.push_back({selected.id, currentTime, runUntil, selected.color});

    int executed = runUntil - currentTime;
    selected.remainingTime -= executed;
    m.remainingTime -= executed;

    if (selected.remainingTime == 0) {
      completed++;
      m.completionTime = runUntil;
      m.turnaroundTime = m.completionTime - m.arrivalTime;
      m.waitingTime = m.turnaroundTime - m.burstTime;

      totalWaitingTime += m.waitingTime;
      totalTurnaroundTime += m.turnaroundTime;
      totalResponseTime += m.responseTime;
      totalBurstTime += m.burstTime;
    }

    prevIdx = selectedIdx;
    currentTime = runUntil;
  }

  result.processes = metrics;

  if (!processes.empty()) {
    result.averageWaitingTime = totalWaitingTime / processes.size();
    result.averageTurnaroundTime = totalTurnaroundTime / processes.size();
    result.averageResponseTime = totalResponseTime / processes.size();

    int maxCompletion = 0;
    int minArrival = std::numeric_limits<int>::max();
    for (const auto& p : result.processes) {
      maxCompletion = std::max(maxCompletion, p.completionTime);
      minArrival = std::min(minArrival, p.arrivalTime);
    }
    int totalExecutionTime = maxCompletion - minArrival;
    result.cpuUtilization = safeDivide(totalBurstTime, totalExecutionTime) * 100.0;
    result.throughput = safeDivide(processes.size(), totalExecutionTime);
  }

  return result;
}

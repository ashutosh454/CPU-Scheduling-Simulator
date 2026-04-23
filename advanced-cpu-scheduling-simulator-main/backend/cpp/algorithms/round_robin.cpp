#include "algorithms.hpp"

#include <algorithm>
#include <deque>
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

void enqueueArrivals(
    const std::vector<Process>& pool,
    std::deque<int>& readyQueue,
    size_t& nextArrivalIdx,
    int currentTime) {
  while (nextArrivalIdx < pool.size() && pool[nextArrivalIdx].arrivalTime <= currentTime) {
    if (pool[nextArrivalIdx].remainingTime > 0) {
      readyQueue.push_back(static_cast<int>(nextArrivalIdx));
    }
    ++nextArrivalIdx;
  }
}
}  // namespace

SchedulerResult roundRobin(const std::vector<Process>& processes, int timeQuantum, int contextSwitchTime) {
  std::vector<Process> pool = processes;
  std::vector<Process> metrics = processes;
  for (auto& p : pool) p.remainingTime = p.burstTime;
  for (auto& p : metrics) p.remainingTime = p.burstTime;

  SchedulerResult result;

  if (pool.empty()) {
    result.processes = metrics;
    return result;
  }

  std::sort(pool.begin(), pool.end(), [](const Process& a, const Process& b) {
    return a.arrivalTime < b.arrivalTime;
  });

  int currentTime = pool[0].arrivalTime;
  size_t nextArrivalIdx = 0;
  int completed = 0;
  double totalWaitingTime = 0;
  double totalTurnaroundTime = 0;
  double totalResponseTime = 0;
  double totalBurstTime = 0;

  std::deque<int> readyQueue;
  enqueueArrivals(pool, readyQueue, nextArrivalIdx, currentTime);

  int prevMetricIdx = -1;

  while (completed < static_cast<int>(processes.size())) {
    if (readyQueue.empty()) {
      if (nextArrivalIdx >= pool.size()) break;
      currentTime = std::max(currentTime, pool[nextArrivalIdx].arrivalTime);
      enqueueArrivals(pool, readyQueue, nextArrivalIdx, currentTime);
    }

    int queueIdx = readyQueue.front();
    readyQueue.pop_front();
    Process& current = pool[queueIdx];

    int metricIdx = findMetricIndex(metrics, current.id);

    if (prevMetricIdx != -1 && prevMetricIdx != metricIdx) {
      currentTime += contextSwitchTime;
      enqueueArrivals(pool, readyQueue, nextArrivalIdx, currentTime);
    }

    Process& m = metrics[metricIdx];

    if (m.startTime < 0) {
      m.startTime = currentTime;
      m.responseTime = currentTime - m.arrivalTime;
    }

    int execTime = std::min(timeQuantum, current.remainingTime);

    result.ganttChart.push_back({current.id, currentTime, currentTime + execTime, current.color});

    currentTime += execTime;
    current.remainingTime -= execTime;
    m.remainingTime -= execTime;
    enqueueArrivals(pool, readyQueue, nextArrivalIdx, currentTime);

    if (current.remainingTime == 0) {
      completed++;
      m.completionTime = currentTime;
      m.turnaroundTime = m.completionTime - m.arrivalTime;
      m.waitingTime = m.turnaroundTime - m.burstTime;

      totalWaitingTime += m.waitingTime;
      totalTurnaroundTime += m.turnaroundTime;
      totalResponseTime += m.responseTime;
      totalBurstTime += m.burstTime;
    } else {
      readyQueue.push_back(queueIdx);
    }

    prevMetricIdx = metricIdx;
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

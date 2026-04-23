#pragma once

#include <limits>
#include <string>
#include <vector>

struct Process {
  std::string id;
  int arrivalTime = 0;
  int burstTime = 0;
  int priority = std::numeric_limits<int>::max();
  bool hasPriority = false;
  std::string color;

  int remainingTime = 0;
  int startTime = -1;
  int completionTime = -1;
  int waitingTime = -1;
  int turnaroundTime = -1;
  int responseTime = -1;
};

struct GanttItem {
  std::string processId;
  int startTime = 0;
  int endTime = 0;
  std::string color;
};

struct SchedulerResult {
  std::vector<GanttItem> ganttChart;
  std::vector<Process> processes;
  double averageWaitingTime = 0;
  double averageTurnaroundTime = 0;
  double averageResponseTime = 0;
  double cpuUtilization = 0;
  double throughput = 0;
};

struct InputPayload {
  std::string algorithm;
  bool isPreemptive = false;
  int contextSwitchTime = 0;
  int timeQuantum = 1;
  std::vector<Process> processes;
};

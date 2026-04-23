#include "scheduler_dispatch.hpp"

#include <stdexcept>

#include "algorithms/algorithms.hpp"

SchedulerResult runScheduler(const InputPayload& in) {
  if (in.algorithm == "FCFS") {
    return fcfs(in.processes, in.contextSwitchTime);
  }
  if (in.algorithm == "SJF") {
    return in.isPreemptive ? sjfPreemptive(in.processes, in.contextSwitchTime)
                           : sjfNonPreemptive(in.processes, in.contextSwitchTime);
  }
  if (in.algorithm == "Priority") {
    return in.isPreemptive ? priorityPreemptive(in.processes, in.contextSwitchTime)
                           : priorityNonPreemptive(in.processes, in.contextSwitchTime);
  }
  if (in.algorithm == "RR") {
    return roundRobin(in.processes, in.timeQuantum, in.contextSwitchTime);
  }

  throw std::runtime_error("Unknown algorithm");
}

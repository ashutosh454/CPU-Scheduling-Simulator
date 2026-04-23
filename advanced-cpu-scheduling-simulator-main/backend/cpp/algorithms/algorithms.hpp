#pragma once

#include "../types.hpp"

SchedulerResult fcfs(const std::vector<Process>& processes, int contextSwitchTime);
SchedulerResult sjfNonPreemptive(const std::vector<Process>& processes, int contextSwitchTime);
SchedulerResult sjfPreemptive(const std::vector<Process>& processes, int contextSwitchTime);
SchedulerResult priorityNonPreemptive(const std::vector<Process>& processes, int contextSwitchTime);
SchedulerResult priorityPreemptive(const std::vector<Process>& processes, int contextSwitchTime);
SchedulerResult roundRobin(const std::vector<Process>& processes, int timeQuantum, int contextSwitchTime);

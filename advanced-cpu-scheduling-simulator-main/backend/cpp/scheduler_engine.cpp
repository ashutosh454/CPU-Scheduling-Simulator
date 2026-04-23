#include "scheduler_engine.hpp"

#include <algorithm>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "scheduler_dispatch.hpp"
#include "types.hpp"

namespace {
std::vector<std::string> split(const std::string& s, char delim) {
  std::vector<std::string> out;
  std::string part;
  std::stringstream ss(s);
  while (std::getline(ss, part, delim)) {
    out.push_back(part);
  }
  if (!s.empty() && s.back() == delim) {
    out.push_back("");
  }
  return out;
}

int parseInt(const std::string& s) {
  return std::stoi(s);
}

std::string optIntToString(int value) {
  return value < 0 ? "NA" : std::to_string(value);
}

std::string priorityToString(const Process& p) {
  return p.hasPriority ? std::to_string(p.priority) : "NA";
}

InputPayload readInput(std::istream& inStream) {
  InputPayload in;
  std::string line;

  if (!std::getline(inStream, line)) throw std::runtime_error("Missing algorithm");
  in.algorithm = line;

  if (!std::getline(inStream, line)) throw std::runtime_error("Missing isPreemptive");
  in.isPreemptive = (line == "1");

  if (!std::getline(inStream, line)) throw std::runtime_error("Missing contextSwitchTime");
  in.contextSwitchTime = parseInt(line);

  if (!std::getline(inStream, line)) throw std::runtime_error("Missing timeQuantum");
  in.timeQuantum = std::max(1, parseInt(line));

  if (!std::getline(inStream, line)) throw std::runtime_error("Missing process count");
  int n = parseInt(line);

  in.processes.reserve(n);
  for (int i = 0; i < n; ++i) {
    if (!std::getline(inStream, line)) throw std::runtime_error("Missing process row");
    auto parts = split(line, '|');
    if (parts.size() < 5) throw std::runtime_error("Malformed process row");

    Process p;
    p.id = parts[0];
    p.arrivalTime = parseInt(parts[1]);
    p.burstTime = parseInt(parts[2]);
    if (parts[3] != "NA") {
      p.hasPriority = true;
      p.priority = parseInt(parts[3]);
    }
    p.color = parts[4];
    p.remainingTime = p.burstTime;
    in.processes.push_back(p);
  }

  return in;
}

void writeOutput(std::ostream& outStream, const SchedulerResult& r) {
  outStream << "OK\n";
  outStream << std::fixed << std::setprecision(6);
  outStream << "METRICS|" << r.averageWaitingTime << "|" << r.averageTurnaroundTime << "|"
            << r.averageResponseTime << "|" << r.cpuUtilization << "|" << r.throughput << "\n";

  outStream << "GANTT|" << r.ganttChart.size() << "\n";
  for (const auto& g : r.ganttChart) {
    outStream << "G|" << g.processId << "|" << g.startTime << "|" << g.endTime << "|" << g.color << "\n";
  }

  outStream << "PROCESSES|" << r.processes.size() << "\n";
  for (const auto& p : r.processes) {
    outStream << "P|" << p.id << "|" << p.arrivalTime << "|" << p.burstTime << "|"
              << priorityToString(p) << "|" << p.color << "|" << p.remainingTime << "|"
              << optIntToString(p.startTime) << "|" << optIntToString(p.completionTime) << "|"
              << optIntToString(p.waitingTime) << "|" << optIntToString(p.turnaroundTime) << "|"
              << optIntToString(p.responseTime) << "\n";
  }
}
}  // namespace

int runSchedulerCli(std::istream& inStream, std::ostream& outStream, std::ostream& errStream) {
  try {
    InputPayload in = readInput(inStream);
    SchedulerResult r = runScheduler(in);
    writeOutput(outStream, r);
    return 0;
  } catch (const std::exception& e) {
    errStream << e.what() << "\n";
    return 1;
  }
}

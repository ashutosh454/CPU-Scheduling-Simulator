#include "scheduler_engine.hpp"

#include <iostream>

int main() {
  std::ios::sync_with_stdio(false);
  std::cin.tie(nullptr);

  return runSchedulerCli(std::cin, std::cout, std::cerr);
}

import path from 'node:path';
import { runSchedulerEngine } from '../backend/js/engine.mjs';

(async () => {
  try {
    const result = runSchedulerEngine({
      algorithm: 'FCFS',
      isPreemptive: false,
      contextSwitchTime: 0,
      timeQuantum: 1,
      processes: [
        { id: 'p1', arrivalTime: 0, burstTime: 5 },
      ],
    });
    console.log('RESULT:', result);
  } catch (e) {
    console.error('ERROR (engine test):', e.message);
    process.exit(1);
  }
})();

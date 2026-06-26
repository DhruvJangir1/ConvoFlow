/* eslint-disable @typescript-eslint/no-explicit-any */
import client from 'prom-client';
import { pool } from './connectionPoolClient'; // Your existing PG pool instance

// 1. Initialize Prometheus default system metrics (CPU, RAM, Event Loop lag of the Node process)
client.collectDefaultMetrics();

// 2. Define Custom PostgreSQL Pool Gauges
const poolTotalGauge = new client.Gauge({
  name: 'pg_pool_connections_total',
  help: 'Total number of connections currently allocated in the pool',
});

const poolIdleGauge = new client.Gauge({
  name: 'pg_pool_connections_idle',
  help: 'Number of idle connections sitting unused in the pool',
});

const poolWaitingGauge = new client.Gauge({
  name: 'pg_pool_clients_waiting',
  help: 'Number of application requests queued up waiting for a connection slot',
});

// 3. Define Query Duration Histogram
const queryDuration = new client.Histogram({
  name: 'pg_query_duration_seconds',
  help: 'PostgreSQL query execution duration distribution in seconds',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5], // 1ms to 5s buckets
});

// 4. Synchronize state periodically (Every 5 seconds)
setInterval(() => {
  poolTotalGauge.set(pool.totalCount);
  poolIdleGauge.set(pool.idleCount);
  poolWaitingGauge.set(pool.waitingCount);
}, 5000);

// 5. Utility Wrapper to measure query runtimes safely
export async function timedQuery(text: string, params?: any[]): Promise<any> {
  // Use a high-res timer for sub-millisecond precision
  const start = process.hrtime();
  
  try {
    return await pool.query(text, params);
  } finally { // <--- Fixed: Removed the accidental 'Wilkinson:' text here
    // Calculate precise delta in seconds
    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;
    
    queryDuration.observe(durationInSeconds);
  }
}
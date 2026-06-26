/* eslint-disable @typescript-eslint/no-explicit-any */
import { pool } from './connectionPoolClient'

/**
 * Handles graceful draining of active database sockets before process exit
 */
async function gracefulShutdown(): Promise<void> {
  console.log('SIGTERM/SIGINT signal received. Shutting down database connections safely...');

  const timeoutMillis = 30000; // 30 seconds max window to drain active wires
  const start = Date.now();

  // Poll the pool state metrics
  // pool.totalCount: Every allocated connection socket inside the pool engine
  // pool.idleCount: Sockets currently sitting unused waiting for tasks
  while (pool.totalCount > pool.idleCount) {
    if (Date.now() - start > timeoutMillis) {
      console.warn('Forcefully terminating: Shutdown timeout reached before active queries drained.');
      break;
    }
    
    // Yield the thread execution block for 100ms before re-checking pool metrics
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  try {
    // Cleanly close all remaining idle connections and notify the Postgres engine
    await pool.end();
    console.log('Database connection pool cleanly destroyed. Safe to exit.');
    process.exit(0);
  } catch (error: any) {
    console.error('Error occurred while destroying connection pool:', error.message);
    process.exit(1);
  }
}

// Register infrastructure lifecycle event listeners
process.on('SIGTERM', gracefulShutdown); // Dispatched by container orchestrators (Docker/K8s)
process.on('SIGINT', gracefulShutdown);  // Dispatched via manual terminal kills (Ctrl+C)
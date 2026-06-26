/* eslint-disable @typescript-eslint/no-explicit-any */
import { pool } from './connectionPoolClient'; // Path to your pool instantiation file

interface HealthCheckResult {
  healthy: boolean;
  error?: string;
}

// Periodic health check - validates pool can execute queries
export async function checkPoolHealth(): Promise<HealthCheckResult> {
  let client;
  try {
    // Acquire a connection from the pool
    client = await pool.connect();
    // Run the absolute lightest query possible to test the socket wire
    await client.query('SELECT 1'); 
    return { healthy: true };
  } catch (error: any) {
    return { healthy: false, error: error.message || 'Unknown database error' };
  } finally {
    // ALWAYS release the client back to the pool, even if the query fails
    if (client) client.release();
  }
}
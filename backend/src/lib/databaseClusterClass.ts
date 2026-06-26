/* eslint-disable @typescript-eslint/no-explicit-any */
import { Pool, PoolClient, QueryResult } from 'pg';

export class DatabaseCluster {
  private primary: Pool;
  private replicas: Pool[];
  private replicaIndex: number = 0;

  constructor() {
    // 1. Shared configuration object - reuse what you already have env-wise
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    };

    // 2. Primary uses the base config
    this.primary = new Pool({ ...dbConfig, max: 5 });

    // 3. Replicas just point to the exact same instance for now
    // No extra envs needed. It simulates a cluster locally.
    this.replicas = [
      new Pool({ ...dbConfig, max: 5 }),
      new Pool({ ...dbConfig, max: 5 })
    ];
  }

  private getReadPool(): Pool {
    const pool = this.replicas[this.replicaIndex];
    this.replicaIndex = (this.replicaIndex + 1) % this.replicas.length;
    return pool;
  }

  async read(text: string, params?: any[]): Promise<QueryResult> {
    return this.getReadPool().query(text, params);
  }

  async write(text: string, params?: any[]): Promise<QueryResult> {
    return this.primary.query(text, params);
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.primary.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async disconnect(): Promise<void> {
    await this.primary.end();
    await Promise.all(this.replicas.map(pool => pool.end()));
  }
}

export const dbCluster = new DatabaseCluster();
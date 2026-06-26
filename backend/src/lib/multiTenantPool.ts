/* eslint-disable @typescript-eslint/no-explicit-any */
import { Pool, PoolConfig, QueryResult } from 'pg';

export class TenantPoolManager {
  private baseConfig: PoolConfig;
  // Strongly typed Map: Key is string (tenantId), Value is pg Pool instance
  private pools: Map<string, Pool>;

  constructor(baseConfig: PoolConfig) {
    this.baseConfig = baseConfig;
    this.pools = new Map<string, Pool>();
  }

  /**
   * Lazily fetches or provisions an isolated connection pool for a specific tenant
   */
  public getPool(tenantId: string): Pool {
    if (!this.pools.has(tenantId)) {
      const tenantPool = new Pool({
        ...this.baseConfig,
        database: `tenant_${tenantId}`, // Complete logical and physical database isolation
        max: 5, // Capped small to prevent application-wide socket exhaustion
        idleTimeoutMillis: 30000, // Automatically tear down sockets for inactive tenants
      });

      this.pools.set(tenantId, tenantPool);
    }

    // Asserting as Pool because the block above guarantees existence
    return this.pools.get(tenantId)!;
  }

  /**
   * Routes and executes SQL text strictly within the target tenant's database boundaries
   */
  public async query(tenantId: string, text: string, params?: any[]): Promise<QueryResult> {
    const pool = this.getPool(tenantId);
    return pool.query(text, params);
  }

  /**
   * Explicitly closes and drops a specific tenant pool from application memory
   */
  public async closePool(tenantId: string): Promise<void> {
    const pool = this.pools.get(tenantId);
    if (pool) {
      await pool.end();
      this.pools.delete(tenantId);
    }
  }

  /**
   * Iterates and drains all active connection sockets across all tenants on server shutdown
   */
  public async closeAll(): Promise<void> {
    const closePromises: Promise<void>[] = [];
    
    for (const pool of this.pools.values()) {
      closePromises.push(pool.end());
    }
    
    await Promise.all(closePromises);
    this.pools.clear();
  }
}
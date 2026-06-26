import os from 'os';

export function calculatePoolSize() {
  // DB_CORE_CPUS = the numbr of core cpus that are running and working on this simultaneously
  const dbCpuCount: number = process.env.DB_CORE_CPUS 
    ? parseInt(process.env.DB_CORE_CPUS, 10) 
    : os.cpus().length;

  // APP_INSTANCES = the number of running servers
  const appInstanceCount: number = process.env.APP_INSTANCES 
    ? parseInt(process.env.APP_INSTANCES, 10) 
    : 1;

  const optimalDbConnections = (dbCpuCount * 2) + 1;

  if (appInstanceCount <= 0) {
    return optimalDbConnections;
  }

  return Math.floor(optimalDbConnections / appInstanceCount);
}


// Project-local ambient module shims to avoid build-time failures when optional
// dependencies or generated clients are not present in the build environment.

declare module '@prisma/client' {
  // Minimal PrismaClient shim for build-time only. Runtime should use the
  // real generated client; this shim prevents `tsc` from failing when the
  // package is not present during image build on VPS.
  export class PrismaClient {
    constructor(arg?: any)
    $disconnect(): Promise<void>
  }
  export const Prisma: any
  export default PrismaClient
}

declare module 'express' {
  // Allow importing `express` in files that are not built in production
  // (metrics server). Provide loose types for build-time.
  const express: any
  export default express
}

declare module '@kubernetes/client-node' {
  const k8s: any
  export = k8s
}

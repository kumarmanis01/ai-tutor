// Next.js middleware entry point.
// All guard logic lives in proxy.ts -- this file wires it into the framework.
export { proxy as middleware, config } from './proxy'

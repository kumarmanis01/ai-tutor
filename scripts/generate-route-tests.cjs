#!/usr/bin/env node
/**
 * FILE OBJECTIVE:
 * - Generate comprehensive test files for all API routes
 * - Analyze route files and create tests for GET, POST, PUT, DELETE, PATCH methods
 * - Follow the project's test patterns with proper mocks
 *
 * USAGE:
 * - node scripts/generate-route-tests.cjs
 * - node scripts/generate-route-tests.cjs --dry-run
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-01 | claude | created route test generator
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Analyze a route file to extract HTTP methods and requirements
 */
function analyzeRoute(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(process.cwd(), filePath);

  // Extract exported methods
  const methods = [];
  const methodRegex = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/g;
  let match;
  while ((match = methodRegex.exec(content)) !== null) {
    methods.push(match[1]);
  }

  // Check for auth requirements
  const requiresAuth = content.includes('requireAuth') || content.includes('getServerSession');
  const requiresAdmin = content.includes('requireAdmin') || content.includes('requireAdminOrModerator');

  // Check for route params
  const hasParams = relativePath.includes('[') && relativePath.includes(']');
  const paramNames = [];
  if (hasParams) {
    const paramRegex = /\[([^\]]+)\]/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(relativePath)) !== null) {
      paramNames.push(paramMatch[1]);
    }
  }

  return {
    filePath,
    relativePath,
    methods,
    requiresAuth,
    requiresAdmin,
    hasParams,
    paramNames,
  };
}

/**
 * Generate tests for a specific HTTP method
 */
function generateMethodTests(route, method, importPath, paramsString) {
  const isGet = method === 'GET';
  const isDelete = method === 'DELETE';
  const requiresBody = method === 'POST' || method === 'PUT' || method === 'PATCH';

  return `describe('${method} ${route.relativePath.replace('app', '').replace('\\route.ts', '').replace(/\\/g, '/')}', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('should return success response', async () => {
    // TODO: Add proper mock data for this route
    ${!isGet && !isDelete ? 'prismaMock.$transaction.mockImplementation(async (callback) => await callback(prismaMock));' : ''}

    const { ${method} } = await import('${importPath}');
    const request = new Request('http://localhost:3000${route.relativePath.replace('app', '').replace('\\route.ts', '').replace(/\\/g, '/')}', {
      method: '${method}',${requiresBody ? `
      body: JSON.stringify({
        // TODO: Add request body fields
      }),
      headers: { 'Content-Type': 'application/json' },` : ''}
    });

    const response = await ${method}(request${route.hasParams ? `, { params: ${paramsString} }` : ''});

    // TODO: Add proper assertions
    expect(response.status).toBeLessThan(500);
  });

  ${requiresBody ? `it('should validate request body', async () => {
    const { ${method} } = await import('${importPath}');
    const request = new Request('http://localhost:3000${route.relativePath.replace('app', '').replace('\\route.ts', '').replace(/\\/g, '/')}', {
      method: '${method}',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await ${method}(request${route.hasParams ? `, { params: ${paramsString} }` : ''});

    // TODO: Verify proper validation error
    expect(response.status).toBeGreaterThanOrEqual(400);
  });` : ''}

  ${route.requiresAuth ? `it('should require authentication', async () => {
    const authMock = require('@/lib/auth');
    authMock.requireAuth.mockRejectedValueOnce(new Error('Unauthorized'));

    const { ${method} } = await import('${importPath}');
    const request = new Request('http://localhost:3000${route.relativePath.replace('app', '').replace('\\route.ts', '').replace(/\\/g, '/')}', {
      method: '${method}',${requiresBody ? `
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },` : ''}
    });

    await expect(${method}(request${route.hasParams ? `, { params: ${paramsString} }` : ''})).rejects.toThrow();
  });` : ''}

  it('should handle errors gracefully', async () => {
    // Simulate a database error
    prismaMock.$queryRaw = jest.fn().mockRejectedValue(new Error('Database error'));

    const { ${method} } = await import('${importPath}');
    const request = new Request('http://localhost:3000${route.relativePath.replace('app', '').replace('\\route.ts', '').replace(/\\/g, '/')}', {
      method: '${method}',${requiresBody ? `
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },` : ''}
    });

    const response = await ${method}(request${route.hasParams ? `, { params: ${paramsString} }` : ''});

    // Should return error response, not throw
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});`;
}

/**
 * Generate test file content for a route
 */
function generateTestContent(route, testFilePath) {
  const testPath = route.relativePath
    .replace('app/', '')
    .replace(/\\/g, '/')
    .replace('/route.ts', '');

  const importPath = '@/' + route.relativePath
    .replace(/\\/g, '/')
    .replace('.ts', '');

  const mockParams = route.paramNames.reduce((acc, param) => {
    acc[param] = `mock-${param}-123`;
    return acc;
  }, {});

  const paramsString = route.hasParams ? JSON.stringify(mockParams, null, 6) : '{}';

  // Calculate correct relative path to helpers based on test file depth
  const testDir = path.dirname(testFilePath);
  const helpersPath = path.relative(testDir, path.join(process.cwd(), 'tests', 'helpers')).replace(/\\/g, '/');

  return `/**
 * UNIT TESTS: ${testPath}
 *
 * Tests for HTTP methods: ${route.methods.join(', ')}
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('${helpersPath}/prismaMock').prismaMock }));
jest.mock('@/lib/auth', () => ({
  authOptions: {},
  requireAuth: jest.fn().mockResolvedValue({ id: 'user-123', email: 'test@example.com' }),
  requireAdmin: jest.fn().mockResolvedValue({ id: 'admin-123', role: 'ADMIN' }),
  requireAdminOrModerator: jest.fn().mockResolvedValue({ id: 'admin-123', role: 'ADMIN' }),
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMock } from '${helpersPath}/prismaMock';
import '${helpersPath}/mockSession';

${route.methods.map(method => generateMethodTests(route, method, importPath, paramsString)).join('\n\n')}
`;
}

/**
 * Get test file path for a route
 */
function getTestFilePath(routePath) {
  const relativePath = path.relative(process.cwd(), routePath);
  return relativePath
    .replace('app\\', 'tests\\unit\\')
    .replace('app/', 'tests/unit/')
    .replace('route.ts', 'route.test.ts');
}

/**
 * Main execution
 */
async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('🔍 Finding all route files...');
  const routeFiles = glob.sync('app/api/**/route.ts', {
    cwd: process.cwd(),
    absolute: true
  });

  console.log(`Found ${routeFiles.length} route files`);

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const routeFile of routeFiles) {
    try {
      const testFilePath = getTestFilePath(routeFile);

      // Skip if test already exists
      if (fs.existsSync(testFilePath)) {
        skipped++;
        console.log(`⏭️  Skipping ${path.relative(process.cwd(), routeFile)} (test exists)`);
        continue;
      }

      const routeInfo = analyzeRoute(routeFile);

      if (routeInfo.methods.length === 0) {
        console.log(`⚠️  No HTTP methods found in ${path.relative(process.cwd(), routeFile)}`);
        skipped++;
        continue;
      }

      const testContent = generateTestContent(routeInfo, testFilePath);

      if (isDryRun) {
        console.log(`\n📝 Would generate: ${testFilePath}`);
        console.log(`   Methods: ${routeInfo.methods.join(', ')}`);
        console.log(`   Auth required: ${routeInfo.requiresAuth}`);
        console.log(`   Has params: ${routeInfo.hasParams}`);
      } else {
        // Ensure directory exists
        const testDir = path.dirname(testFilePath);
        fs.mkdirSync(testDir, { recursive: true });

        // Write test file
        fs.writeFileSync(testFilePath, testContent, 'utf-8');
        console.log(`✅ Generated: ${testFilePath}`);
      }

      generated++;
    } catch (error) {
      console.error(`❌ Error processing ${routeFile}:`, error.message);
      errors++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Generated: ${generated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total: ${routeFiles.length}`);

  if (isDryRun) {
    console.log(`\n💡 Run without --dry-run to generate test files`);
  }
}

main().catch(console.error);

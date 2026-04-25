import ensureMinimumMocks from '@/lib/mock/ensureMocks';

async function main() {
  const res = await ensureMinimumMocks({ minPer: 5, dryRun: true });
  // Print concise summary to stdout for operator verification
  console.log(
    JSON.stringify({ created: res.created.length, details: res.created.slice(0, 10) }, null, 2)
  );
}

main().catch((e) => {
  console.error('run-ensure-mocks failed', String(e));
  process.exit(2);
});

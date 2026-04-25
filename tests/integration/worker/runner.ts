import runMonthlyMisconceptionPrevalence from '@/worker/services/misconceptionPrevalenceWorker';

(async function main() {
  try {
    const res = await runMonthlyMisconceptionPrevalence();
    console.log('misconceptionPrevalence.run_complete', JSON.stringify(res));
    process.exit(0);
  } catch (err) {
    console.error('misconceptionPrevalence.run_error', err);
    process.exit(2);
  }
})();

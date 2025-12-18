module.exports = {
  apps: [
    {
      name: 'alert-evaluator',
      script: 'node',
      args: '--require ts-node/register scripts/runAlertEvaluator.ts',
      cwd: './',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        EVALUATOR_DRY_RUN: '1',
        EVALUATOR_INTERVAL_SEC: '60',
        EVALUATOR_MAX_MS: '10000'
      }
    }
  ]
};

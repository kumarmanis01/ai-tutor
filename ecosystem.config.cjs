module.exports = {
  apps: [
    {
      name: 'ai-tutor-web',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env.production',
      env: {
        NODE_ENV: 'production'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/web-error.log',
      out_file: 'logs/web-out.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'content-engine-worker',
      // Use the compiled worker entry (dist/worker/entry.js) so PM2 runs
      // the bootstrap via Node (no ts-node) in production builds.
      script: 'dist/worker/entry.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      env_file: '.env.production',
      env: {
        NODE_ENV: 'production'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/worker-error.log',
      out_file: 'logs/worker-out.log',
      merge_logs: true,
      time: true
    }
  ]
};

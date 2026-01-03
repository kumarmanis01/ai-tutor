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
      script: 'dist/worker/loop.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
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

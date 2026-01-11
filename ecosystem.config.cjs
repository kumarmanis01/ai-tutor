module.exports = {
  apps: [
    {
      name: 'ai-tutor-web',
      script: 'dist/server.js',
      cwd: __dirname,
      instances: 'max',
      exec_mode: 'cluster',
      env_file: '.env.production',
      env: {
        NODE_ENV: 'production'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/ai-tutor-web-error.log',
      out_file: 'logs/ai-tutor-web-out.log',
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '512M',
      watch: false
    },
    {
      name: 'content-engine-worker',
      script: 'dist/worker/entry.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '256M',
      watch: false,
      env_file: '.env.production',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};

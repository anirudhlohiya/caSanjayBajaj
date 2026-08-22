// PM2 process file for the NestJS API on the EC2 host.
// Reload after deploys:  pm2 startOrReload /opt/ca-app/backend/deploy/ecosystem.config.js && pm2 save
// Logs:                  pm2 logs ca-api
module.exports = {
  apps: [
    {
      name: 'ca-api',
      cwd: '/opt/ca-app/backend',
      script: 'dist/main.js',
      node_args: '--env-file=.env', // Node 22 loads backend/.env natively; secrets never enter this file
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      time: true,
      merge_logs: true,
    },
  ],
};

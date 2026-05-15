const projectRoot = __dirname;

module.exports = {
  apps: [
    {
      name: 'misterf-web',
      cwd: projectRoot,
      script: 'dist/server/server.js',
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      max_memory_restart: '300M',
      time: true,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};

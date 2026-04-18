const path = require('node:path');

const projectRoot = __dirname;

module.exports = {
  apps: [
    {
      name: 'misterf-web',
      cwd: projectRoot,
      script: 'dist/server.js',
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      autorestart: true,
      max_memory_restart: '300M',
      time: true,
      env: {
        NODE_ENV: 'development',
        PORT: '3000',
        DATABASE_PATH: path.join(projectRoot, 'data/misterf.sqlite'),
        GEMINI_API_KEY: 'AIzaSyDpxu5hgbpVnJCSyFMTrxE8FSMOmfIoK38',
        GEMINI_MODEL: 'gemini-2.5-flash',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: '3000',
        DATABASE_PATH: path.join(projectRoot, 'data/misterf.sqlite'),
        GEMINI_API_KEY: 'AIzaSyDpxu5hgbpVnJCSyFMTrxE8FSMOmfIoK38',
        GEMINI_MODEL: 'gemini-2.5-flash',
      },
    },
  ],
};

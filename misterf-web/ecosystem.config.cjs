const projectRoot = __dirname;

const googleOAuthEnv = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
};

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
        ...googleOAuthEnv,
        NODE_ENV: 'development',
      },
      env_production: {
        ...googleOAuthEnv,
        NODE_ENV: 'production',
      },
    },
  ],
};

module.exports = {
  apps: [
    {
      name: 'portal-frontend',
      script: 'npx',
      args: 'vite preview --port 9001 --host 0.0.0.0',
      cwd: __dirname,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
module.exports = {
  apps: [
    {
      name: 'portal-frontend',
      script: 'npx',
      args: 'vite preview --port 9001 --host 0.0.0.0',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

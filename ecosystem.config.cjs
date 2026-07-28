module.exports = {
  apps: [
    {
      name: "portal-frontend",
      cwd: "./Frontend",
      script: "npx",
      args: "vite preview --port 9001 --host 0.0.0.0",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "portal-backend",
      cwd: "./Backend",
      script: "./.venv/bin/uvicorn",
      args: "main:app --host 0.0.0.0 --port 8001",
      interpreter: "none",
      kill_timeout: 5000,
    },
  ],
};

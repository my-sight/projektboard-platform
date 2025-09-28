module.exports = {
  apps: [
    {
      name: "mysight-next",
      script: "npm",
      args: "run start",
      cwd: "/opt/mysight/app",
      env: {
        NODE_ENV: "production",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};

module.exports = {
  apps: [
    {
      name: "devops-backend",
      script: "src/index.js",
      instances: 1,
      exec_mode: "fork",
      // These are the "Engine" commands
      node_args: [
        //"--require /app/src/tracing.js",   // Starts SigNoz Observability
        "--inspect=0.0.0.0:9229"    // Starts V8 Debugging (Port 9229)
      ],
      env: {
        NODE_ENV: process.env.NODE_ENV || "production"
      }
    }
  ]
};

module.exports = {
  apps: [
    {
      name: "devops-backend",
      script: "src/index.js",
      instances: 1,
      exec_mode: "fork",
      // These are the "Engine" commands
      node_args: [ //node_args the command looks like this "node --require /app/src/tracing.js --inspect=
        //"--require /app/src/tracing.js",   // Starts SigNoz Observability. instead require inside your index.js code.
        "--inspect=0.0.0.0:9229"    //allows backend debugging with chrome inspect just like you debug frontend without needing to set up a separate debug server. you can connect to this port from your IDE (like VSCode) to set breakpoints and debug the backend service. Make sure to configure your IDE's remote debugging settings to connect to this port in your Docker setup.
        // this is for inspecting the node process with a debugger. You can connect to this port from your IDE (like VSCode) to set breakpoints and debug the backend service. Make sure to configure your IDE's remote debugging settings to connect to this port in your Docker setup.
      ],//0.0.0.0 is used to allow connections from outside the container, and 9229 is the default port for Node.js debugging. this is different from the OTLP HTTP endpoint used for SigNoz tracing, which is typically on port 4318. You can use both simultaneously without conflict, just make sure to set the appropriate environment variables and configure your Docker setup accordingly.
      env: {
        NODE_ENV: process.env.NODE_ENV || "production"
      }
    }
  ]
};

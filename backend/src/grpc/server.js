const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

function startGrpcServer(port, logger) {
  const protoPath = path.join(__dirname, "echo.proto"); //path to echo.proto file

  const pkgDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const proto = grpc.loadPackageDefinition(pkgDef);
  const EchoService = proto.echo.EchoService;

  const server = new grpc.Server();

  server.addService(EchoService.service, {
    // Unary action: request -> single response
    SayHello: (call, callback) => {
      const name = String(call.request.name || "world").slice(0, 50);
      callback(null, { message: `Hello ${name} (from gRPC)` });
    },

    // Server-streaming action: one request -> stream responses
    StreamTime: (call) => {
      const every = Math.max(1, Math.min(10, Number(call.request.everySeconds || 1)));
      const interval = setInterval(() =>{
        //call.write different from callback(null, {message: ...})
        call.write({ isoTime: new Date().toISOString() }); 
      }, every * 1000);

      call.on("cancelled", () => clearInterval(interval));
      call.on("error", () => clearInterval(interval));
      call.on("end", () => {
        clearInterval(interval);
        call.end();
      });
    }
  });

  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err) => {
    if (err) {
      logger.error({ err }, "gRPC bind error");
      process.exit(1);
    }
    server.start();
    logger.info({ grpcPort: port }, "gRPC server up");
  });
}

module.exports = { startGrpcServer };

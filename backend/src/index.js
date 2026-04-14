require('elastic-apm-node').start({//this is for elastic apm, you can choose to use either elastic apm or signoz otel or both if you want. Just make sure to set the appropriate environment variables for each and configure them correctly in your Docker setup.
 serviceName: 'backend-service',
 serverUrl: 'http://apm-server:8200',
 environment: 'production',
 metricsInterval: '30s'
});
require("dotenv").config();
const { trace } = require('@opentelemetry/api');
const http = require("http");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");
const pino = require("pino");
const client = require('prom-client');
const { initDb } = require("./lib/db");
const { initRedis } = require("./lib/redis");
const { initRabbit, startRabbitConsumer, rabbitPublish } = require("./lib/rabbit");
const { initKafka, startKafkaConsumer, kafkaProduce } = require("./lib/kafka");
const { authMiddleware, issueToken } = require("./lib/auth");

const { buildSwaggerSpec } = require("./rest/swagger");
const swaggerUi = require("swagger-ui-express");

const { registerRestRoutes } = require("./rest/routes");
const { startGrpcServer } = require("./grpc/server");
const { initGraphQL } = require("./graphql/server");
const { initSocket } = require("./ws/socket");
const { attachWs } = require("./ws/ws.js");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: {
    service: process.env.SERVICE_NAME || "backend-service",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/*open telemetry setup - using OTLP HTTP exporter to send traces to SigNoz collector.
The collector can receive OTLP data over both gRPC and HTTP, but using HTTP here for simplicity and compatibility with REST services. 
Make sure to set the OTEL_EXPORTER_OTLP_ENDPOINT environment variable to point to your SigNoz collector's OTLP HTTP endpoint (e.g., http://devops-signoz:4318/v1/traces) in your Docker setup. 
This will allow your backend service to send trace data to SigNoz for visualization and analysis. */
//------------------SIGNOZ OTEL IMPORTED -------------------
//require('./tracing.js');
//require('./tracingj.js');
//------------------APM SETUP FOR ELASTIC APM -------------------
//require('elastic-apm-node').start({//this is for elastic apm, you can choose to use either elastic apm or signoz otel or both if you want. Just make sure to set the appropriate environment variables for each and configure them correctly in your Docker setup.
 // serviceName: 'backend-service',
 // serverUrl: 'http://apm-server:8200',
 // environment: 'production',
  // Enables deep metrics like GC pauses
 // metricsInterval: '30s'
//});

async function main() {
  const app = express();
  const server = http.createServer(app);
  attachWs(server, { logger });

  // this below is for prometheus metrics collection. it sets up a /metrics endpoint that prometheus can use to scrape metrics from this backend service. The collectDefaultMetrics function collects a standard set of Node.js metrics (like CPU usage, memory usage, event loop lag, etc.) and the /metrics endpoint serves these metrics in a format that Prometheus can understand. Make sure to configure your Prometheus server to scrape this endpoint (e.g., http://backend-service:4000/metrics) in your Docker setup.
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.get('/debug', (req, res) => {
  const span = trace.getTracer('debug').startSpan('debug-span');
  console.log("SPAN CREATED");
  span.end();
  res.send('ok');
});

  // --- OWASP-ish baseline hardening ---
  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: false, // for dev UI; enable & tune in prod
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));

  const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  app.use(cors({
    origin: function (origin, cb) {
      if (!origin) return cb(null, true); // curl/postman
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"]
  }));

  app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
  }));

  app.use(express.json({ limit: "256kb" })); // payload limit
  app.use(pinoHttp({ logger }));

  // Infra clients
  const db = await initDb(logger);
  const redis = await initRedis(logger);
  const rabbit = await initRabbit(logger);
  const kafka = await initKafka(logger);

  //put immediately after rabbitMQ and kafka.
  // MAKE THEM AVAILABLE TO ROUTES
  app.locals.rabbit = rabbit;
  app.locals.kafka = kafka;

  // Consumers
  //SAYS START CONSUMERS NOT START CONSUMPTION
  await startRabbitConsumer(rabbit, logger);
  await startKafkaConsumer(kafka, logger);

  // Swagger (REST only)
  const swaggerSpec = buildSwaggerSpec();
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Public: login -> JWT
  app.post("/auth/login", async (req, res) => {
    // demo: any username/password -> token
    const { username } = req.body || {};
    const token = issueToken({ sub: username || "demo-user" });
    res.json({ token });
  });

  // REST routes (protected)
  app.use("/api", authMiddleware);
  registerRestRoutes(app, { db, redis, rabbitPublish, kafkaProduce, logger });
  // REST routes (protected)
  // const restRouter = express.Router();
  // either this or the one below restRouter.use(authMiddleware);
  // registerRestRoutes(restRouter, { db, redis, rabbitPublish, kafkaProduce, logger });
  // app.use("/api", authMiddleware, restRouter);


  // GraphQL (protected)
  await initGraphQL(app, { db, redis, logger });

  // Socket.IO (protected via token in handshake)
  initSocket(server, { redis, rabbitPublish, kafkaProduce, logger });

  // Safe error handler (don’t leak internals)
  app.use((err, req, res, next) => {
    req.log.error({ err }, "request error");
    res.status(500).json({ error: "Internal Server Error" });
  });
  const httpPort = Number(process.env.HTTP_PORT || 4000);

  server.listen(httpPort, () => {
    logger.info({ httpPort }, "HTTP server up");
    console.log("Server started");
  });

  // gRPC server
  const grpcPort = Number(process.env.GRPC_PORT || 50051);
  startGrpcServer(grpcPort, logger);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

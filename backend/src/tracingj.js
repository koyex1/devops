'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');  // Changed to grpcconst { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://otel-collector:4317/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  resource: resourceFromAttributes({
    // Explicitly setting the service name is critical
    [ATTR_SERVICE_NAME]: 'devops-backend',
  }),
});

sdk.start();
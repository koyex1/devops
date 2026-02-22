const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

test("grpc proto loads", () => {
  const protoPath = path.join(__dirname, "../src/grpc/echo.proto");
  const def = protoLoader.loadSync(protoPath);
  const pkg = grpc.loadPackageDefinition(def);
  expect(pkg.echo).toBeTruthy();
});

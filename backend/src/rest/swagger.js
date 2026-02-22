const swaggerJSDoc = require("swagger-jsdoc");

function buildSwaggerSpec() {
  return swaggerJSDoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "DevOps Backend API",
        version: "1.0.0"
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
        }
      },
      security: [{ bearerAuth: [] }]
    },
    apis: ["./src/rest/routes.js"]
  });
}

module.exports = { buildSwaggerSpec };

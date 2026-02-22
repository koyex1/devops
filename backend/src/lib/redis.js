const { createClient } = require("redis");

async function initRedis(logger) {
  const client = createClient({ url: process.env.REDIS_URL });
  client.on("error", (err) => logger.error({ err }, "redis error"));
  await client.connect();
  logger.info("Redis ready");
  return client;
}

module.exports = { initRedis };

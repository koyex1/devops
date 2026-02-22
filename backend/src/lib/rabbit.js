const amqplib = require("amqplib");


async function initRabbit(logger) {
  const conn = await amqplib.connect(process.env.RABBITMQ_URL);
  const ch = await conn.createChannel();//creating connection to the broker
  const q = process.env.RABBITMQ_QUEUE || "jobs.queue";
  await ch.assertQueue(q, { durable: true });
  logger.info({ queue: q }, "RabbitMQ ready");
  return { conn, ch, queue: q };
}


async function rabbitPublish(rabbit, msgObj, logger) {
  const buf = Buffer.from(JSON.stringify(msgObj));
  rabbit.ch.sendToQueue(rabbit.queue, buf, { persistent: true });
  logger.info({ queue: rabbit.queue }, "RabbitMQ publish");
}


async function startRabbitConsumer(rabbit, logger) {
  await rabbit.ch.consume(rabbit.queue, async (msg) => {
    if (!msg) return;
    try {
      const data = JSON.parse(msg.content.toString("utf-8"));
      logger.info({ data }, "RabbitMQ consumed");
      rabbit.ch.ack(msg);
    } catch (e) {
      logger.error({ e }, "RabbitMQ consume error");
      rabbit.ch.nack(msg, false, false);
    }
  });
}

//init - connection, channel and queue. creates a single connection, channel
//and queue where everything happens.
//publish - rabbit.channel.sendsToQueue the messageObject
//consume - rabbit.channel.consumes message however it likes and ack/nack

module.exports = { initRabbit, rabbitPublish, startRabbitConsumer };

const { Kafka } = require("kafkajs");

async function initKafka(logger) {
  const brokers = (process.env.KAFKA_BROKERS || "").split(",").map(s => s.trim()).filter(Boolean);
  const kafka = new Kafka({ clientId: process.env.KAFKA_CLIENT_ID || "devops", brokers });
  const producer = kafka.producer();
  const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || "devops-group" });

  await producer.connect();
  await consumer.connect();

  logger.info({ brokers }, "Kafka ready");
  return { kafka, producer, consumer }; //connection, channel, queue was returned in rabbitmq
}

async function kafkaProduce(kafka, messageObj, logger) {
  const topic = process.env.KAFKA_TOPIC || "events.topic";
  await kafka.producer.send({
    topic,
    messages: [{ value: JSON.stringify(messageObj) }]
  });
  logger.info({ topic }, "Kafka produced");
}

async function startKafkaConsumer(kafka, logger) {
  const topic = process.env.KAFKA_TOPIC || "events.topic";
  await kafka.consumer.subscribe({ topic, fromBeginning: true });

  await kafka.consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const val = message.value ? message.value.toString("utf-8") : "";
        logger.info({ topic, val }, "Kafka consumed");
      } catch (e) {
        logger.error({ e }, "Kafka consume error");
      }
    }
  });
}

//initkafa - kafka, producer, consumer returned. the kafka is a connection object 
//that starts up the connection to the cluster with one single client id and several 
//brokers(producers and consumers connect through it)
//kafka.producer.send - send messageObject to a topic
//kafka.consumer.subsscribe points to the topic and kafka.consumer.run starts
//the actual message consumption

module.exports = { initKafka, kafkaProduce, startKafkaConsumer };

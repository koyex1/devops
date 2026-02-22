const { z } = require("zod");

const ItemSchema = z.object({
  name: z.string().min(1).max(100)
});

function registerRestRoutes(app, deps) {
  const { db, redis, rabbitPublish, kafkaProduce, logger } = deps;

  /**
   * @swagger
   * /api/items:
   *   get:
   *     summary: REST GET - List items
   *     responses:
   *       200:
   *         description: OK
   */
  app.get("/items", async (req, res) => {
    // REST GET: fetch data, safe to cache in Redis
    const cacheKey = "items:list";
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ source: "redis", items: JSON.parse(cached) });

    const r = await db.query("SELECT id, name, created_at FROM items ORDER BY id DESC LIMIT 50");
    await redis.setEx(cacheKey, 10, JSON.stringify(r.rows));
    return res.json({ source: "postgres", items: r.rows });
  });

  /**
   * @swagger
   * /api/items:
   *   post:
   *     summary: REST POST - Create item
   *     requestBody:
   *       required: true
   *     responses:
   *       201:
   *         description: Created
   */
  app.post("/items", async (req, res) => {
    // REST POST: create new resource
    const parsed = ItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { name } = parsed.data;
    const r = await db.query("INSERT INTO items(name) VALUES($1) RETURNING id, name, created_at", [name]);
    await redis.del("items:list");

    await rabbitPublish(req.app.locals.rabbit, { type: "ITEM_CREATED", item: r.rows[0] }, logger).catch(()=>{});
    await kafkaProduce(req.app.locals.kafka, { type: "ITEM_CREATED", item: r.rows[0] }, logger).catch(()=>{});

    return res.status(201).json(r.rows[0]);
  });

  /**
   * @swagger
   * /api/items/{id}:
   *   put:
   *     summary: REST PUT - Replace/update item
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *     responses:
   *       200:
   *         description: OK
   */
  app.put("/items/:id", async (req, res) => {
    // REST PUT: replace/update (idempotent)
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const parsed = ItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const r = await db.query(
      "UPDATE items SET name=$1 WHERE id=$2 RETURNING id, name, created_at",
      [parsed.data.name, id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    await redis.del("items:list");
    return res.json(r.rows[0]);
  });

  /**
   * @swagger
   * /api/items/{id}:
   *   delete:
   *     summary: REST DELETE - Remove item
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *     responses:
   *       204:
   *         description: No Content
   */
  app.delete("/items/:id", async (req, res) => {
    // REST DELETE: remove resource (idempotent)
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const r = await db.query("DELETE FROM items WHERE id=$1", [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    await redis.del("items:list");
    return res.status(204).send();
  });

  // RabbitMQ action trigger
  app.post("/queue/publish", async (req, res) => {
    // action: publish a job message
    await rabbitPublish(req.app.locals.rabbit, { type: "JOB", payload: req.body || {} }, logger);
    return res.json({ ok: true });
  });

  // Kafka action trigger
  app.post("/kafka/produce", async (req, res) => {
    // action: produce an event
    await kafkaProduce(req.app.locals.kafka, { type: "EVENT", payload: req.body || {} }, logger);
    return res.json({ ok: true });
  });
}

module.exports = { registerRestRoutes };

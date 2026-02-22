const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@as-integrations/express4");

const typeDefs = `#graphql
  type Item {
    id: ID!
    name: String!
    created_at: String!
  }

  type Query {
    me: String!
    items: [Item!]!
  }

  type Mutation {
  createItem(name: String!): Item!
  updateItem(id: ID!, name: String!): Item!
  deleteItem(id: ID!): Boolean!
}

`;

function buildResolvers({ db, redis }) {
  return {
    Query: {
      me: async (parent, args, ctx) => ctx.user.sub || "unknown",
      items: async () => {
        const cacheKey = "gql:items:list";
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const r = await db.query("SELECT id, name, created_at FROM items ORDER BY id DESC LIMIT 50");
        await redis.setEx(cacheKey, 10, JSON.stringify(r.rows));
        return r.rows;
      }
    },
   Mutation: {
  createItem: async (parent, args) => {
    const name = String(args.name || "").slice(0, 100);
    if (!name) throw new Error("name required");

    const r = await db.query(
      "INSERT INTO items(name) VALUES($1) RETURNING id, name, created_at",
      [name]
    );

    await redis.del("gql:items:list");
    return r.rows[0];
  },

  updateItem: async (parent, args) => {
    const name = String(args.name || "").slice(0, 100);
    if (!name) throw new Error("name required");

    const r = await db.query(
      "UPDATE items SET name=$1 WHERE id=$2 RETURNING id, name, created_at",
      [name, args.id]
    );

    await redis.del("gql:items:list");
    if (!r.rows.length) throw new Error("item not found");
    return r.rows[0];
  },

  deleteItem: async (parent, args) => {
    // ID from GraphQL can be string, so normalize
    const id = String(args.id || "").trim();
    if (!id) throw new Error("id required");

    // RETURNING allows us to confirm whether it existed
    const r = await db.query(
      "DELETE FROM items WHERE id=$1 RETURNING id",
      [id]
    );

    await redis.del("gql:items:list");

    // return true if something was deleted, false otherwise
    return r.rows.length > 0;
  },
}


  };
}

async function initGraphQL(app, deps) {
  const server = new ApolloServer({
    typeDefs,
    resolvers: buildResolvers(deps)
  });

  await server.start();

  // protected by authMiddleware (we mounted /api protected already; so mount /graphql under /api or add middleware)
  app.use("/graphql", (req, res, next) => {
    // require JWT for GraphQL too
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return res.status(401).json({ error: "Missing token" });
    return next();
  });

  app.use("/graphql", expressMiddleware(server, {
    context: async ({ req }) => {
      // trust authMiddleware in real, but keep minimal:
      const token = (req.headers.authorization || "").slice(7);
      const jwt = require("jsonwebtoken");
      const user = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE
      });
      return { user };
    }
  }));
}

//query is for get one and get all
//mutation is for changes - update and delete

module.exports = { initGraphQL };

const jwt = require("jsonwebtoken");

function issueToken(payload) {
  const secret = process.env.JWT_SECRET;
  const issuer = process.env.JWT_ISSUER || "devops-backend";
  const audience = process.env.JWT_AUDIENCE || "devops-clients";

  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: "1h",
    issuer,
    audience
  });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE
    });
    req.user = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = { issueToken, authMiddleware };

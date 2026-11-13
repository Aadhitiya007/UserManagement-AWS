const jwt = require("jsonwebtoken");

const parseCookies = (cookieHeader) => {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce((res, c) => {
    const parts = c.trim().split("=");
    const key = parts[0];
    const val = parts.slice(1).join("=");
    if (key && val) res[key] = decodeURIComponent(val);
    return res;
  }, {});
};

const verifyToken = (req, res, next) => {
  const authHeader = req.headers?.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers && req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.token) {
      token = cookies.token;
    }
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "Server authentication configuration error." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token." });
  }
};

module.exports = { verifyToken, parseCookies };

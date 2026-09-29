// middleware/optionalAuth.js
import jwt from "jsonwebtoken";

//used for protected vs public only routes in App.jsx

export default function optionalAuth(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    req.userId = null;
    return next();
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

        req.userId = decoded.userId;
  } catch {
    req.userId = null;
  }

  next();
}

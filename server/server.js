import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";

import { connectDB } from "./db.js";
import requireAuth from "./middleware/requireAuth.js";

import authRoutes from "./routes/auth.js";
import accountRoutes from "./routes/accounts.js";
import userRoutes from "./routes/users.js";
import projectRoutes from "./routes/projects.js";
import placeRoutes from "./routes/places.js";
import eventRoutes from "./routes/events.js";
import neighbourhoodRoutes from "./routes/neighbourhoods.js";
import presenceRoutes from "./routes/presence.js";
import motionRoutes from "./routes/motion.js";
import layerRoutes from "./routes/layers.js";
import aggregateRoutes from "./routes/aggregates.js";
import boundaryRoutes from "./routes/boundaries.js";
import galleryRoutes from "./routes/gallery.js";
import guestbookRoutes from "./routes/guestbook.js";
import projectChatRoutes from "./routes/projectChat.js";
import bulletinRoutes from "./routes/bulletin.js";

import speechTokenRoute from "./speech/token.js";
import translateRoutes from "./speech/translate.js";
import aiRoutes from "./ai/ai.js";

import { startPresenceCleanupJob } from "./utils/startPresenceCleanupJob.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

app.use(cookieParser());

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }),
);

app.get("/", (req, res) => {
  res.send("🗺️ Mapdex backend is running.");
});

/* Public */
app.use("/api/auth", authRoutes);

/* Protected */
app.use("/api/accounts", requireAuth, accountRoutes);
app.use("/api/users", requireAuth, userRoutes);
app.use("/api/projects", requireAuth, projectRoutes);
app.use("/api/places", requireAuth, placeRoutes);
app.use("/api/events", requireAuth, eventRoutes);
app.use("/api/neighbourhoods", requireAuth, neighbourhoodRoutes);
app.use("/api/presence", requireAuth, presenceRoutes);
app.use("/api/motion", requireAuth, motionRoutes);
app.use("/api/layers", requireAuth, layerRoutes);
app.use("/api/aggregates", requireAuth, aggregateRoutes);
app.use("/api/boundaries", requireAuth, boundaryRoutes);
app.use("/api/gallery", requireAuth, galleryRoutes);
app.use("/api/guestbook", requireAuth, guestbookRoutes);
app.use("/api/projectChat", requireAuth, projectChatRoutes);
app.use("/api/bulletin", requireAuth, bulletinRoutes);

app.use("/api/speech", requireAuth, speechTokenRoute);
app.use("/api/translate", requireAuth, translateRoutes);
app.use("/api/ai", requireAuth, aiRoutes);

/* Known request/upload/body errors */
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof multer.MulterError) {
    const isFileTooLarge = err.code === "LIMIT_FILE_SIZE";

    return res.status(isFileTooLarge ? 413 : 400).json({
      error: isFileTooLarge ? "Uploaded file is too large." : err.message,
      code: err.code,
    });
  }

  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      error: "Request body is too large.",
    });
  }

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      error: "Invalid JSON payload.",
    });
  }

  if (err?.status) {
    return res.status(err.status).json({
      error: err.message || "Request failed.",
    });
  }

  next(err);
});

/* Unknown server errors */
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error("Unhandled server error:", err);

  return res.status(500).json({
    error: "Internal server error",
  });
});

connectDB()
  .then(() => {
    startPresenceCleanupJob();
    app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("DB connect failed:", err);
    process.exit(1);
  });
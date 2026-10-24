import "dotenv/config";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import {
  contentSecurityPolicy,
  crossOriginEmbedderPolicy,
  crossOriginOpenerPolicy,
  crossOriginResourcePolicy,
  hidePoweredBy,
  hsts,
  noSniff,
  originAgentCluster,
  permittedCrossDomainPolicies,
  referrerPolicy,
  xDnsPrefetchControl,
  xDownloadOptions,
  xFrameOptions,
  xssFilter
} from "helmet";
import { ZodError } from "zod";
import { AppError } from "./lib/errors.js";
import { allowedFrontendOrigins } from "./lib/cors.js";
import { authRouter } from "./routes/auth.js";
import { bookingsRouter } from "./routes/bookings.js";
import { bookingSeriesRouter } from "./routes/booking-series.js";
import { roomsRouter } from "./routes/rooms.js";
import { usersRouter } from "./routes/users.js";
import { reportsRouter } from "./routes/reports.js";
import { requireAuth, requirePasswordChanged } from "./middleware/auth.js";

export const app = express();

app.disable("x-powered-by");
app.use(
  contentSecurityPolicy(),
  crossOriginEmbedderPolicy(),
  crossOriginOpenerPolicy(),
  crossOriginResourcePolicy(),
  hidePoweredBy(),
  hsts(),
  noSniff(),
  originAgentCluster(),
  permittedCrossDomainPolicies(),
  referrerPolicy(),
  xDnsPrefetchControl(),
  xDownloadOptions(),
  xFrameOptions(),
  xssFilter()
);
app.use(cors({
  origin: allowedFrontendOrigins()
}));
app.use(express.json({ limit: "128kb" }));

app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/rooms", requireAuth, requirePasswordChanged, roomsRouter);
app.use("/api/users", requireAuth, requirePasswordChanged, usersRouter);
app.use("/api/reports", requireAuth, requirePasswordChanged, reportsRouter);
app.use("/api/bookings", requireAuth, requirePasswordChanged, bookingsRouter);
app.use("/api/booking-series", requireAuth, requirePasswordChanged, bookingSeriesRouter);
app.use((_request, _response, next) => next(new AppError("Không tìm thấy API.", 404)));

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: "Dữ liệu gửi lên không hợp lệ.",
      details: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }))
    });
    return;
  }
  if (error instanceof AppError) {
    response.status(error.statusCode).json({ error: error.message, details: error.details });
    return;
  }
  if (typeof error === "object" && error !== null) {
    if ("type" in error && error.type === "entity.too.large") {
      response.status(413).json({ error: "Dữ liệu gửi lên vượt quá dung lượng cho phép." });
      return;
    }
    if ("type" in error && error.type === "entity.parse.failed") {
      response.status(400).json({ error: "Nội dung JSON không hợp lệ." });
      return;
    }
    if ("code" in error && error.code === "P2002") {
      response.status(409).json({ error: "Dữ liệu đã tồn tại." });
      return;
    }
    if ("code" in error && error.code === "P2025") {
      response.status(404).json({ error: "Không tìm thấy dữ liệu cần cập nhật." });
      return;
    }
  }
  console.error("Unhandled API error:", error);
  response.status(500).json({ error: "Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau." });
};

app.use(errorHandler);

export default app;

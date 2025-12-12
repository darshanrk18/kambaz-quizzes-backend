import "dotenv/config";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import cors from "cors";
import mongoose from "mongoose";
import UserRoutes from "./Kambaz/Users/routes.js";
import CourseRoutes from "./Kambaz/Courses/routes.js";
import ModuleRoutes from "./Kambaz/Modules/routes.js";
import Database from "./Kambaz/Database/index.js";
import EnrollmentRoutes from "./Kambaz/Enrollments/routes.js";
import AssignmentRoutes from "./Kambaz/Assignments/routes.js";
import QuizRoutes from "./Kambaz/Quizzes/routes.js";
import QuizAttemptsRoutes from "./Kambaz/QuizAttempts/routes.js";
import Lab5 from "./Lab5/index.js";
import Hello from "./Hello.js";

// Environment variables check
console.log("=== ENVIRONMENT VARIABLES ===");
console.log("SERVER_ENV:", process.env.SERVER_ENV);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("CLIENT_URL:", process.env.CLIENT_URL);
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);
const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.SERVER_ENV === "production";
console.log("Is Production:", isProduction);
console.log(
  "Database:",
  process.env.DATABASE_CONNECTION_STRING ? "Atlas" : "Local"
);

// MongoDB connection
const CONNECTION_STRING = process.env.DATABASE_CONNECTION_STRING || "mongodb://127.0.0.1:27017/kambaz";

if (!process.env.DATABASE_CONNECTION_STRING) {
  console.warn("WARNING: DATABASE_CONNECTION_STRING not set! Using default localhost connection.");
  console.warn("For production, set DATABASE_CONNECTION_STRING environment variable.");
}

// Ensure database name is set to 'kambaz'
const connectionOptions = {
  dbName: "kambaz"
};

// If connection string already has a database name, mongoose will use it
// Otherwise, we explicitly set it via options
mongoose.connect(CONNECTION_STRING, connectionOptions).catch((error) => {
  console.error("MongoDB connection error:", error.message);
  console.error("Make sure DATABASE_CONNECTION_STRING is set correctly in your environment variables.");
  process.exit(1);
});

mongoose.connection.on("connected", () => {
  const dbName = mongoose.connection.db?.databaseName || "unknown";
  console.log("Connected to MongoDB database:", dbName);
  console.log("Connection string:", CONNECTION_STRING.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")); // Hide credentials in logs
});

mongoose.connection.on("error", (error) => {
  console.error("MongoDB connection error:", error.message);
});

const app = express();

// CORS configuration - MUST come before session
const allowedOrigins = [
  "http://localhost:3000",
  "https://kambaz-quizzes-frontend-indol.vercel.app",
  process.env.CLIENT_URL, // Use CLIENT_URL (Render's variable name)
  process.env.FRONTEND_URL, // Keep both for compatibility
].filter(Boolean); // Remove undefined values

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (Postman, mobile apps)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("CORS blocked origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Session configuration
const mongoUrl = process.env.DATABASE_CONNECTION_STRING || "mongodb://127.0.0.1:27017/kambaz";

const sessionOptions = {
  secret: process.env.SESSION_SECRET || "kambaz-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,

  // CRITICAL: Use MongoDB to persist sessions
  store: MongoStore.create({
    mongoUrl: mongoUrl,
    dbName: "kambaz",
    collectionName: "sessions",
    ttl: 24 * 60 * 60, // 24 hours
    touchAfter: 60 * 60, // Update session once per hour (performance)
    crypto: {
      secret: process.env.SESSION_SECRET || "kambaz-secret-key",
    },
  }),

  // CRITICAL: Cookie settings for cross-domain
  cookie: {
    secure: isProduction, // true in production (HTTPS only)
    httpOnly: true, // Prevent JavaScript access
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: isProduction ? "none" : "lax", // 'none' required for cross-domain!
    // Don't set domain for cross-domain cookies (Vercel frontend + Render backend)
    path: "/", // Ensure cookie is available for all paths
  },
};

app.use(session(sessionOptions));

// DEBUG: Log session status
app.use((req, res, next) => {
  console.log("=== SESSION DEBUG ===");
  console.log("Path:", req.path);
  console.log("Method:", req.method);
  console.log("Session ID:", req.sessionID);
  console.log("Has session:", !!req.session);
  console.log("Current user:", req.session?.currentUser?.username || req.session?.currentUser?.email || "none");
  console.log("Cookie:", req.headers.cookie);
  next();
});

app.use(express.json());

// Routes
Hello(app);
Lab5(app);
UserRoutes(app, Database);
CourseRoutes(app, Database);
ModuleRoutes(app, Database);
EnrollmentRoutes(app, Database);
AssignmentRoutes(app, Database);
QuizRoutes(app, Database);
QuizAttemptsRoutes(app, Database);

app.listen(process.env.PORT || 4000, () => {
  console.log("Server running on port 4000");
});
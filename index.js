import "dotenv/config";
import express from "express";
import session from "express-session";
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
const corsOptions = {
    credentials: true,
    origin: process.env.CLIENT_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Set-Cookie"],
};

app.use(cors(corsOptions));

// Session configuration
const sessionOptions = {
  secret: process.env.SESSION_SECRET || "kambaz",
  resave: false,
  saveUninitialized: false,
  name: "kambaz.sid", // Custom session name
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    httpOnly: true,
    path: "/", // Ensure cookie is available for all paths
  },
};

if (process.env.SERVER_ENV !== "development") {
  sessionOptions.proxy = true;
  sessionOptions.cookie.sameSite = "none";
  sessionOptions.cookie.secure = true;
  // In production, ensure cookie works across domains
  sessionOptions.cookie.domain = undefined; // Let browser set domain automatically
} else {
  sessionOptions.cookie.sameSite = "lax";
  sessionOptions.cookie.secure = false;
}

app.use(session(sessionOptions));
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

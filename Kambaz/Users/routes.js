import UsersDao from "./dao.js";
import CoursesDao from "../Courses/dao.js";
import EnrollmentsDao from "../Enrollments/dao.js";

export default function UserRoutes(app, db) {
  const dao = UsersDao(db);
  const coursesDao = CoursesDao(db);
  const enrollmentsDao = EnrollmentsDao(db);

  const signin = async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const currentUser = await dao.findUserByCredentials(username, password);

      if (!currentUser) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Save to session
      req.session["currentUser"] = currentUser;

      // CRITICAL: Explicitly save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Session error" });
        }

        console.log("=== SESSION SAVED ===");
        console.log("Session ID:", req.sessionID);
        console.log("User:", currentUser.username || currentUser.email);

        res.json(currentUser);
      });
    } catch (error) {
      console.error("Signin error:", error);
      res.status(500).json({ message: "Server error during signin", error: error.message });
    }
  };

  const signup = async (req, res) => {
    try {
      const user = await dao.findUserByUsername(req.body.username);
      if (user) {
        res.status(400).json({ message: "Username already taken" });
        return;
      }
      const currentUser = await dao.createUser(req.body);
      req.session["currentUser"] = currentUser;

      // CRITICAL: Explicitly save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Session error" });
        }

        console.log("=== SESSION SAVED (SIGNUP) ===");
        console.log("Session ID:", req.sessionID);
        console.log("User:", currentUser.username || currentUser.email);

        res.json(currentUser);
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Server error during signup", error: error.message });
    }
  };

  const signout = (req, res) => {
    req.session.destroy();
    res.sendStatus(200);
  };

  const profile = (req, res) => {
    // Log session info for debugging (remove in production if needed)
    const sessionId = req.sessionID;
    const currentUser = req.session["currentUser"];
    
    if (!currentUser) {
      // Log why session might be missing
      if (!req.session) {
        console.log("Profile: No session object found");
      } else if (!sessionId) {
        console.log("Profile: No session ID found");
      } else {
        console.log("Profile: Session exists but no currentUser");
      }
      res.sendStatus(401);
      return;
    }
    res.json(currentUser);
  };

  const updateUser = async (req, res) => {
    try {
      const { userId } = req.params;
      const userUpdates = { ...req.body };
      
      // Convert dob string to Date object if provided
      if (userUpdates.dob && typeof userUpdates.dob === 'string') {
        const dobDate = new Date(userUpdates.dob);
        if (Number.isNaN(dobDate.getTime())) {
          // If invalid date, remove it
          delete userUpdates.dob;
        } else {
          userUpdates.dob = dobDate;
        }
      }
      
      const existingUser = await dao.findUserById(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      await dao.updateUser(userId, userUpdates);
      const currentUser = req.session["currentUser"];
      if (currentUser && currentUser._id === userId) {
        const updatedUser = await dao.findUserById(userId);
        req.session["currentUser"] = updatedUser;
      }
      const updatedUser = await dao.findUserById(userId);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Error updating user", error: error.message });
    }
  };

  const findAllUsers = async (req, res) => {
    const { role, name } = req.query;
    if (role) {
      const users = await dao.findUsersByRole(role);
      res.json(users);
      return;
    }
    if (name) {
      const users = await dao.findUsersByPartialName(name);
      res.json(users);
      return;
    }
    const users = await dao.findAllUsers();
    res.json(users);
  };

  const findUserById = async (req, res) => {
    try {
    const { userId } = req.params;
      const user = await dao.findUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
    res.json(user);
    } catch (error) {
      console.error("Error finding user by ID:", error);
      res.status(500).json({ message: "Error finding user", error: error.message });
    }
  };

  const deleteUser = async (req, res) => {
    try {
    const { userId } = req.params;
      const user = await dao.findUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      await dao.deleteUser(userId);
    res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Error deleting user", error: error.message });
    }
  };

  const createUser = async (req, res) => {
    const user = await dao.createUser(req.body);
    res.json(user);
  };

  const findCoursesForEnrolledUser = async (req, res) => {
    let { userId } = req.params;
    if (userId === "current") {
      const currentUser = req.session["currentUser"];
      if (!currentUser) {
        res.sendStatus(401);
        return;
      }
      userId = currentUser._id;
    }
    const courses = await enrollmentsDao.findCoursesForUser(userId);
    res.json(courses);
  };

  const createCourse = async (req, res) => {
    const currentUser = req.session["currentUser"];
    if (!currentUser) {
      res.sendStatus(401);
      return;
    }
    const newCourse = await coursesDao.createCourse(req.body);
    await enrollmentsDao.enrollUserInCourse(currentUser._id, newCourse._id);
    res.json(newCourse);
  };

  // Routes
  app.post("/api/users", createUser);
  app.get("/api/users", findAllUsers);
  app.get("/api/users/:userId", findUserById);
  app.put("/api/users/:userId", updateUser);
  app.delete("/api/users/:userId", deleteUser);
  app.post("/api/users/signup", signup);
  app.post("/api/users/signin", signin);
  app.post("/api/users/signout", signout);
  app.post("/api/users/profile", profile);
  app.get("/api/users/:userId/courses", findCoursesForEnrolledUser);
  app.post("/api/users/current/courses", createCourse);
}

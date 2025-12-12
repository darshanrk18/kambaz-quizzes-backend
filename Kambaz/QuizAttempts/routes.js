import QuizAttemptsDao from "./dao.js";

export default function QuizAttemptsRoutes(app, db) {
  const dao = QuizAttemptsDao(db);

  const findAttemptsForQuiz = async (req, res) => {
    console.log("\n==========================================");
    console.log("API: GET /api/quizzes/:quizId/attempts");
    console.log("==========================================");
    try {
      const { quizId } = req.params;
      console.log("Quiz ID:", quizId);
      const attempts = await dao.findAttemptsForQuiz(quizId);
      console.log("✓ Success - returning", attempts.length, "attempts");
      res.json(attempts);
    } catch (error) {
      console.error("❌ Error finding attempts for quiz:", error);
      res.status(500).json({ message: "Server error fetching attempts", error: error.message });
    }
  };

  const findAttemptsForUserAndQuiz = async (req, res) => {
    console.log("\n==========================================");
    console.log("API: GET /api/users/:userId/quizzes/:quizId/attempts");
    console.log("==========================================");
    try {
      const { userId, quizId } = req.params;
      console.log("User ID:", userId);
      console.log("Quiz ID:", quizId);
      const attempts = await dao.findAttemptsForUserAndQuiz(userId, quizId);
      console.log("✓ Success - returning", attempts.length, "attempts");
      res.json(attempts);
    } catch (error) {
      console.error("❌ Error finding attempts:", error);
      res.status(500).json({ message: "Server error fetching attempts", error: error.message });
    }
  };

  const findLatestAttempt = async (req, res) => {
    console.log("\n==========================================");
    console.log("API: GET /api/users/:userId/quizzes/:quizId/attempts/latest");
    console.log("==========================================");
    try {
      const { userId, quizId } = req.params;
      console.log("User ID:", userId);
      console.log("Quiz ID:", quizId);
      const attempt = await dao.findLatestAttemptForUserAndQuiz(userId, quizId);
      console.log("✓ Success");
      res.json(attempt);
    } catch (error) {
      console.error("❌ Error finding latest attempt:", error);
      res.status(500).json({ message: "Server error fetching attempt", error: error.message });
    }
  };

  const findFinalScore = async (req, res) => {
    console.log("\n==========================================");
    console.log("API: GET /api/users/:userId/quizzes/:quizId/final-score");
    console.log("==========================================");
    try {
      const { userId, quizId } = req.params;
      console.log("User ID:", userId);
      console.log("Quiz ID:", quizId);
      const attempt = await dao.findFinalScoreAttemptForUserAndQuiz(userId, quizId);
      if (!attempt) {
        console.log("✗ No final score attempt found");
        return res.status(404).json({ message: "No final score attempt found" });
      }
      console.log("✓ Success");
      res.json(attempt);
    } catch (error) {
      console.error("❌ Error finding final score:", error);
      res.status(500).json({ message: "Server error fetching final score", error: error.message });
    }
  };

  const findAttemptHistory = async (req, res) => {
    console.log("\n==========================================");
    console.log("API: GET /api/users/:userId/quizzes/:quizId/attempts/history");
    console.log("==========================================");
    try {
      const { userId, quizId } = req.params;
      console.log("User ID:", userId);
      console.log("Quiz ID:", quizId);
      const attempts = await dao.findAttemptHistoryForUserAndQuiz(userId, quizId);
      console.log("✓ Success - returning", attempts.length, "history entries");
      res.json(attempts);
    } catch (error) {
      console.error("❌ Error finding attempt history:", error);
      res.status(500).json({ message: "Server error fetching attempt history", error: error.message });
    }
  };

  const createAttempt = async (req, res) => {
    console.log("\n==========================================");
    console.log("API: POST /api/quizzes/:quizId/attempts");
    console.log("==========================================");
    try {
      const { quizId } = req.params;
      const currentUser = req.session["currentUser"];
      
      console.log("Quiz ID:", quizId);
      console.log("Current user:", currentUser ? currentUser._id : "none");
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      
      if (!currentUser) {
        console.log("❌ Not authenticated");
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if quiz exists and is published
      console.log("Checking quiz...");
      const QuizzesDao = (await import("../Quizzes/dao.js")).default;
      const quizzesDao = QuizzesDao({});
      const quiz = await quizzesDao.findQuizById(quizId);
      
      if (!quiz) {
        console.log("❌ Quiz not found");
        return res.status(404).json({ message: "Quiz not found" });
      }
      console.log("✓ Quiz found:", quiz.title);
      console.log("  - Published:", quiz.published);
      console.log("  - Multiple attempts:", quiz.multipleAttempts);
      console.log("  - Attempts allowed:", quiz.attemptsAllowed);
      
      if (!quiz.published) {
        console.log("❌ Quiz not published");
        return res.status(403).json({ message: "Quiz is not published" });
      }

      // Check for existing unsubmitted attempt (resume on refresh)
      console.log("Checking for unsubmitted attempt...");
      const existingAttempt = await dao.findUnsubmittedAttemptForUserAndQuiz(
        currentUser._id,
        quizId
      );
      
      if (existingAttempt) {
        console.log("✓ Found existing unsubmitted attempt - returning it for resume");
        console.log("  - Attempt ID:", existingAttempt._id);
        console.log("  - Started at:", existingAttempt.startedAt);
        console.log("  - Current question:", existingAttempt.currentQuestionIndex);
        console.log("  - Answers:", existingAttempt.answers?.length || 0);
        console.log("  - Question order:", existingAttempt.questionOrder);
        return res.json(existingAttempt);
      }

      // Check attempt limits
      console.log("Checking attempt limits...");
      const attemptCount = await dao.getAttemptCountForUserAndQuiz(
        currentUser._id,
        quizId
      );
      
      console.log("=== ATTEMPT LIMIT CHECK ===");
      console.log("User ID:", currentUser._id);
      console.log("Quiz ID:", quizId);
      console.log("Current SUBMITTED attempt count:", attemptCount);
      console.log("Quiz multipleAttempts:", quiz.multipleAttempts);
      console.log("Quiz attemptsAllowed:", quiz.attemptsAllowed);
      
      if (quiz.multipleAttempts) {
        const limit = quiz.attemptsAllowed || 1;
        console.log("Multiple attempts allowed, limit:", limit);
        if (attemptCount >= limit) {
          console.log("❌ Maximum attempts reached:", attemptCount, ">=", limit);
          return res.status(403).json({ message: "Maximum attempts reached" });
        }
        console.log("✓ Can create new attempt:", attemptCount, "<", limit);
      } else {
        console.log("Multiple attempts NOT allowed");
        if (attemptCount > 0) {
          console.log("❌ Already has", attemptCount, "submitted attempts");
          return res.status(403).json({ message: "Multiple attempts not allowed" });
        }
        console.log("✓ Can create first attempt");
      }

      const attemptNumber = attemptCount + 1;
      console.log("Creating new attempt #", attemptNumber);
      console.log("Question order from request:", req.body?.questionOrder);
      
      const newAttempt = await dao.createAttempt(
        quizId, 
        currentUser._id, 
        attemptNumber,
        req.body?.questionOrder || []
      );
      
      console.log("✓ SUCCESS - New attempt created");
      console.log("  - Attempt ID:", newAttempt._id);
      console.log("  - Attempt number:", newAttempt.attemptNumber);
      console.log("  - Started at:", newAttempt.startedAt);
      console.log("  - Question order:", newAttempt.questionOrder);
      console.log("  - Question order length:", newAttempt.questionOrder?.length || 0);
      
      res.json(newAttempt);
    } catch (error) {
      console.error("❌ Error creating attempt:", error);
      console.error("Stack trace:", error.stack);
      res.status(500).json({ message: "Server error creating attempt", error: error.message });
    }
  };

  const updateAttempt = async (req, res) => {
    console.log("\n==========================================");
    console.log("API: PUT /api/attempts/:attemptId");
    console.log("==========================================");
    try {
      const { attemptId } = req.params;
      const { answers, currentQuestionIndex, elapsedSeconds, questionOrder } = req.body || {};
      
      console.log("Attempt ID:", attemptId);
      console.log("Request body contains:");
      console.log("  - answers:", answers ? `${answers.length} answers` : "not provided");
      console.log("  - currentQuestionIndex:", currentQuestionIndex ?? "not provided");
      console.log("  - elapsedSeconds:", elapsedSeconds ?? "not provided");
      console.log("  - questionOrder:", questionOrder ? `${questionOrder.length} items` : "not provided");
      console.log("  - startedAt:", req.body.startedAt ? "⚠️  PROVIDED (SHOULD NOT HAPPEN!)" : "✓ not provided (correct)");
      
      // Build update object with only provided fields
      const attemptUpdates = {};
      if (answers !== undefined) {
        attemptUpdates.answers = answers;
        console.log("Will update answers");
      }
      if (currentQuestionIndex !== undefined) {
        attemptUpdates.currentQuestionIndex = currentQuestionIndex;
        console.log("Will update currentQuestionIndex");
      }
      if (elapsedSeconds !== undefined) {
        attemptUpdates.elapsedSeconds = elapsedSeconds;
        console.log("Will update elapsedSeconds");
      }
      if (questionOrder !== undefined) {
        attemptUpdates.questionOrder = questionOrder;
        console.log("Will update questionOrder");
      }

      const status = await dao.updateAttempt(attemptId, attemptUpdates);
      
      if (status.matchedCount === 0) {
        console.log("❌ Attempt not found");
        return res.status(404).json({ message: "Attempt not found" });
      }
      
      const updatedAttempt = await dao.findAttemptById(attemptId);
      console.log("✓ SUCCESS - Attempt updated");
      console.log("  - Modified count:", status.modifiedCount);
      
      res.json(updatedAttempt);
    } catch (error) {
      console.error("❌ Error updating attempt:", error);
      console.error("Stack trace:", error.stack);
      res.status(500).json({ message: "Server error updating attempt", error: error.message });
    }
  };

  const submitAttempt = async (req, res) => {
    console.log("\n==========================================");
    console.log("API: POST /api/attempts/:attemptId/submit");
    console.log("==========================================");
    try {
      const { attemptId } = req.params;
      const { answers } = req.body || {};
      
      console.log("Attempt ID:", attemptId);
      console.log("Answers count:", answers?.length || 0);

      // Validate that answers is provided
      if (!answers || !Array.isArray(answers)) {
        console.log("❌ No answers array provided");
        return res.status(400).json({ message: "Answers array is required" });
      }

      // Fetch the attempt to get the quiz ID
      console.log("Fetching attempt...");
      const attempt = await dao.findAttemptById(attemptId);
      if (!attempt) {
        console.log("❌ Attempt not found");
        return res.status(404).json({ message: "Attempt not found" });
      }
      
      console.log("Attempt found:");
      console.log("  - Started at:", attempt.startedAt);
      console.log("  - Current elapsed:", attempt.elapsedSeconds);
      console.log("  - Question order:", attempt.questionOrder);

      // Fetch the quiz with correct answers
      console.log("Fetching quiz...");
      const QuizzesDao = (await import("../Quizzes/dao.js")).default;
      const quizzesDao = QuizzesDao({});
      const quiz = await quizzesDao.findQuizById(attempt.quiz);
      
      if (!quiz) {
        console.log("❌ Quiz not found");
        return res.status(404).json({ message: "Quiz not found" });
      }
      
      console.log("Quiz found:", quiz.title);
      console.log("  - Time limit enabled:", quiz.timeLimit);
      console.log("  - Time limit minutes:", quiz.timeLimitMinutes);

      // Validate time limit if enabled
      let finalElapsedSeconds = attempt.elapsedSeconds || 0;
      if (quiz.timeLimit === true && quiz.timeLimitMinutes) {
        const timeLimitSeconds = quiz.timeLimitMinutes * 60;
        const now = new Date();
        const startedAt = new Date(attempt.startedAt);
        const actualElapsedSeconds = Math.floor((now - startedAt) / 1000);
        
        console.log("=== TIME VALIDATION ===");
        console.log("Started at:", startedAt.toISOString());
        console.log("Now:", now.toISOString());
        console.log("Actual elapsed from start:", actualElapsedSeconds, "seconds");
        console.log("Stored elapsed:", attempt.elapsedSeconds || 0, "seconds");
        console.log("Time limit:", timeLimitSeconds, "seconds");
        
        const maxElapsedSeconds = Math.max(
          attempt.elapsedSeconds || 0,
          actualElapsedSeconds
        );
        
        if (maxElapsedSeconds > timeLimitSeconds) {
          console.log("⚠️  Time limit exceeded! Capping at limit.");
          finalElapsedSeconds = timeLimitSeconds;
        } else {
          finalElapsedSeconds = maxElapsedSeconds;
        }
        
        console.log("Final elapsed seconds:", finalElapsedSeconds);
      } else if (attempt.elapsedSeconds !== undefined) {
        finalElapsedSeconds = attempt.elapsedSeconds;
        console.log("No time limit, using stored elapsed:", finalElapsedSeconds);
      }

      // Calculate score on backend
      console.log("Calculating score...");
      const { score, totalPoints, isCorrect } = dao.calculateQuizScore(quiz, answers);

      // Prepare submission timestamp
      const submittedAt = new Date();
      console.log("Submission timestamp:", submittedAt.toISOString());
      
      console.log("=== SUBMITTING ATTEMPT ===");
      console.log("Score:", score);
      console.log("Total points:", totalPoints);
      console.log("Percentage:", ((score / totalPoints) * 100).toFixed(2) + "%");

      // Update the attempt with calculated values AND isCorrect array
      await dao.submitAttempt(attemptId, answers, score, totalPoints, finalElapsedSeconds, isCorrect, submittedAt);
      
      // Fetch updated attempt
      const updatedAttempt = await dao.findAttemptById(attemptId);

      console.log("✓ SUCCESS - Attempt submitted");
      console.log("  - Score:", updatedAttempt?.score);
      console.log("  - Submitted at:", updatedAttempt?.submittedAt);

      // Return attempt with score, totalPoints, and isCorrect array
      res.json({
        ...updatedAttempt,
        isCorrect: updatedAttempt.isCorrect || isCorrect,
      });
    } catch (error) {
      console.error("❌ Error submitting attempt:", error);
      console.error("Stack trace:", error.stack);
      res.status(500).json({ message: "Server error submitting attempt", error: error.message });
    }
  };

  console.log("=== REGISTERING QUIZ ATTEMPT ROUTES ===");
  app.get("/api/quizzes/:quizId/attempts", findAttemptsForQuiz);
  app.get("/api/users/:userId/quizzes/:quizId/attempts", findAttemptsForUserAndQuiz);
  app.get("/api/users/:userId/quizzes/:quizId/attempts/latest", findLatestAttempt);
  app.get("/api/users/:userId/quizzes/:quizId/final-score", findFinalScore);
  app.get("/api/users/:userId/quizzes/:quizId/attempts/history", findAttemptHistory);
  app.post("/api/quizzes/:quizId/attempts", createAttempt);
  app.put("/api/attempts/:attemptId", updateAttempt);
  app.post("/api/attempts/:attemptId/submit", submitAttempt);
  console.log("✓ Quiz attempt routes registered");
}

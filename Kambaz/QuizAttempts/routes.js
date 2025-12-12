import QuizAttemptsDao from "./dao.js";

export default function QuizAttemptsRoutes(app, db) {
  const dao = QuizAttemptsDao(db);

  const findAttemptsForQuiz = async (req, res) => {
    try {
      const { quizId } = req.params;
      const attempts = await dao.findAttemptsForQuiz(quizId);
      res.json(attempts);
    } catch (error) {
      console.error("Error finding attempts for quiz:", error);
      res.status(500).json({ message: "Server error fetching attempts", error: error.message });
    }
  };

  const findAttemptsForUserAndQuiz = async (req, res) => {
    try {
      const { userId, quizId } = req.params;
      const attempts = await dao.findAttemptsForUserAndQuiz(userId, quizId);
      res.json(attempts);
    } catch (error) {
      console.error("Error finding attempts:", error);
      res.status(500).json({ message: "Server error fetching attempts", error: error.message });
    }
  };

  const findLatestAttempt = async (req, res) => {
    try {
      const { userId, quizId } = req.params;
      const attempt = await dao.findLatestAttemptForUserAndQuiz(userId, quizId);
      res.json(attempt);
    } catch (error) {
      console.error("Error finding latest attempt:", error);
      res.status(500).json({ message: "Server error fetching attempt", error: error.message });
    }
  };

  const findFinalScore = async (req, res) => {
    try {
      const { userId, quizId } = req.params;
      const attempt = await dao.findFinalScoreAttemptForUserAndQuiz(userId, quizId);
      if (!attempt) {
        return res.status(404).json({ message: "No final score attempt found" });
      }
      res.json(attempt);
    } catch (error) {
      console.error("Error finding final score:", error);
      res.status(500).json({ message: "Server error fetching final score", error: error.message });
    }
  };

  const findAttemptHistory = async (req, res) => {
    try {
      const { userId, quizId } = req.params;
      const attempts = await dao.findAttemptHistoryForUserAndQuiz(userId, quizId);
      res.json(attempts);
    } catch (error) {
      console.error("Error finding attempt history:", error);
      res.status(500).json({ message: "Server error fetching attempt history", error: error.message });
    }
  };

  const createAttempt = async (req, res) => {
    try {
      const { quizId } = req.params;
      const currentUser = req.session["currentUser"];
      if (!currentUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if quiz exists and is published
      const QuizzesDao = (await import("../Quizzes/dao.js")).default;
      const quizzesDao = QuizzesDao({});
      const quiz = await quizzesDao.findQuizById(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      if (!quiz.published) {
        return res.status(403).json({ message: "Quiz is not published" });
      }

      // Check for existing unsubmitted attempt (resume on refresh)
      const existingAttempt = await dao.findUnsubmittedAttemptForUserAndQuiz(
        currentUser._id,
        quizId
      );
      if (existingAttempt) {
        // Return existing attempt with saved state
        return res.json(existingAttempt);
      }

      // Check attempt limits
      const attemptCount = await dao.getAttemptCountForUserAndQuiz(
        currentUser._id,
        quizId
      );
      
      console.log("=== CREATE ATTEMPT DEBUG ===");
      console.log("User ID:", currentUser._id);
      console.log("Quiz ID:", quizId);
      console.log("Current attempt count:", attemptCount);
      console.log("Quiz multipleAttempts:", quiz.multipleAttempts);
      console.log("Quiz attemptsAllowed:", quiz.attemptsAllowed);
      console.log("Should block?", attemptCount >= (quiz.attemptsAllowed || 1));
      
      if (quiz.multipleAttempts) {
        if (attemptCount >= (quiz.attemptsAllowed || 1)) {
          return res.status(403).json({ message: "Maximum attempts reached" });
        }
      } else {
        if (attemptCount > 0) {
          return res.status(403).json({ message: "Multiple attempts not allowed" });
        }
      }

      const attemptNumber = attemptCount + 1;
      const newAttempt = await dao.createAttempt(quizId, currentUser._id, attemptNumber);
      res.json(newAttempt);
    } catch (error) {
      console.error("Error creating attempt:", error);
      res.status(500).json({ message: "Server error creating attempt", error: error.message });
    }
  };

  const updateAttempt = async (req, res) => {
    try {
      const { attemptId } = req.params;
      const { answers, currentQuestionIndex, elapsedSeconds } = req.body;
      
      // Build update object with only provided fields
      const attemptUpdates = {};
      if (answers !== undefined) {
        attemptUpdates.answers = answers;
      }
      if (currentQuestionIndex !== undefined) {
        attemptUpdates.currentQuestionIndex = currentQuestionIndex;
      }
      if (elapsedSeconds !== undefined) {
        attemptUpdates.elapsedSeconds = elapsedSeconds;
      }

      const status = await dao.updateAttempt(attemptId, attemptUpdates);
      if (status.matchedCount === 0) {
        return res.status(404).json({ message: "Attempt not found" });
      }
      const updatedAttempt = await dao.findAttemptById(attemptId);
      res.json(updatedAttempt);
    } catch (error) {
      console.error("Error updating attempt:", error);
      res.status(500).json({ message: "Server error updating attempt", error: error.message });
    }
  };

  const submitAttempt = async (req, res) => {
    try {
      const { attemptId } = req.params;
      const { answers } = req.body; // Only receive answers array from frontend

      // Validate that answers is provided
      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ message: "Answers array is required" });
      }

      // Fetch the attempt to get the quiz ID
      const attempt = await dao.findAttemptById(attemptId);
      if (!attempt) {
        return res.status(404).json({ message: "Attempt not found" });
      }

      // Fetch the quiz with correct answers
      const QuizzesDao = (await import("../Quizzes/dao.js")).default;
      const quizzesDao = QuizzesDao({});
      const quiz = await quizzesDao.findQuizById(attempt.quiz);
      
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      // Validate time limit if enabled
      let finalElapsedSeconds = attempt.elapsedSeconds || 0;
      if (quiz.timeLimit === true && quiz.timeLimitMinutes) {
        const timeLimitSeconds = quiz.timeLimitMinutes * 60;
        const now = new Date();
        const startedAt = new Date(attempt.startedAt);
        const actualElapsedSeconds = Math.floor((now - startedAt) / 1000);
        
        // Use the maximum of stored elapsedSeconds and actual elapsed time
        // This prevents users from manipulating time by refreshing
        const maxElapsedSeconds = Math.max(
          attempt.elapsedSeconds || 0,
          actualElapsedSeconds
        );
        
        // If time limit exceeded, cap at time limit (don't allow extra time)
        if (maxElapsedSeconds > timeLimitSeconds) {
          finalElapsedSeconds = timeLimitSeconds;
          // Note: We still allow submission, but time is capped
        } else {
          finalElapsedSeconds = maxElapsedSeconds;
        }
      } else if (attempt.elapsedSeconds !== undefined) {
        // If no time limit, use stored elapsedSeconds
        finalElapsedSeconds = attempt.elapsedSeconds;
      }

      // Calculate score on backend
      const { score, totalPoints, isCorrect } = dao.calculateQuizScore(quiz, answers);

      // Update the attempt with calculated values and final elapsed time
      await dao.submitAttempt(attemptId, answers, score, totalPoints, finalElapsedSeconds);
      
      // Fetch updated attempt
      const updatedAttempt = await dao.findAttemptById(attemptId);

      // Return attempt with score, totalPoints, and isCorrect array
      res.json({
        ...updatedAttempt,
        isCorrect, // Include isCorrect array in response
      });
    } catch (error) {
      console.error("Error submitting attempt:", error);
      res.status(500).json({ message: "Server error submitting attempt", error: error.message });
    }
  };

  app.get("/api/quizzes/:quizId/attempts", findAttemptsForQuiz);
  app.get("/api/users/:userId/quizzes/:quizId/attempts", findAttemptsForUserAndQuiz);
  app.get("/api/users/:userId/quizzes/:quizId/attempts/latest", findLatestAttempt);
  app.get("/api/users/:userId/quizzes/:quizId/final-score", findFinalScore);
  app.get("/api/users/:userId/quizzes/:quizId/attempts/history", findAttemptHistory);
  app.post("/api/quizzes/:quizId/attempts", createAttempt);
  app.put("/api/attempts/:attemptId", updateAttempt);
  app.post("/api/attempts/:attemptId/submit", submitAttempt);
}


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

      // Check attempt limits
      const attemptCount = await dao.getAttemptCountForUserAndQuiz(
        currentUser._id,
        quizId
      );
      
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
      const attemptUpdates = req.body;
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
      const { answers, score, totalPoints } = req.body;
      await dao.submitAttempt(attemptId, answers, score, totalPoints);
      const updatedAttempt = await dao.findAttemptById(attemptId);
      res.json(updatedAttempt);
    } catch (error) {
      console.error("Error submitting attempt:", error);
      res.status(500).json({ message: "Server error submitting attempt", error: error.message });
    }
  };

  app.get("/api/quizzes/:quizId/attempts", findAttemptsForQuiz);
  app.get("/api/users/:userId/quizzes/:quizId/attempts", findAttemptsForUserAndQuiz);
  app.get("/api/users/:userId/quizzes/:quizId/attempts/latest", findLatestAttempt);
  app.post("/api/quizzes/:quizId/attempts", createAttempt);
  app.put("/api/attempts/:attemptId", updateAttempt);
  app.post("/api/attempts/:attemptId/submit", submitAttempt);
}


import QuizzesDao from "./dao.js";

export default function QuizRoutes(app, db) {
  const dao = QuizzesDao(db);

  const findQuizzesForCourse = async (req, res) => {
    try {
      const { courseId } = req.params;
      const quizzes = await dao.findQuizzesForCourse(courseId);
      res.json(quizzes);
    } catch (error) {
      console.error("Error finding quizzes for course:", error);
      res.status(500).json({ message: "Server error fetching quizzes", error: error.message });
    }
  };

  const findQuizById = async (req, res) => {
    try {
      const { quizId } = req.params;
      const quiz = await dao.findQuizById(quizId);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      res.json(quiz);
    } catch (error) {
      console.error("Error finding quiz by ID:", error);
      res.status(500).json({ message: "Server error fetching quiz", error: error.message });
    }
  };

  const createQuiz = async (req, res) => {
    try {
      const { courseId } = req.params;
      const quiz = req.body;
      const newQuiz = await dao.createQuiz(courseId, quiz);
      res.json(newQuiz);
    } catch (error) {
      console.error("Error creating quiz:", error);
      res.status(500).json({ message: "Server error creating quiz", error: error.message });
    }
  };

  const updateQuiz = async (req, res) => {
    try {
      const { quizId } = req.params;
      const quizUpdates = req.body;
      const status = await dao.updateQuiz(quizId, quizUpdates);
      if (status.matchedCount === 0) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      const updatedQuiz = await dao.findQuizById(quizId);
      res.json(updatedQuiz);
    } catch (error) {
      console.error("Error updating quiz:", error);
      res.status(500).json({ message: "Server error updating quiz", error: error.message });
    }
  };

  const deleteQuiz = async (req, res) => {
    try {
      const { quizId } = req.params;
      const result = await dao.deleteQuiz(quizId);
      if (!result || !result._id) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting quiz:", error);
      res.status(500).json({ message: "Server error deleting quiz", error: error.message });
    }
  };

  const publishQuiz = async (req, res) => {
    try {
      const { quizId } = req.params;
      const { published } = req.body;
      const status = await dao.publishQuiz(quizId, published);
      if (status.matchedCount === 0) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      const updatedQuiz = await dao.findQuizById(quizId);
      res.json(updatedQuiz);
    } catch (error) {
      console.error("Error publishing quiz:", error);
      res.status(500).json({ message: "Server error publishing quiz", error: error.message });
    }
  };

  const addQuestion = async (req, res) => {
    try {
      const { quizId } = req.params;
      const question = req.body;
      await dao.addQuestion(quizId, question);
      const updatedQuiz = await dao.findQuizById(quizId);
      res.json(updatedQuiz);
    } catch (error) {
      console.error("Error adding question:", error);
      res.status(500).json({ message: "Server error adding question", error: error.message });
    }
  };

  const updateQuestion = async (req, res) => {
    try {
      const { quizId, questionId } = req.params;
      const questionUpdates = req.body;
      await dao.updateQuestion(quizId, questionId, questionUpdates);
      const updatedQuiz = await dao.findQuizById(quizId);
      res.json(updatedQuiz);
    } catch (error) {
      console.error("Error updating question:", error);
      res.status(500).json({ message: "Server error updating question", error: error.message });
    }
  };

  const deleteQuestion = async (req, res) => {
    try {
      const { quizId, questionId } = req.params;
      const status = await dao.deleteQuestion(quizId, questionId);
      if (status.matchedCount === 0) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      const updatedQuiz = await dao.findQuizById(quizId);
      res.json(updatedQuiz);
    } catch (error) {
      console.error("Error deleting question:", error);
      res.status(500).json({ message: "Server error deleting question", error: error.message });
    }
  };

  app.get("/api/courses/:courseId/quizzes", findQuizzesForCourse);
  app.get("/api/quizzes/:quizId", findQuizById);
  app.post("/api/courses/:courseId/quizzes", createQuiz);
  app.put("/api/quizzes/:quizId", updateQuiz);
  app.delete("/api/quizzes/:quizId", deleteQuiz);
  app.put("/api/quizzes/:quizId/publish", publishQuiz);
  app.post("/api/quizzes/:quizId/questions", addQuestion);
  app.put("/api/quizzes/:quizId/questions/:questionId", updateQuestion);
  app.delete("/api/quizzes/:quizId/questions/:questionId", deleteQuestion);
}


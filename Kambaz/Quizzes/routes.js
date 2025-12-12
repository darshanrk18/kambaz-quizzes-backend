import QuizzesDao from "./dao.js";

// Validation helper functions
function validateQuestion(question) {
  // Validate points
  if (!question.points || question.points <= 0) {
    return { valid: false, message: "Question points must be greater than 0" };
  }

  // Validate answer options based on question type
  switch (question.questionType) {
    case "Multiple Choice": {
      if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
        return {
          valid: false,
          message: "Multiple Choice questions must have at least 2 options",
        };
      }
      const hasCorrectOption = question.options.some((option) => option.isCorrect === true);
      if (!hasCorrectOption) {
        return {
          valid: false,
          message: "Multiple Choice questions must have at least 1 correct option",
        };
      }
      break;
    }

    case "True/False": {
      if (
        question.correctAnswer === undefined ||
        question.correctAnswer === null ||
        typeof question.correctAnswer !== "boolean"
      ) {
        return {
          valid: false,
          message: "True/False questions must have a correctAnswer defined (true or false)",
        };
      }
      break;
    }

    case "Fill in the Blank": {
      if (!question.blanks || !Array.isArray(question.blanks) || question.blanks.length === 0) {
        return {
          valid: false,
          message: "Fill in the Blank questions must have at least 1 blank",
        };
      }
      const allBlanksHaveAnswers = question.blanks.every(
        (blank) =>
          blank.correctAnswers &&
          Array.isArray(blank.correctAnswers) &&
          blank.correctAnswers.length > 0
      );
      if (!allBlanksHaveAnswers) {
        return {
          valid: false,
          message: "Each blank in Fill in the Blank questions must have at least 1 correctAnswer",
        };
      }
      break;
    }

    default:
      return { valid: false, message: `Invalid question type: ${question.questionType}` };
  }

  return { valid: true };
}

function validateQuizQuestions(quiz, isPublishing = false) {
  const questions = quiz.questions || [];

  // Check if quiz has at least 1 question before publishing
  if (isPublishing && questions.length === 0) {
    return {
      valid: false,
      message: "Quiz must have at least one question before publishing",
    };
  }

  // Date validations for publishing
  if (isPublishing) {
    if (!quiz.availableDate) {
      return {
        valid: false,
        message: "'Available From' date is required before publishing",
      };
    }

    if (!quiz.dueDate) {
      return {
        valid: false,
        message: "'Due Date' is required before publishing",
      };
    }

    if (!quiz.untilDate) {
      return {
        valid: false,
        message: "'Until' date is required before publishing",
      };
    }
  }

  // Validate each question
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const questionValidation = validateQuestion(question);
    if (!questionValidation.valid) {
      return {
        valid: false,
        message: `Question ${i + 1}: ${questionValidation.message}`,
      };
    }
  }

  // REMOVED: Points validation - any question can have any points
  // Quiz points will auto-calculate as sum of all questions
  // const totalQuestionPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
  // if (quiz.points !== undefined && quiz.points !== null && totalQuestionPoints > quiz.points) {
  //   return {
  //     valid: false,
  //     message: `Total question points (${totalQuestionPoints}) exceeds quiz points limit (${quiz.points})`,
  //   };
  // }

  return { valid: true };
}

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

      // Validate quiz questions and points
      const validation = validateQuizQuestions(quiz, quiz.published === true);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }

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

      // Get current quiz to merge with updates for validation
      const currentQuiz = await dao.findQuizById(quizId);
      if (!currentQuiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      // Merge current quiz with updates for validation
      const mergedQuiz = { ...currentQuiz, ...quizUpdates };
      if (quizUpdates.questions) {
        mergedQuiz.questions = quizUpdates.questions;
      }

      // Check if trying to publish
      const isPublishing = quizUpdates.published === true || mergedQuiz.published === true;

      // Validate quiz questions and points
      const validation = validateQuizQuestions(mergedQuiz, isPublishing);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }

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

      // If trying to publish, validate quiz has questions
      if (published === true) {
        const quiz = await dao.findQuizById(quizId);
        if (!quiz) {
          return res.status(404).json({ message: "Quiz not found" });
        }

        // Validate quiz questions and points before publishing
        const validation = validateQuizQuestions(quiz, true);
        if (!validation.valid) {
          return res.status(400).json({ message: validation.message });
        }
      }

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

      console.log("=== ADD QUESTION DEBUG ===");
      console.log("Quiz ID:", quizId);
      console.log("Question data:", question);
      console.log("Question points:", question.points);

      // Validate the question
      const questionValidation = validateQuestion(question);
      if (!questionValidation.valid) {
        return res.status(400).json({ message: questionValidation.message });
      }

      // Get current quiz
      const currentQuiz = await dao.findQuizById(quizId);
      if (!currentQuiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      console.log("Current quiz points:", currentQuiz.points);

      await dao.addQuestion(quizId, question);
      const updatedQuiz = await dao.findQuizById(quizId);
      // Recalculate total points
      const totalPoints = updatedQuiz.questions.reduce(
        (sum, q) => sum + (q.points || 0),
        0
      );
      await dao.updateQuiz(quizId, { points: totalPoints });
      
      console.log("=== AFTER ADD QUESTION ===");
      console.log("Total points calculated:", totalPoints);
      console.log("Number of questions:", updatedQuiz.questions.length);
      
      const finalQuiz = await dao.findQuizById(quizId);
      res.json(finalQuiz);
    } catch (error) {
      console.error("Error adding question:", error);
      res.status(500).json({ message: "Server error adding question", error: error.message });
    }
  };

  const updateQuestion = async (req, res) => {
    try {
      const { quizId, questionId } = req.params;
      const questionUpdates = req.body;

      // Get current quiz and question
      const currentQuiz = await dao.findQuizById(quizId);
      if (!currentQuiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }

      const currentQuestion = currentQuiz.questions.find((q) => q._id === questionId);
      if (!currentQuestion) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Merge current question with updates for validation
      const mergedQuestion = { ...currentQuestion, ...questionUpdates };

      // Validate the updated question
      const questionValidation = validateQuestion(mergedQuestion);
      if (!questionValidation.valid) {
        return res.status(400).json({ message: questionValidation.message });
      }

      // REMOVED: Points validation - any question can have any points
      // Quiz points will auto-calculate as sum of all questions

      await dao.updateQuestion(quizId, questionId, questionUpdates);
      const updatedQuiz = await dao.findQuizById(quizId);
      // Recalculate total points
      const totalPoints = updatedQuiz.questions.reduce(
        (sum, q) => sum + (q.points || 0),
        0
      );
      await dao.updateQuiz(quizId, { points: totalPoints });
      const finalQuiz = await dao.findQuizById(quizId);
      res.json(finalQuiz);
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
      // Recalculate total points
      const totalPoints = updatedQuiz.questions.reduce(
        (sum, q) => sum + (q.points || 0),
        0
      );
      await dao.updateQuiz(quizId, { points: totalPoints });
      const finalQuiz = await dao.findQuizById(quizId);
      res.json(finalQuiz);
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


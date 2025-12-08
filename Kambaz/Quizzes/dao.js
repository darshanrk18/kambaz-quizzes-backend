import { v4 as uuidv4 } from "uuid";
import model from "./model.js";

export default function QuizzesDao(db) {
  async function findQuizzesForCourse(courseId) {
    return model.find({ course: courseId }).sort({ availableDate: 1 }).lean();
  }

  async function findQuizById(quizId) {
    return model.findById(quizId).lean();
  }

  async function createQuiz(courseId, quiz) {
    // Calculate points from questions if not provided
    const points = quiz.points || 0;
    const newQuiz = {
      ...quiz,
      _id: uuidv4(),
      course: courseId,
      published: false,
      questions: [],
      quizType: quiz.quizType || "Graded Quiz",
      assignmentGroup: quiz.assignmentGroup || "Quizzes",
      shuffleAnswers: quiz.shuffleAnswers !== false,
      timeLimit: quiz.timeLimit !== false,
      timeLimitMinutes: quiz.timeLimitMinutes || 20,
      multipleAttempts: quiz.multipleAttempts || false,
      attemptsAllowed: quiz.attemptsAllowed || 1,
      showCorrectAnswers: quiz.showCorrectAnswers || "Never",
      accessCode: quiz.accessCode || "",
      oneQuestionAtATime: quiz.oneQuestionAtATime !== false,
      webcamRequired: quiz.webcamRequired || false,
      lockQuestionsAfterAnswering: quiz.lockQuestionsAfterAnswering || false,
      points,
    };
    return model.create(newQuiz);
  }

  async function updateQuiz(quizId, quizUpdates) {
    // Recalculate points from questions if questions are updated
    if (quizUpdates.questions) {
      const totalPoints = quizUpdates.questions.reduce(
        (sum, q) => sum + (q.points || 0),
        0
      );
      quizUpdates.points = totalPoints;
    }
    return model.updateOne({ _id: quizId }, { $set: quizUpdates });
  }

  async function deleteQuiz(quizId) {
    return model.findByIdAndDelete(quizId);
  }

  async function publishQuiz(quizId, published) {
    return model.updateOne({ _id: quizId }, { $set: { published } });
  }

  async function addQuestion(quizId, question) {
    const questionWithId = { ...question, _id: uuidv4() };
    const result = await model.updateOne(
      { _id: quizId },
      { $push: { questions: questionWithId } }
    );
    return result;
  }

  async function updateQuestion(quizId, questionId, questionUpdates) {
    const quiz = await model.findById(quizId);
    if (!quiz) {
      throw new Error("Quiz not found");
    }
    const question = quiz.questions.id(questionId);
    if (!question) {
      throw new Error("Question not found");
    }
    Object.assign(question, questionUpdates);
    await quiz.save();
    return question;
  }

  async function deleteQuestion(quizId, questionId) {
    return model.updateOne(
      { _id: quizId },
      { $pull: { questions: { _id: questionId } } }
    );
  }

  return {
    findQuizzesForCourse,
    findQuizById,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    publishQuiz,
    addQuestion,
    updateQuestion,
    deleteQuestion,
  };
}


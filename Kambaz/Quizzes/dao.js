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
    const newQuiz = {
      ...quiz,
      _id: uuidv4(),
      course: courseId,
      published: false,
      questions: [],
    };
    return model.create(newQuiz);
  }

  async function updateQuiz(quizId, quizUpdates) {
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
    return model.updateOne(
      { _id: quizId },
      { $push: { questions: questionWithId } }
    );
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


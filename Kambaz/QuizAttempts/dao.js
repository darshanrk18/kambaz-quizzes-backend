import { v4 as uuidv4 } from "uuid";
import model from "./model.js";

export default function QuizAttemptsDao(db) {
  async function findAttemptsForQuiz(quizId) {
    return model.find({ quiz: quizId }).sort({ submittedAt: -1 }).lean();
  }

  async function findAttemptsForUser(userId) {
    return model.find({ user: userId }).sort({ submittedAt: -1 }).lean();
  }

  async function findAttemptsForUserAndQuiz(userId, quizId) {
    return model
      .find({ user: userId, quiz: quizId })
      .sort({ attemptNumber: -1 })
      .lean();
  }

  async function findLatestAttemptForUserAndQuiz(userId, quizId) {
    return model
      .findOne({ user: userId, quiz: quizId })
      .sort({ attemptNumber: -1 })
      .lean();
  }

  async function findAttemptById(attemptId) {
    return model.findById(attemptId).lean();
  }

  async function createAttempt(quizId, userId, attemptNumber) {
    const newAttempt = {
      _id: uuidv4(),
      quiz: quizId,
      user: userId,
      answers: [],
      score: 0,
      totalPoints: 0,
      startedAt: new Date(),
      submittedAt: null,
      attemptNumber,
    };
    return model.create(newAttempt);
  }

  async function updateAttempt(attemptId, attemptUpdates) {
    return model.updateOne({ _id: attemptId }, { $set: attemptUpdates });
  }

  async function submitAttempt(attemptId, answers, score, totalPoints) {
    return model.updateOne(
      { _id: attemptId },
      {
        $set: {
          answers,
          score,
          totalPoints,
          submittedAt: new Date(),
        },
      }
    );
  }

  async function getAttemptCountForUserAndQuiz(userId, quizId) {
    return model.countDocuments({ user: userId, quiz: quizId });
  }

  return {
    findAttemptsForQuiz,
    findAttemptsForUser,
    findAttemptsForUserAndQuiz,
    findLatestAttemptForUserAndQuiz,
    findAttemptById,
    createAttempt,
    updateAttempt,
    submitAttempt,
    getAttemptCountForUserAndQuiz,
  };
}


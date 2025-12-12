import mongoose from "mongoose";

const answerSchema = new mongoose.Schema({
  questionId: String,
  // For Multiple Choice - array of selected option indices
  selectedOptions: [Number],
  // For True/False - boolean
  trueFalseAnswer: Boolean,
  // For Fill in the Blank - array of answers for each blank
  fillInAnswers: [String],
}, { _id: false });

const quizAttemptSchema = new mongoose.Schema(
  {
    _id: String,
    quiz: { type: String, ref: "QuizModel" },
    user: { type: String, ref: "UserModel" },
    answers: [answerSchema],
    score: Number,
    totalPoints: Number,
    startedAt: Date,
    submittedAt: Date,
    attemptNumber: Number,
    currentQuestionIndex: Number,
    elapsedSeconds: Number,
    isFinalScore: { type: Boolean, default: true },
    isCorrect: [{ type: Boolean }],
  },
  { collection: "quizAttempts" }
);

export default quizAttemptSchema;


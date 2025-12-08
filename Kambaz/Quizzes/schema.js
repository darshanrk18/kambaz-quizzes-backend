import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  _id: String,
  title: String,
  question: String,
  questionType: {
    type: String,
    enum: ["Multiple Choice", "True/False", "Fill in the Blank"],
    default: "Multiple Choice",
  },
  points: Number,
  // For Multiple Choice
  options: [{
    text: String,
    isCorrect: Boolean,
  }],
  // For True/False
  correctAnswer: Boolean,
  // For Fill in the Blank
  blanks: [{
    text: String,
    correctAnswers: [String],
  }],
});

const quizSchema = new mongoose.Schema(
  {
    _id: String,
    course: { type: String, ref: "CourseModel" },
    title: String,
    description: String,
    points: Number,
    shuffleAnswers: { type: Boolean, default: false },
    timeLimit: { type: Boolean, default: false },
    timeLimitMinutes: Number,
    dueDate: String,
    availableDate: String,
    untilDate: String,
    published: { type: Boolean, default: false },
    questions: [questionSchema],
  },
  { collection: "quizzes" }
);

export default quizSchema;


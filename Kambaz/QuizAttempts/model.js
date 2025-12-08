import mongoose from "mongoose";
import schema from "./schema.js";

const model = mongoose.model("QuizAttemptModel", schema);

export default model;


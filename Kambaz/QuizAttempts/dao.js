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

  async function findUnsubmittedAttemptForUserAndQuiz(userId, quizId) {
    return model
      .findOne({ user: userId, quiz: quizId, submittedAt: null })
      .sort({ startedAt: -1 })
      .lean();
  }

  async function findAttemptById(attemptId) {
    return model.findById(attemptId).lean();
  }

  async function createAttempt(quizId, userId, attemptNumber) {
    // Mark all previous attempts as not final
    await markPreviousAttemptsAsNotFinal(userId, quizId);

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
      currentQuestionIndex: 0,
      elapsedSeconds: 0,
      isFinalScore: true, // New attempt is the final score
    };
    return model.create(newAttempt);
  }

  async function updateAttempt(attemptId, attemptUpdates) {
    return model.updateOne({ _id: attemptId }, { $set: attemptUpdates });
  }

  async function submitAttempt(attemptId, answers, score, totalPoints, elapsedSeconds) {
    // Get the attempt to find userId and quizId
    const attempt = await model.findById(attemptId).lean();
    if (!attempt) {
      throw new Error("Attempt not found");
    }

    // Mark all previous attempts as not final
    await markPreviousAttemptsAsNotFinal(attempt.user, attempt.quiz, attemptId);

    const updateData = {
      answers,
      score,
      totalPoints,
      submittedAt: new Date(),
      isFinalScore: true, // Current attempt becomes the final score
    };
    
    // Include elapsedSeconds if provided
    if (elapsedSeconds !== undefined) {
      updateData.elapsedSeconds = elapsedSeconds;
    }
    
    return model.updateOne(
      { _id: attemptId },
      {
        $set: updateData,
      }
    );
  }

  async function getAttemptCountForUserAndQuiz(userId, quizId) {
    // Only count submitted attempts - unsubmitted/abandoned attempts shouldn't count
    return model.countDocuments({ 
      user: userId, 
      quiz: quizId,
      submittedAt: { $ne: null }  // Only count submitted attempts
    });
  }

  async function markPreviousAttemptsAsNotFinal(userId, quizId, excludeAttemptId = null) {
    const query = { user: userId, quiz: quizId, isFinalScore: true };
    if (excludeAttemptId) {
      query._id = { $ne: excludeAttemptId };
    }
    return model.updateMany(query, { $set: { isFinalScore: false } });
  }

  async function findFinalScoreAttemptForUserAndQuiz(userId, quizId) {
    return model
      .findOne({ user: userId, quiz: quizId, isFinalScore: true })
      .sort({ submittedAt: -1 })
      .lean();
  }

  async function findAttemptHistoryForUserAndQuiz(userId, quizId) {
    return model
      .find({ user: userId, quiz: quizId, submittedAt: { $ne: null } })
      .select("_id attemptNumber score totalPoints submittedAt isFinalScore")
      .sort({ attemptNumber: -1 })
      .lean();
  }

  function calculateQuizScore(quiz, answers) {
    let totalScore = 0;
    let totalPoints = 0;
    const isCorrect = [];

    // Create a map of answers by questionId for quick lookup
    const answersMap = {};
    answers.forEach((answer) => {
      answersMap[answer.questionId] = answer;
    });

    // Process each question in the quiz
    quiz.questions.forEach((question) => {
      const questionPoints = question.points || 0;
      totalPoints += questionPoints;
      
      const answer = answersMap[question._id];
      let questionCorrect = false;
      let earnedPoints = 0;

      if (!answer) {
        // No answer provided
        isCorrect.push(false);
        return;
      }

      switch (question.questionType) {
        case "Multiple Choice": {
          // Check if selectedOptions[0] matches the correct option index
          const selectedIndex = answer.selectedOptions && answer.selectedOptions[0];
          if (selectedIndex !== undefined && selectedIndex !== null) {
            // Find the index of the correct option
            const correctOptionIndex = question.options.findIndex(
              (option) => option.isCorrect === true
            );
            questionCorrect = selectedIndex === correctOptionIndex;
            earnedPoints = questionCorrect ? questionPoints : 0;
          }
          break;
        }

        case "True/False": {
          // Check if trueFalseAnswer matches correctAnswer
          if (answer.trueFalseAnswer !== undefined && answer.trueFalseAnswer !== null) {
            questionCorrect = answer.trueFalseAnswer === question.correctAnswer;
            earnedPoints = questionCorrect ? questionPoints : 0;
          }
          break;
        }

        case "Fill in the Blank": {
          // For each blank, check if fillInAnswers[i] matches any correctAnswer
          // Respect caseSensitive flag; award points per blank (total points / number of blanks)
          if (!question.blanks || question.blanks.length === 0) {
            questionCorrect = false;
            earnedPoints = 0;
            break;
          }

          const pointsPerBlank = questionPoints / question.blanks.length;
          let blanksCorrect = 0;
          const isCaseSensitive = question.caseSensitive === true;

          const normalize = (value) => {
            if (value === undefined || value === null) return null;
            const trimmed = `${value}`.trim();
            return isCaseSensitive ? trimmed : trimmed.toLowerCase();
          };

          if (answer.fillInAnswers && Array.isArray(answer.fillInAnswers)) {
            question.blanks.forEach((blank, index) => {
              const normalizedUserAnswer = normalize(
                answer.fillInAnswers[index]
              );
              if (normalizedUserAnswer !== null) {
                const matches = (blank.correctAnswers || []).some(
                  (correctAnswer) =>
                    normalize(correctAnswer) === normalizedUserAnswer
                );
                if (matches) blanksCorrect++;
              }
            });
          }

          earnedPoints = blanksCorrect * pointsPerBlank;
          questionCorrect = blanksCorrect === question.blanks.length;
          break;
        }

        default:
          questionCorrect = false;
          earnedPoints = 0;
      }

      isCorrect.push(questionCorrect);
      totalScore += earnedPoints;
    });

    return {
      score: totalScore,
      totalPoints,
      isCorrect,
    };
  }

  return {
    findAttemptsForQuiz,
    findAttemptsForUser,
    findAttemptsForUserAndQuiz,
    findLatestAttemptForUserAndQuiz,
    findUnsubmittedAttemptForUserAndQuiz,
    findFinalScoreAttemptForUserAndQuiz,
    findAttemptHistoryForUserAndQuiz,
    findAttemptById,
    createAttempt,
    updateAttempt,
    submitAttempt,
    getAttemptCountForUserAndQuiz,
    calculateQuizScore,
    markPreviousAttemptsAsNotFinal,
  };
}


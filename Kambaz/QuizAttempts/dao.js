import { v4 as uuidv4 } from "uuid";
import model from "./model.js";

export default function QuizAttemptsDao(db) {
  async function findAttemptsForQuiz(quizId) {
    console.log("=== DAO: findAttemptsForQuiz ===");
    console.log("Quiz ID:", quizId);
    const result = await model.find({ quiz: quizId }).sort({ submittedAt: -1 }).lean();
    console.log("Found attempts:", result.length);
    return result;
  }

  async function findAttemptsForUser(userId) {
    console.log("=== DAO: findAttemptsForUser ===");
    console.log("User ID:", userId);
    const result = await model.find({ user: userId }).sort({ submittedAt: -1 }).lean();
    console.log("Found attempts:", result.length);
    return result;
  }

  async function findAttemptsForUserAndQuiz(userId, quizId) {
    console.log("=== DAO: findAttemptsForUserAndQuiz ===");
    console.log("User ID:", userId);
    console.log("Quiz ID:", quizId);
    const result = await model
      .find({ user: userId, quiz: quizId })
      .sort({ attemptNumber: -1 })
      .lean();
    console.log("Found attempts:", result.length);
    result.forEach((att, idx) => {
      console.log(`  Attempt ${idx + 1}:`, {
        id: att._id,
        attemptNumber: att.attemptNumber,
        submitted: !!att.submittedAt,
        submittedAt: att.submittedAt,
        startedAt: att.startedAt,
        hasQuestionOrder: att.questionOrder && att.questionOrder.length > 0,
        questionOrderLength: att.questionOrder?.length || 0,
      });
    });
    return result;
  }

  async function findLatestAttemptForUserAndQuiz(userId, quizId) {
    console.log("=== DAO: findLatestAttemptForUserAndQuiz ===");
    console.log("User ID:", userId);
    console.log("Quiz ID:", quizId);
    const result = await model
      .findOne({ user: userId, quiz: quizId })
      .sort({ attemptNumber: -1 })
      .lean();
    if (result) {
      console.log("Found latest attempt:", {
        id: result._id,
        attemptNumber: result.attemptNumber,
        submitted: !!result.submittedAt,
        startedAt: result.startedAt,
        hasQuestionOrder: result.questionOrder && result.questionOrder.length > 0,
      });
    } else {
      console.log("No latest attempt found");
    }
    return result;
  }

  async function findUnsubmittedAttemptForUserAndQuiz(userId, quizId) {
    console.log("=== DAO: findUnsubmittedAttemptForUserAndQuiz ===");
    console.log("User ID:", userId);
    console.log("Quiz ID:", quizId);
    const result = await model
      .findOne({ user: userId, quiz: quizId, submittedAt: null })
      .sort({ startedAt: -1 })
      .lean();
    if (result) {
      console.log("✓ Found unsubmitted attempt:", {
        id: result._id,
        startedAt: result.startedAt,
        currentQuestionIndex: result.currentQuestionIndex,
        answersCount: result.answers?.length || 0,
        questionOrder: result.questionOrder,
        questionOrderLength: result.questionOrder?.length || 0,
      });
    } else {
      console.log("✗ No unsubmitted attempt found");
    }
    return result;
  }

  async function findAttemptById(attemptId) {
    console.log("=== DAO: findAttemptById ===");
    console.log("Attempt ID:", attemptId);
    const result = await model.findById(attemptId).lean();
    if (result) {
      console.log("Found attempt:", {
        id: result._id,
        submitted: !!result.submittedAt,
        startedAt: result.startedAt,
        questionOrderLength: result.questionOrder?.length || 0,
      });
    } else {
      console.log("Attempt not found");
    }
    return result;
  }

  async function createAttempt(quizId, userId, attemptNumber, questionOrder = []) {
    console.log("=== DAO: createAttempt START ===");
    console.log("Quiz ID:", quizId);
    console.log("User ID:", userId);
    console.log("Attempt Number:", attemptNumber);
    console.log("Question Order:", questionOrder);
    console.log("Question Order Length:", questionOrder.length);

    // Mark all previous attempts as not final
    await markPreviousAttemptsAsNotFinal(userId, quizId);

    const startedAtTimestamp = new Date();
    console.log("Creating new attempt with startedAt:", startedAtTimestamp.toISOString());

    const newAttempt = {
      _id: uuidv4(),
      quiz: quizId,
      user: userId,
      answers: [],
      score: 0,
      totalPoints: 0,
      startedAt: startedAtTimestamp,
      submittedAt: null,
      attemptNumber,
      currentQuestionIndex: 0,
      elapsedSeconds: 0,
      isFinalScore: true,
      questionOrder: questionOrder,
    };

    console.log("New attempt object:", {
      id: newAttempt._id,
      startedAt: newAttempt.startedAt.toISOString(),
      questionOrder: newAttempt.questionOrder,
      questionOrderLength: newAttempt.questionOrder.length,
    });

    const created = await model.create(newAttempt);
    
    console.log("=== DAO: createAttempt SUCCESS ===");
    console.log("Created attempt ID:", created._id);
    console.log("Created attempt startedAt:", created.startedAt);
    console.log("Created attempt questionOrder:", created.questionOrder);
    
    return created;
  }

  async function updateAttempt(attemptId, attemptUpdates) {
    console.log("=== DAO: updateAttempt START ===");
    console.log("Attempt ID:", attemptId);
    console.log("Update request contains:");
    console.log("  - answers:", attemptUpdates.answers ? `${attemptUpdates.answers.length} answers` : "not provided");
    console.log("  - currentQuestionIndex:", attemptUpdates.currentQuestionIndex ?? "not provided");
    console.log("  - elapsedSeconds:", attemptUpdates.elapsedSeconds ?? "not provided");
    console.log("  - questionOrder:", attemptUpdates.questionOrder ? `${attemptUpdates.questionOrder.length} items` : "not provided");
    console.log("  - startedAt:", attemptUpdates.startedAt ? "⚠️  PROVIDED (THIS SHOULD NOT HAPPEN!)" : "✓ not provided (correct)");

    // Get the attempt to verify it exists and is not submitted
    const attempt = await model.findById(attemptId).lean();
    if (!attempt) {
      console.error("❌ Attempt not found!");
      throw new Error("Attempt not found");
    }
    
    console.log("Current attempt state:");
    console.log("  - startedAt:", attempt.startedAt?.toISOString());
    console.log("  - submitted:", !!attempt.submittedAt);
    console.log("  - current questionOrder:", attempt.questionOrder);
    
    if (attempt.submitted || attempt.submittedAt) {
      console.error("❌ Cannot update - attempt already submitted!");
      throw new Error("Cannot update submitted attempt");
    }
    
    // Only allow updates to specific fields - NEVER update startedAt
    const allowedFields = {};
    if (attemptUpdates.answers !== undefined) {
      allowedFields.answers = attemptUpdates.answers;
      console.log("✓ Will update answers");
    }
    if (attemptUpdates.currentQuestionIndex !== undefined) {
      allowedFields.currentQuestionIndex = attemptUpdates.currentQuestionIndex;
      console.log("✓ Will update currentQuestionIndex to:", attemptUpdates.currentQuestionIndex);
    }
    if (attemptUpdates.elapsedSeconds !== undefined) {
      allowedFields.elapsedSeconds = attemptUpdates.elapsedSeconds;
      console.log("✓ Will update elapsedSeconds to:", attemptUpdates.elapsedSeconds);
    }
    if (attemptUpdates.questionOrder !== undefined) {
      allowedFields.questionOrder = attemptUpdates.questionOrder;
      console.log("✓ Will update questionOrder to:", attemptUpdates.questionOrder);
    }
    
    // CRITICAL: startedAt is explicitly NOT allowed to be updated
    console.log("=== CRITICAL CHECK ===");
    console.log("startedAt in allowedFields?", "startedAt" in allowedFields ? "❌ YES (BUG!)" : "✓ NO (correct)");
    console.log("startedAt will remain:", attempt.startedAt?.toISOString());
    
    const result = await model.updateOne({ _id: attemptId }, { $set: allowedFields });
    
    console.log("=== DAO: updateAttempt COMPLETE ===");
    console.log("Matched:", result.matchedCount);
    console.log("Modified:", result.modifiedCount);
    
    // Verify the update
    const updated = await model.findById(attemptId).lean();
    console.log("After update verification:");
    console.log("  - startedAt:", updated.startedAt?.toISOString(), "(should be unchanged)");
    console.log("  - questionOrder length:", updated.questionOrder?.length || 0);
    console.log("  - currentQuestionIndex:", updated.currentQuestionIndex);
    
    return result;
  }

  async function submitAttempt(attemptId, answers, score, totalPoints, elapsedSeconds, isCorrect, submittedAt) {
    console.log("=== DAO: submitAttempt START ===");
    console.log("Attempt ID:", attemptId);
    console.log("Score:", score);
    console.log("Total Points:", totalPoints);
    console.log("Elapsed Seconds:", elapsedSeconds);
    console.log("isCorrect array length:", isCorrect?.length || 0);
    console.log("Answers count:", answers?.length || 0);

    // Get the attempt to find userId and quizId
    const attempt = await model.findById(attemptId).lean();
    if (!attempt) {
      console.error("❌ Attempt not found!");
      throw new Error("Attempt not found");
    }
    
    console.log("Current attempt state:");
    console.log("  - startedAt:", attempt.startedAt?.toISOString());
    console.log("  - questionOrder:", attempt.questionOrder);
    console.log("  - questionOrder length:", attempt.questionOrder?.length || 0);
    console.log("  - already submitted?", !!attempt.submittedAt);
    
    // Prevent resubmission
    if (attempt.submitted || attempt.submittedAt) {
      console.error("❌ Attempt already submitted!");
      throw new Error("Attempt already submitted");
    }

    // Mark all previous attempts as not final
    await markPreviousAttemptsAsNotFinal(attempt.user, attempt.quiz, attemptId);

    // Use provided submittedAt or create new Date
    const submissionTimestamp = submittedAt || new Date();
    console.log("Submission timestamp:", submissionTimestamp.toISOString());

    // Update only submission-related fields
    // IMPORTANT: questionOrder and startedAt are preserved automatically via $set
    // (only specified fields are updated, others remain unchanged)
    const updateData = {
      answers,
      score,
      totalPoints,
      submittedAt: submissionTimestamp,
      isFinalScore: true,
    };
    
    if (elapsedSeconds !== undefined) {
      updateData.elapsedSeconds = elapsedSeconds;
    }
    
    if (isCorrect !== undefined) {
      updateData.isCorrect = isCorrect;
    }
    
    console.log("=== CRITICAL CHECK ===");
    console.log("Update data contains:");
    console.log("  - submittedAt:", updateData.submittedAt.toISOString());
    console.log("  - score:", updateData.score);
    console.log("  - startedAt:", "startedAt" in updateData ? "❌ YES (BUG!)" : "✓ NO (correct - will be preserved)");
    console.log("  - questionOrder:", "questionOrder" in updateData ? "❌ YES (BUG!)" : "✓ NO (correct - will be preserved)");

    const result = await model.updateOne(
      { _id: attemptId },
      { $set: updateData }
    );

    console.log("=== DAO: submitAttempt UPDATE RESULT ===");
    console.log("Matched count:", result.matchedCount);
    console.log("Modified count:", result.modifiedCount);
    console.log("Acknowledged:", result.acknowledged);

    // Verify the submission
    const submitted = await model.findById(attemptId).lean();
    console.log("=== POST-SUBMIT VERIFICATION ===");
    console.log("Submitted attempt:");
    console.log("  - submittedAt:", submitted.submittedAt?.toISOString());
    console.log("  - startedAt:", submitted.startedAt?.toISOString(), "(should be unchanged from original)");
    console.log("  - questionOrder:", submitted.questionOrder);
    console.log("  - questionOrder preserved?", JSON.stringify(submitted.questionOrder) === JSON.stringify(attempt.questionOrder) ? "✓ YES" : "❌ NO");
    console.log("  - score:", submitted.score);
    console.log("  - isCorrect length:", submitted.isCorrect?.length || 0);

    return result;
  }

  async function getAttemptCountForUserAndQuiz(userId, quizId) {
    console.log("=== DAO: getAttemptCountForUserAndQuiz ===");
    console.log("User ID:", userId);
    console.log("Quiz ID:", quizId);
    
    // Get all attempts (for debugging)
    const allAttempts = await model.find({ user: userId, quiz: quizId }).lean();
    console.log("Total attempts (including unsubmitted):", allAttempts.length);
    
    // Count only submitted attempts
    const count = await model.countDocuments({ 
      user: userId, 
      quiz: quizId,
      submittedAt: { $ne: null }
    });
    
    console.log("Submitted attempts count:", count);
    console.log("Breakdown:");
    allAttempts.forEach((att, idx) => {
      console.log(`  Attempt ${idx + 1}:`, {
        id: att._id,
        attemptNumber: att.attemptNumber,
        submitted: !!att.submittedAt,
        submittedAt: att.submittedAt?.toISOString() || "null",
        countsTowardLimit: !!att.submittedAt ? "YES" : "NO",
      });
    });
    
    return count;
  }

  async function markPreviousAttemptsAsNotFinal(userId, quizId, excludeAttemptId = null) {
    console.log("=== DAO: markPreviousAttemptsAsNotFinal ===");
    console.log("User ID:", userId);
    console.log("Quiz ID:", quizId);
    console.log("Exclude Attempt ID:", excludeAttemptId || "none");
    
    const query = { user: userId, quiz: quizId, isFinalScore: true };
    if (excludeAttemptId) {
      query._id = { $ne: excludeAttemptId };
    }
    
    const result = await model.updateMany(query, { $set: { isFinalScore: false } });
    console.log("Marked as not final:", result.modifiedCount, "attempts");
    
    return result;
  }

  async function findFinalScoreAttemptForUserAndQuiz(userId, quizId) {
    console.log("=== DAO: findFinalScoreAttemptForUserAndQuiz ===");
    console.log("User ID:", userId);
    console.log("Quiz ID:", quizId);
    
    const result = await model
      .findOne({ user: userId, quiz: quizId, isFinalScore: true })
      .sort({ submittedAt: -1 })
      .lean();
    
    if (result) {
      console.log("Found final score attempt:", {
        id: result._id,
        score: result.score,
        submittedAt: result.submittedAt?.toISOString(),
      });
    } else {
      console.log("No final score attempt found");
    }
    
    return result;
  }

  async function findAttemptHistoryForUserAndQuiz(userId, quizId) {
    console.log("=== DAO: findAttemptHistoryForUserAndQuiz ===");
    console.log("User ID:", userId);
    console.log("Quiz ID:", quizId);
    
    const result = await model
      .find({ user: userId, quiz: quizId, submittedAt: { $ne: null } })
      .select("_id attemptNumber score totalPoints submittedAt isFinalScore")
      .sort({ attemptNumber: -1 })
      .lean();
    
    console.log("Found history entries:", result.length);
    result.forEach((att, idx) => {
      console.log(`  History ${idx + 1}:`, {
        attemptNumber: att.attemptNumber,
        score: att.score,
        isFinal: att.isFinalScore,
      });
    });
    
    return result;
  }

  function calculateQuizScore(quiz, answers) {
    console.log("=== DAO: calculateQuizScore ===");
    console.log("Quiz has", quiz.questions?.length || 0, "questions");
    console.log("Received", answers?.length || 0, "answers");
    
    let totalScore = 0;
    let totalPoints = 0;
    const isCorrect = [];

    // Create a map of answers by questionId for quick lookup
    const answersMap = {};
    answers.forEach((answer) => {
      answersMap[answer.questionId] = answer;
    });

    // Process each question in the quiz
    quiz.questions.forEach((question, index) => {
      const questionPoints = question.points || 0;
      totalPoints += questionPoints;
      
      const answer = answersMap[question._id];
      let questionCorrect = false;
      let earnedPoints = 0;

      if (!answer) {
        console.log(`  Q${index + 1} [${question.questionType}]: No answer - 0/${questionPoints} pts`);
        isCorrect.push(false);
        return;
      }

      switch (question.questionType) {
        case "Multiple Choice": {
          const selectedIndex = answer.selectedOptions && answer.selectedOptions[0];
          if (selectedIndex !== undefined && selectedIndex !== null) {
            const correctOptionIndex = question.options.findIndex(
              (option) => option.isCorrect === true
            );
            questionCorrect = selectedIndex === correctOptionIndex;
            earnedPoints = questionCorrect ? questionPoints : 0;
            console.log(`  Q${index + 1} [Multiple Choice]: Selected ${selectedIndex}, Correct ${correctOptionIndex} - ${earnedPoints}/${questionPoints} pts`);
          }
          break;
        }

        case "True/False": {
          if (answer.trueFalseAnswer !== undefined && answer.trueFalseAnswer !== null) {
            questionCorrect = answer.trueFalseAnswer === question.correctAnswer;
            earnedPoints = questionCorrect ? questionPoints : 0;
            console.log(`  Q${index + 1} [True/False]: Answer ${answer.trueFalseAnswer}, Correct ${question.correctAnswer} - ${earnedPoints}/${questionPoints} pts`);
          }
          break;
        }

        case "Fill in the Blank": {
          if (!question.blanks || question.blanks.length === 0) {
            questionCorrect = false;
            earnedPoints = 0;
            console.log(`  Q${index + 1} [Fill in Blank]: No blanks defined - 0/${questionPoints} pts`);
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
            question.blanks.forEach((blank, blankIndex) => {
              const normalizedUserAnswer = normalize(
                answer.fillInAnswers[blankIndex]
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
          console.log(`  Q${index + 1} [Fill in Blank]: ${blanksCorrect}/${question.blanks.length} correct - ${earnedPoints.toFixed(2)}/${questionPoints} pts`);
          break;
        }

        default:
          questionCorrect = false;
          earnedPoints = 0;
          console.log(`  Q${index + 1} [Unknown type]: 0/${questionPoints} pts`);
      }

      isCorrect.push(questionCorrect);
      totalScore += earnedPoints;
    });

    console.log("=== SCORE CALCULATION COMPLETE ===");
    console.log("Total Score:", totalScore);
    console.log("Total Points:", totalPoints);
    console.log("Percentage:", ((totalScore / totalPoints) * 100).toFixed(2) + "%");
    console.log("Correct answers:", isCorrect.filter(c => c).length, "/", isCorrect.length);

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

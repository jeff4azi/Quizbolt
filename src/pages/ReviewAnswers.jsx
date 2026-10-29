import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { RenderMathText } from "../utils/RenderMathText";
import { FiLock, FiAlertTriangle, FiChevronLeft, FiCheck, FiX } from "react-icons/fi";
import { gradeTheoryDetailed } from "../utils/theoryGrader";
import { gradeFibDetailed } from "../utils/fibGrader";

const ReviewAnswers = ({ questions, answers, selectedCourse, isPremium }) => {
  const courseCode = selectedCourse?.id || selectedCourse?.code;
  useDocumentTitle(courseCode ? `Review Answers – ${courseCode} | QuizBolt` : "Review Answers | QuizBolt");
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 0);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!questions || questions.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500 dark:text-gray-400 dark:bg-gray-900">
        No questions to review.
      </div>
    );
  }

  const FREE_REVIEW_LIMIT = 10;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-6">
      {/* Header */}
      <div
        className={`flex items-center gap-5 px-5 pt-6 pb-2 sticky top-0 right-0 left-0 bg-gray-50 dark:bg-gray-900 z-50 transition-shadow duration-200 ${
          isScrolled ? "shadow-sm dark:shadow-black/40 pb-6" : "shadow-none"
        }`}
      >
        <button
          className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 active:scale-90 transition-all"
          onClick={() => navigate("/results")}
        >
          <FiChevronLeft className="-translate-x-1/18 size-6 text-slate-600 dark:text-slate-300" />
        </button>
        <h1 className="text-2xl font-semibold dark:text-gray-200">
          Review Answers
        </h1>
      </div>

      {/* Questions */}
      <div className="space-y-6 px-5 mt-5 max-w-4xl mx-auto">
        {questions.map((question, index) => {
          if (!isPremium && index >= FREE_REVIEW_LIMIT) return null;
          const userAnswer = answers[index];
          const isTheory =
            Array.isArray(question.keywords) || question.type === "theory";
          const isFib =
            Array.isArray(question.answers) || question.type === "fib";

          if (isTheory) {
            const theoryEval = gradeTheoryDetailed(
              userAnswer,
              question.keywords,
              question.model_answer
            );
            const scorePercent = Math.round((theoryEval.score || 0) * 100);

            return (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow duration-300"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest border border-amber-200 dark:border-amber-800/40">
                      Theory
                    </span>
                    {question.section && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest">
                        {question.section}
                      </div>
                    )}
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      theoryEval.score >= 0.85
                        ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800"
                        : theoryEval.score >= 0.45
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                        : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800"
                    }`}
                  >
                    {scorePercent}% Score
                  </div>
                </div>

                <div className="font-semibold text-gray-800 dark:text-gray-200 text-lg mb-4">
                  {index + 1}.{" "}
                  <RenderMathText
                    text={question.question}
                    courseId={selectedCourse.id}
                  />
                </div>

                <div className="mb-3">
                  <span className="font-medium text-gray-700 dark:text-gray-200 text-sm">
                    Your answer:
                  </span>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-gray-700/60 rounded-xl p-3 whitespace-pre-wrap">
                    {userAnswer || (
                      <span className="italic text-gray-400">Not answered</span>
                    )}
                  </p>
                </div>

                {/* Intelligent Feedback & Concepts Breakdown */}
                <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200/60 dark:border-slate-600/40 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span>
                      Concepts Matched: {theoryEval.matchedCount} / {theoryEval.totalCount}
                    </span>
                    <span className="italic text-slate-500 dark:text-slate-400">
                      {theoryEval.feedback}
                    </span>
                  </div>

                  {(theoryEval.matchedConcepts.length > 0 || theoryEval.missedConcepts.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {theoryEval.matchedConcepts.map((kw, i) => (
                        <span
                          key={`hit-${i}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        >
                          <FiCheck size={11} />
                          {kw}
                        </span>
                      ))}
                      {theoryEval.missedConcepts.map((kw, i) => (
                        <span
                          key={`miss-${i}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-200/70 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700"
                        >
                          <FiX size={11} />
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {question.model_answer ? (
                  <div className="mt-3 bg-gray-50 dark:bg-gray-700 border-l-4 border-green-500 p-4 rounded-lg">
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                      Model Answer
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      <RenderMathText
                        text={question.model_answer}
                        courseId={selectedCourse.id}
                      />
                    </div>
                  </div>
                ) : (
                  (theoryEval.matchedConcepts.length > 0 || theoryEval.missedConcepts.length > 0 || question.keywords) && (
                    <div className="mt-3 bg-gray-50 dark:bg-gray-700 border-l-4 border-green-500 p-4 rounded-lg">
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                        Expected Key Concepts
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {theoryEval.matchedConcepts.concat(theoryEval.missedConcepts).join(", ") ||
                          (Array.isArray(question.keywords)
                            ? question.keywords.join(", ")
                            : String(question.keywords || ""))}
                      </div>
                    </div>
                  )
                )}

                <div className="mt-3 flex justify-end">
                  <a
                    href={`https://wa.me/2347015585397?text=${encodeURIComponent(
                      `*Question Report*\n\n*ID:* ${question.id}\n\n*Question:* ${question.question}\n\n*User's Answer:* ${userAnswer || "Not answered"}\n\n*Model Answer:* ${question.model_answer || "N/A"}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold border border-amber-100 dark:border-amber-500/20 active:scale-95 transition-all"
                  >
                    <FiAlertTriangle size={12} />
                    Report Question
                  </a>
                </div>
              </div>
            );
          }

          const correctAnswer = question.correct;
          const isCorrect = userAnswer === correctAnswer;
          const isAnswered = userAnswer !== undefined;

          if (isFib) {
            const userBlanks = Array.isArray(userAnswer) ? userAnswer : [];
            const fibEval = gradeFibDetailed(userBlanks, question.answers);
            const parts = question.question.split(/_{2,}/g);
            const scorePercent = Math.round((fibEval.score || 0) * 100);

            return (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow duration-300"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-[10px] font-black uppercase tracking-widest border border-purple-200 dark:border-purple-800/40">
                      Fill in the Blank
                    </span>
                    {question.section && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest">
                        {question.section}
                      </div>
                    )}
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      fibEval.score >= 0.99
                        ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800"
                        : fibEval.score > 0
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                        : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800"
                    }`}
                  >
                    {scorePercent}% Score ({fibEval.correctCount} / {fibEval.totalCount})
                  </div>
                </div>

                <div className="font-semibold text-gray-800 dark:text-gray-200 text-lg mb-4 leading-loose">
                  {index + 1}.{" "}
                  {parts.map((part, i) => {
                    const blankInfo = fibEval.blanks[i] || {
                      typed: userBlanks[i] || "",
                      isCorrect: false,
                      acceptedAnswers: [],
                      matchType: "empty",
                      matchedWith: null,
                    };
                    const isCorrectBlank = blankInfo.isCorrect;
                    const correctLabel = blankInfo.acceptedAnswers[0] || "";
                    const isTypoMatch = blankInfo.matchType === "typo";

                    return (
                      <span key={i}>
                        {part}
                        {i < parts.length - 1 && (
                          <span className="inline-flex flex-col items-center mx-1 align-bottom">
                            <span
                              className={`font-bold border-b-2 px-2.5 py-0.5 min-w-[3.5rem] text-center ${
                                blankInfo.typed
                                  ? isCorrectBlank
                                    ? "text-green-600 border-green-500"
                                    : "text-red-500 border-red-400"
                                  : "text-red-500/80 dark:text-red-400/80 border-red-300 dark:border-red-700/60 italic"
                              }`}
                            >
                              {blankInfo.typed || "Unanswered"}
                            </span>
                            {!isCorrectBlank && (
                              <span className="text-[11px] text-green-600 dark:text-green-400 font-bold mt-1 inline-flex items-center gap-0.5">
                                ✓ {correctLabel}
                              </span>
                            )}
                            {isCorrectBlank && isTypoMatch && (
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                                (Accepted typo)
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>

                <div className="mt-3 flex justify-end">
                  <a
                    href={`https://wa.me/2347015585397?text=${encodeURIComponent(
                      `*Question Report*\n\n*ID:* ${question.id}\n\n*Question:* ${question.question}\n\n*User's Answers:* ${userBlanks.join(", ") || "Not answered"}\n\n*Expected:* ${fibEval.blanks.map((b) => b.acceptedAnswers[0] || "").join(", ")}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold border border-amber-100 dark:border-amber-500/20 active:scale-95 transition-all"
                  >
                    <FiAlertTriangle size={12} />
                    Report Question
                  </a>
                </div>
              </div>
            );
          }

          return (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100 dark:border-gray-700"
            >
              {/* Section badge */}
              {question.section && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest mb-3">
                  {question.section}
                </div>
              )}
              {/* Question */}
              <div className="font-semibold text-gray-800 dark:text-gray-200 text-lg mb-4">
                {index + 1}.{" "}
                <RenderMathText
                  text={question.question}
                  courseId={selectedCourse.id}
                />
              </div>

              {/* User Answer */}
              <div className="mb-2 flex items-center gap-2">
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  Your answer:
                </span>
                {isAnswered ? (
                  <span
                    className={`font-medium ${isCorrect ? "text-green-600" : "text-red-500"}`}
                  >
                    <RenderMathText
                      text={userAnswer}
                      courseId={selectedCourse.id}
                    />
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 italic">
                    Not answered
                  </span>
                )}
              </div>

              {/* Correct Answer */}
              {!isCorrect && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    Correct answer:
                  </span>
                  <span className="text-green-600 font-semibold">
                    <RenderMathText
                      text={correctAnswer}
                      courseId={selectedCourse.id}
                    />
                  </span>
                </div>
              )}

              {/* Explanation */}
              {!isCorrect && question.reason && (
                <div className="mt-3 bg-gray-50 dark:bg-gray-700 border-l-4 border-green-500 p-4 rounded-lg">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                    Explanation
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    <RenderMathText
                      text={question.reason}
                      courseId={selectedCourse.id}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!isPremium && questions.length > FREE_REVIEW_LIMIT && (
          <div className="mx-auto max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 p-6 text-center">
            <div className="flex justify-center mb-3">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-2xl">
                <FiLock
                  className="text-amber-500 dark:text-amber-400"
                  size={24}
                />
              </div>
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1">
              {questions.length - FREE_REVIEW_LIMIT} more question
              {questions.length - FREE_REVIEW_LIMIT !== 1 ? "s" : ""} locked
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              You&apos;ve reviewed the first {FREE_REVIEW_LIMIT} for free.
              Upgrade to unlock the full review for every question.
            </p>
            <button
              onClick={() => navigate("/premium")}
              className="w-full py-3 rounded-2xl bg-blue-600 text-white font-bold hover:scale-[1.02] active:scale-[0.98] transition"
            >
              Unlock Full Review
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewAnswers;

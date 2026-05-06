import { Prisma } from '@prisma/client';
import { isUuid } from '../utils/validators.js';

const QUIZ_AVAILABILITY = {
    ANYTIME: 'anytime',
    SCHEDULED: 'scheduled'
};

const QUIZ_ATTEMPT_MODE = {
    ONE_TIME: 'one_time',
    REPEATABLE: 'repeatable'
};

const QUESTION_TYPE = {
    MCQ: 'mcq',
    BROAD: 'broad'
};

const ATTEMPT_STATUS = {
    IN_PROGRESS: 'in_progress',
    SUBMITTED: 'submitted',
    EXPIRED: 'expired'
};

const ATTEMPT_GRADING_STATUS = {
    PENDING: 'pending',
    GRADED: 'graded'
};

const MAX_QUIZ_TITLE_LENGTH = 180;
const MAX_QUIZ_DESCRIPTION_LENGTH = 3000;
const MAX_QUESTION_TEXT_LENGTH = 4000;
const MAX_IMAGE_DATA_LENGTH = 1_500_000;
const MAX_QUESTIONS_PER_QUIZ = 60;
const MAX_BROAD_ANSWER_TEXT_LENGTH = 6000;
const MAX_ANSWER_FILE_DATA_LENGTH = 18_000_000;
const MAX_REVIEW_FILE_DATA_LENGTH = 18_000_000;
const MAX_TEACHER_EXPLANATION_LENGTH = 4000;

const normalizeString = (value) => String(value || '').trim();

const toSafeInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const toISOStringOrNull = (value) => (value ? new Date(value).toISOString() : null);

const calculateDeadline = (startedAt, durationMinutes) =>
    new Date(new Date(startedAt).getTime() + Number(durationMinutes || 0) * 60 * 1000);

const calculateRemainingSeconds = (startedAt, durationMinutes, now = new Date()) => {
    const deadline = calculateDeadline(startedAt, durationMinutes);
    return Math.max(Math.floor((deadline.getTime() - now.getTime()) / 1000), 0);
};

const isExpiredByClock = (attempt, now = new Date()) =>
    calculateRemainingSeconds(attempt.startedAt, attempt.durationMinutes, now) <= 0;

const validateQuestionImageData = (value, fieldLabel) => {
    if (value === undefined || value === null || value === '') return null;
    const normalized = String(value);
    if (!normalized.startsWith('data:image/')) {
        const error = new Error(`${fieldLabel} must be a valid image data URL (data:image/...).`);
        error.statusCode = 400;
        throw error;
    }
    if (normalized.length > MAX_IMAGE_DATA_LENGTH) {
        const error = new Error(`${fieldLabel} exceeds maximum allowed size.`);
        error.statusCode = 400;
        throw error;
    }
    return normalized;
};

const validateAnswerFileData = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const normalized = String(value);
    const isAllowedPrefix =
        normalized.startsWith('data:image/') || normalized.startsWith('data:application/pdf');
    if (!isAllowedPrefix) {
        const error = new Error('Answer file must be image or PDF data URL.');
        error.statusCode = 400;
        throw error;
    }
    if (normalized.length > MAX_ANSWER_FILE_DATA_LENGTH) {
        const error = new Error('Answer file exceeds maximum allowed size.');
        error.statusCode = 400;
        throw error;
    }
    return normalized;
};

const validateReviewFileData = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const normalized = String(value);
    const isAllowedPrefix =
        normalized.startsWith('data:image/') || normalized.startsWith('data:application/pdf');
    if (!isAllowedPrefix) {
        const error = new Error('Review file must be image or PDF data URL.');
        error.statusCode = 400;
        throw error;
    }
    if (normalized.length > MAX_REVIEW_FILE_DATA_LENGTH) {
        const error = new Error('Review file exceeds maximum allowed size.');
        error.statusCode = 400;
        throw error;
    }
    return normalized;
};

const mapQuestionResponse = (question, { includeAnswers = true } = {}) => {
    const options = Array.isArray(question.mcqOptions) ? question.mcqOptions : [];
    return {
        id: question.id,
        order_no: question.orderNo,
        type: question.questionType,
        question_text: question.questionText || '',
        question_image_data: question.questionImageData || null,
        marks: Number(question.marks || 0),
        options,
        correct_option_index:
            includeAnswers && question.correctOptionIndex !== null && question.correctOptionIndex !== undefined
                ? Number(question.correctOptionIndex)
                : null,
        allow_file_upload: Boolean(question.allowFileUpload)
    };
};

const getQuizEntryWindowState = (quiz, now = new Date()) => {
    const startsAt = quiz.startsAt ? new Date(quiz.startsAt) : null;
    const entryCloseAt = quiz.entryCloseAt ? new Date(quiz.entryCloseAt) : null;

    const hasStarted =
        quiz.availabilityType === QUIZ_AVAILABILITY.ANYTIME ||
        (startsAt ? startsAt.getTime() <= now.getTime() : false);

    const isEntryClosed = Boolean(entryCloseAt && entryCloseAt.getTime() < now.getTime());
    const canStartNewAttempt = hasStarted && !isEntryClosed;

    return {
        startsAt,
        entryCloseAt,
        hasStarted,
        isEntryClosed,
        canStartNewAttempt
    };
};

const mapQuizResponse = (quiz, { includeAnswers = true, includeQuestions = true } = {}) => {
    const questions = includeQuestions
        ? (quiz.questions || []).map((question) => mapQuestionResponse(question, { includeAnswers }))
        : [];

    const totalMarks = (quiz.questions || []).reduce((sum, question) => sum + Number(question.marks || 0), 0);
    const { startsAt, entryCloseAt, canStartNewAttempt } = getQuizEntryWindowState(quiz);

    return {
        id: quiz.id,
        batch_id: quiz.batchId,
        batch_name: quiz.batch?.batchName || quiz.batch?.name || null,
        teacher_id: quiz.teacherId,
        teacher_name: quiz.teacher?.name || null,
        title: quiz.title,
        description: quiz.description || '',
        availability_type: quiz.availabilityType,
        starts_at: startsAt ? startsAt.toISOString() : null,
        entry_close_at: entryCloseAt ? entryCloseAt.toISOString() : null,
        duration_minutes: Number(quiz.durationMinutes || 0),
        attempt_mode: quiz.attemptMode,
        is_active: Boolean(quiz.isActive),
        question_count: Number((quiz.questions || []).length),
        total_marks: totalMarks,
        can_start_now: canStartNewAttempt,
        created_at: toISOStringOrNull(quiz.createdAt),
        questions
    };
};

const mapAttemptResponse = (attempt) => {
    const now = new Date();
    const deadlineAt = calculateDeadline(attempt.startedAt, attempt.durationMinutes);
    const remainingSeconds =
        attempt.status === ATTEMPT_STATUS.IN_PROGRESS
            ? calculateRemainingSeconds(attempt.startedAt, attempt.durationMinutes, now)
            : 0;

    const answerByQuestionId = new Map((attempt.answers || []).map((answer) => [answer.questionId, answer]));
    const quizMapped = mapQuizResponse(attempt.quiz, { includeAnswers: false, includeQuestions: true });
    const questions = quizMapped.questions.map((question) => {
        const answer = answerByQuestionId.get(question.id) || null;
        return {
            ...question,
            answer: answer
                ? {
                    selected_option_index:
                        answer.mcqSelectedOptionIndex === null || answer.mcqSelectedOptionIndex === undefined
                            ? null
                            : Number(answer.mcqSelectedOptionIndex),
                    broad_text_answer: answer.broadTextAnswer || '',
                    answer_file_data: answer.answerFileData || null,
                    answer_file_name: answer.answerFileName || null,
                    answer_file_type: answer.answerFileType || null,
                    awarded_marks:
                        answer.awardedMarks === null || answer.awardedMarks === undefined
                            ? null
                            : Number(answer.awardedMarks),
                    teacher_explanation: answer.teacherExplanation || '',
                    review_file_data: answer.reviewFileData || null,
                    review_file_name: answer.reviewFileName || null,
                    review_file_type: answer.reviewFileType || null,
                    reviewed_at: toISOStringOrNull(answer.reviewedAt)
                }
                : {
                    selected_option_index: null,
                    broad_text_answer: '',
                    answer_file_data: null,
                    answer_file_name: null,
                    answer_file_type: null,
                    awarded_marks: null,
                    teacher_explanation: '',
                    review_file_data: null,
                    review_file_name: null,
                    review_file_type: null,
                    reviewed_at: null
                }
        };
    });

    return {
        attempt_id: attempt.id,
        quiz_id: attempt.quizId,
        student_id: attempt.studentId,
        attempt_number: Number(attempt.attemptNumber || 0),
        status: attempt.status,
        grading_status: attempt.gradingStatus || ATTEMPT_GRADING_STATUS.PENDING,
        total_awarded_marks: Number(attempt.totalAwardedMarks || 0),
        started_at: toISOStringOrNull(attempt.startedAt),
        submitted_at: toISOStringOrNull(attempt.submittedAt),
        graded_at: toISOStringOrNull(attempt.gradedAt),
        duration_minutes: Number(attempt.durationMinutes || 0),
        deadline_at: deadlineAt.toISOString(),
        remaining_seconds: remainingSeconds,
        quiz: {
            ...quizMapped,
            questions
        }
    };
};

const getAccessibleTeacherBatchIds = async (prisma, requesterId, requesterRole) => {
    const role = normalizeString(requesterRole).toLowerCase();
    if (role === 'admin') {
        const all = await prisma.batch.findMany({ select: { id: true } });
        return all.map((batch) => batch.id);
    }

    const teacherScoped = await prisma.batch.findMany({
        where: {
            OR: [
                { teacherId: requesterId },
                {
                    teacherAssignments: {
                        some: { teacherId: requesterId }
                    }
                }
            ]
        },
        select: { id: true }
    });

    return teacherScoped.map((batch) => batch.id);
};

const validateAndNormalizeQuestions = (rawQuestions) => {
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        const error = new Error('questions must be a non-empty array.');
        error.statusCode = 400;
        throw error;
    }

    if (rawQuestions.length > MAX_QUESTIONS_PER_QUIZ) {
        const error = new Error(`Maximum ${MAX_QUESTIONS_PER_QUIZ} questions are allowed per quiz.`);
        error.statusCode = 400;
        throw error;
    }

    return rawQuestions.map((question, index) => {
        const type = normalizeString(question?.type).toLowerCase();
        if (![QUESTION_TYPE.MCQ, QUESTION_TYPE.BROAD].includes(type)) {
            const error = new Error(`questions[${index}].type must be either "mcq" or "broad".`);
            error.statusCode = 400;
            throw error;
        }

        const questionText = normalizeString(question?.question_text);
        const imageData = validateQuestionImageData(
            question?.question_image_data,
            `questions[${index}].question_image_data`
        );

        if (!questionText && !imageData) {
            const error = new Error(`questions[${index}] must contain either question_text or question_image_data.`);
            error.statusCode = 400;
            throw error;
        }

        if (questionText.length > MAX_QUESTION_TEXT_LENGTH) {
            const error = new Error(`questions[${index}].question_text exceeds allowed length.`);
            error.statusCode = 400;
            throw error;
        }

        const marks = toSafeInt(question?.marks, 0);
        if (marks < 1 || marks > 1000) {
            const error = new Error(`questions[${index}].marks must be between 1 and 1000.`);
            error.statusCode = 400;
            throw error;
        }

        if (type === QUESTION_TYPE.MCQ) {
            const options = Array.isArray(question?.options) ? question.options : [];
            const normalizedOptions = options.map((option) => normalizeString(option)).filter(Boolean);
            if (normalizedOptions.length < 2 || normalizedOptions.length > 8) {
                const error = new Error(`questions[${index}].options must contain 2 to 8 non-empty values.`);
                error.statusCode = 400;
                throw error;
            }

            const correctOptionIndex = toSafeInt(question?.correct_option_index, -1);
            if (correctOptionIndex < 0 || correctOptionIndex >= normalizedOptions.length) {
                const error = new Error(
                    `questions[${index}].correct_option_index must point to a valid option index.`
                );
                error.statusCode = 400;
                throw error;
            }

            return {
                orderNo: index + 1,
                questionType: type,
                questionText: questionText || null,
                questionImageData: imageData,
                marks,
                mcqOptions: normalizedOptions,
                correctOptionIndex,
                allowFileUpload: false
            };
        }

        return {
            orderNo: index + 1,
            questionType: type,
            questionText: questionText || null,
            questionImageData: imageData,
            marks,
            mcqOptions: null,
            correctOptionIndex: null,
            allowFileUpload: question?.allow_file_upload !== false
        };
    });
};

const expireStudentAttemptsForQuiz = async (prisma, studentId, quizId) => {
    await prisma.$executeRaw`
        UPDATE quiz_attempts qa
        SET status = 'expired',
            updated_at = NOW()
        WHERE qa.student_id = ${studentId}::uuid
          AND qa.quiz_id = ${quizId}::uuid
          AND qa.status = 'in_progress'
          AND NOW() > qa.started_at + (qa.duration_minutes || ' minutes')::interval
    `;
};

const expireStudentAttemptsForScope = async (prisma, studentId, batchIds = []) => {
    if (!batchIds.length) return;

    const batchIdSql = batchIds.map((id) => Prisma.sql`${id}::uuid`);

    await prisma.$executeRaw`
        UPDATE quiz_attempts qa
        SET status = 'expired',
            updated_at = NOW()
        FROM quizzes q
        WHERE qa.quiz_id = q.id
          AND qa.student_id = ${studentId}::uuid
          AND qa.status = 'in_progress'
          AND q.batch_id IN (${Prisma.join(batchIdSql)})
          AND NOW() > qa.started_at + (qa.duration_minutes || ' minutes')::interval
    `;
};

const getAttemptByIdForStudent = async (prisma, attemptId, studentId) => {
    return prisma.quizAttempt.findFirst({
        where: {
            id: attemptId,
            studentId
        },
        include: {
            quiz: {
                include: {
                    batch: {
                        select: { id: true, name: true, batchName: true }
                    },
                    teacher: {
                        select: { id: true, name: true }
                    },
                    questions: {
                        orderBy: { orderNo: 'asc' }
                    }
                }
            },
            answers: true
        }
    });
};

const summarizeStudentQuizAttemptState = (quiz, now = new Date()) => {
    const attempts = [...(quiz.attempts || [])].sort((a, b) => b.attemptNumber - a.attemptNumber);
    const latest = attempts[0] || null;
    const activeInProgress = attempts.find(
        (attempt) =>
            attempt.status === ATTEMPT_STATUS.IN_PROGRESS &&
            !isExpiredByClock(
                { startedAt: attempt.startedAt, durationMinutes: attempt.durationMinutes },
                now
            )
    );
    const submittedAttempts = attempts.filter((attempt) => attempt.status === ATTEMPT_STATUS.SUBMITTED).length;

    const { hasStarted, isEntryClosed } = getQuizEntryWindowState(quiz, now);

    let canAttempt = false;
    let attemptMessage = '';

    if (activeInProgress) {
        canAttempt = true;
        attemptMessage = 'Resume your in-progress attempt.';
    } else if (!hasStarted) {
        canAttempt = false;
        attemptMessage = 'Quiz has not started yet.';
    } else if (isEntryClosed) {
        canAttempt = false;
        attemptMessage = 'Quiz entry window is closed.';
    } else if (quiz.attemptMode === QUIZ_ATTEMPT_MODE.ONE_TIME) {
        canAttempt = attempts.length === 0;
        attemptMessage = canAttempt ? 'You can take this quiz once.' : 'This quiz allows only one attempt.';
    } else {
        canAttempt = true;
        attemptMessage = submittedAttempts > 0 ? 'You can retake this quiz.' : 'You can start this quiz.';
    }

    return {
        total_attempts: attempts.length,
        submitted_attempts: submittedAttempts,
        latest_attempt_id: latest?.id || null,
        latest_attempt_number: latest ? Number(latest.attemptNumber || 0) : 0,
        latest_attempt_status: latest?.status || null,
        can_resume: Boolean(activeInProgress),
        resume_attempt_id: activeInProgress?.id || null,
        can_attempt: canAttempt,
        attempt_message: attemptMessage
    };
};

export const createQuiz = async (
    prisma,
    {
        requesterId,
        requesterRole,
        batchId,
        title,
        description,
        availabilityType,
        startsAt,
        entryCloseAt,
        durationMinutes,
        attemptMode,
        questions
    }
) => {
    if (!isUuid(requesterId)) {
        const error = new Error('Unable to resolve requester identity.');
        error.statusCode = 401;
        throw error;
    }

    if (!isUuid(batchId)) {
        const error = new Error('batch_id must be a valid UUID.');
        error.statusCode = 400;
        throw error;
    }

    const scopedBatchIds = await getAccessibleTeacherBatchIds(prisma, requesterId, requesterRole);
    if (!scopedBatchIds.includes(batchId)) {
        const error = new Error('You do not have permission to create a quiz for this batch.');
        error.statusCode = 403;
        throw error;
    }

    const normalizedTitle = normalizeString(title);
    if (!normalizedTitle) {
        const error = new Error('title is required.');
        error.statusCode = 400;
        throw error;
    }
    if (normalizedTitle.length > MAX_QUIZ_TITLE_LENGTH) {
        const error = new Error(`title cannot exceed ${MAX_QUIZ_TITLE_LENGTH} characters.`);
        error.statusCode = 400;
        throw error;
    }

    const normalizedDescription = normalizeString(description);
    if (normalizedDescription.length > MAX_QUIZ_DESCRIPTION_LENGTH) {
        const error = new Error(`description cannot exceed ${MAX_QUIZ_DESCRIPTION_LENGTH} characters.`);
        error.statusCode = 400;
        throw error;
    }

    const normalizedAvailability = normalizeString(availabilityType).toLowerCase();
    if (![QUIZ_AVAILABILITY.ANYTIME, QUIZ_AVAILABILITY.SCHEDULED].includes(normalizedAvailability)) {
        const error = new Error('availability_type must be either "anytime" or "scheduled".');
        error.statusCode = 400;
        throw error;
    }

    let normalizedStartsAt = null;
    let normalizedEntryCloseAt = null;
    if (normalizedAvailability === QUIZ_AVAILABILITY.SCHEDULED) {
        const parsed = new Date(startsAt);
        if (Number.isNaN(parsed.getTime())) {
            const error = new Error('starts_at is required and must be a valid datetime for scheduled quizzes.');
            error.statusCode = 400;
            throw error;
        }
        normalizedStartsAt = parsed;

        const normalizedEntryCloseAtRaw = normalizeString(entryCloseAt);
        if (normalizedEntryCloseAtRaw) {
            const parsedEntryCloseAt = new Date(normalizedEntryCloseAtRaw);
            if (Number.isNaN(parsedEntryCloseAt.getTime())) {
                const error = new Error('entry_close_at must be a valid datetime when provided.');
                error.statusCode = 400;
                throw error;
            }
            if (parsedEntryCloseAt.getTime() < normalizedStartsAt.getTime()) {
                const error = new Error('entry_close_at cannot be earlier than starts_at.');
                error.statusCode = 400;
                throw error;
            }
            normalizedEntryCloseAt = parsedEntryCloseAt;
        }
    }

    const parsedDuration = toSafeInt(durationMinutes, 0);
    if (parsedDuration < 1 || parsedDuration > 1440) {
        const error = new Error('duration_minutes must be between 1 and 1440.');
        error.statusCode = 400;
        throw error;
    }

    const normalizedAttemptMode = normalizeString(attemptMode).toLowerCase();
    let finalAttemptMode = QUIZ_ATTEMPT_MODE.ONE_TIME;
    if (normalizedAvailability === QUIZ_AVAILABILITY.ANYTIME) {
        if (![QUIZ_ATTEMPT_MODE.ONE_TIME, QUIZ_ATTEMPT_MODE.REPEATABLE].includes(normalizedAttemptMode)) {
            const error = new Error('attempt_mode for anytime quizzes must be "one_time" or "repeatable".');
            error.statusCode = 400;
            throw error;
        }
        finalAttemptMode = normalizedAttemptMode;
    }

    const normalizedQuestions = validateAndNormalizeQuestions(questions);

    const created = await prisma.$transaction(async (tx) => {
        const quiz = await tx.quiz.create({
            data: {
                batchId,
                teacherId: requesterId,
                title: normalizedTitle,
                description: normalizedDescription || null,
                availabilityType: normalizedAvailability,
                startsAt: normalizedStartsAt,
                entryCloseAt: normalizedEntryCloseAt,
                durationMinutes: parsedDuration,
                attemptMode: finalAttemptMode
            }
        });

        await tx.quizQuestion.createMany({
            data: normalizedQuestions.map((question) => ({
                quizId: quiz.id,
                orderNo: question.orderNo,
                questionType: question.questionType,
                questionText: question.questionText,
                questionImageData: question.questionImageData,
                marks: question.marks,
                mcqOptions: question.mcqOptions,
                correctOptionIndex: question.correctOptionIndex,
                allowFileUpload: question.allowFileUpload
            }))
        });

        return tx.quiz.findUnique({
            where: { id: quiz.id },
            include: {
                batch: {
                    select: { id: true, name: true, batchName: true }
                },
                teacher: {
                    select: { id: true, name: true }
                },
                questions: {
                    orderBy: { orderNo: 'asc' }
                }
            }
        });
    });

    return mapQuizResponse(created);
};

export const getTeacherQuizzes = async (
    prisma,
    {
        requesterId,
        requesterRole,
        batchId
    }
) => {
    const scopedBatchIds = await getAccessibleTeacherBatchIds(prisma, requesterId, requesterRole);
    if (!scopedBatchIds.length) return [];

    const normalizedBatchId = normalizeString(batchId);
    if (normalizedBatchId) {
        if (!isUuid(normalizedBatchId)) {
            const error = new Error('batch_id must be a valid UUID.');
            error.statusCode = 400;
            throw error;
        }
        if (!scopedBatchIds.includes(normalizedBatchId)) {
            const error = new Error('You do not have access to the requested batch.');
            error.statusCode = 403;
            throw error;
        }
    }

    const quizzes = await prisma.quiz.findMany({
        where: {
            batchId: normalizedBatchId || { in: scopedBatchIds }
        },
        include: {
            batch: {
                select: { id: true, name: true, batchName: true }
            },
            teacher: {
                select: { id: true, name: true }
            },
            questions: {
                orderBy: { orderNo: 'asc' }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return quizzes.map((quiz) => mapQuizResponse(quiz));
};

export const getTeacherQuizScripts = async (
    prisma,
    {
        requesterId,
        requesterRole,
        batchId,
        quizId
    }
) => {
    const scopedBatchIds = await getAccessibleTeacherBatchIds(prisma, requesterId, requesterRole);
    if (!scopedBatchIds.length) return [];

    const normalizedBatchId = normalizeString(batchId);
    if (normalizedBatchId) {
        if (!isUuid(normalizedBatchId)) {
            const error = new Error('batch_id must be a valid UUID.');
            error.statusCode = 400;
            throw error;
        }
        if (!scopedBatchIds.includes(normalizedBatchId)) {
            const error = new Error('You do not have access to the requested batch.');
            error.statusCode = 403;
            throw error;
        }
    }

    const normalizedQuizId = normalizeString(quizId);
    if (normalizedQuizId) {
        if (!isUuid(normalizedQuizId)) {
            const error = new Error('quiz_id must be a valid UUID.');
            error.statusCode = 400;
            throw error;
        }
    }

    const quizzes = await prisma.quiz.findMany({
        where: {
            id: normalizedQuizId || undefined,
            batchId: normalizedBatchId || { in: scopedBatchIds }
        },
        include: {
            batch: {
                select: {
                    id: true,
                    name: true,
                    batchName: true
                }
            },
            questions: {
                select: {
                    id: true,
                    marks: true
                }
            },
            attempts: {
                where: {
                    status: ATTEMPT_STATUS.SUBMITTED
                },
                include: {
                    student: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                },
                orderBy: {
                    submittedAt: 'desc'
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    return quizzes.map((quiz) => {
        const totalMarks = (quiz.questions || []).reduce((sum, question) => sum + Number(question.marks || 0), 0);

        return {
            quiz_id: quiz.id,
            quiz_title: quiz.title,
            batch_id: quiz.batchId,
            batch_name: quiz.batch?.batchName || quiz.batch?.name || null,
            question_count: Number((quiz.questions || []).length),
            total_marks: totalMarks,
            submission_count: Number((quiz.attempts || []).length),
            attempts: (quiz.attempts || []).map((attempt) => ({
                attempt_id: attempt.id,
                attempt_number: Number(attempt.attemptNumber || 0),
                attempt_status: attempt.status,
                grading_status: attempt.gradingStatus || ATTEMPT_GRADING_STATUS.PENDING,
                total_awarded_marks: Number(attempt.totalAwardedMarks || 0),
                submitted_at: toISOStringOrNull(attempt.submittedAt),
                graded_at: toISOStringOrNull(attempt.gradedAt),
                student_id: attempt.student?.id || null,
                student_name: attempt.student?.name || null,
                student_email: attempt.student?.email || null
            }))
        };
    });
};

const getTeacherScopedAttempt = async (prisma, requesterId, requesterRole, attemptId) => {
    if (!isUuid(attemptId)) {
        const error = new Error('attempt_id must be a valid UUID.');
        error.statusCode = 400;
        throw error;
    }

    const scopedBatchIds = await getAccessibleTeacherBatchIds(prisma, requesterId, requesterRole);
    if (!scopedBatchIds.length) {
        const error = new Error('You do not have access to this attempt.');
        error.statusCode = 403;
        throw error;
    }

    const attempt = await prisma.quizAttempt.findFirst({
        where: {
            id: attemptId,
            quiz: {
                batchId: { in: scopedBatchIds }
            }
        },
        include: {
            student: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            },
            quiz: {
                include: {
                    batch: {
                        select: {
                            id: true,
                            name: true,
                            batchName: true
                        }
                    },
                    questions: {
                        orderBy: { orderNo: 'asc' }
                    }
                }
            },
            answers: true
        }
    });

    if (!attempt) {
        const error = new Error('Quiz attempt not found.');
        error.statusCode = 404;
        throw error;
    }

    return attempt;
};

export const getTeacherQuizAttemptReview = async (
    prisma,
    {
        requesterId,
        requesterRole,
        attemptId
    }
) => {
    if (!isUuid(requesterId)) {
        const error = new Error('Unable to resolve requester identity.');
        error.statusCode = 401;
        throw error;
    }

    const attempt = await getTeacherScopedAttempt(prisma, requesterId, requesterRole, attemptId);
    if (attempt.status !== ATTEMPT_STATUS.SUBMITTED) {
        const error = new Error('Only submitted quiz attempts can be reviewed.');
        error.statusCode = 400;
        throw error;
    }
    const answerByQuestionId = new Map((attempt.answers || []).map((answer) => [answer.questionId, answer]));

    const questions = (attempt.quiz?.questions || []).map((question) => {
        const answer = answerByQuestionId.get(question.id) || null;
        const options = Array.isArray(question.mcqOptions) ? question.mcqOptions : [];

        return {
            id: question.id,
            order_no: Number(question.orderNo || 0),
            type: question.questionType,
            question_text: question.questionText || '',
            question_image_data: question.questionImageData || null,
            marks: Number(question.marks || 0),
            options,
            correct_option_index:
                question.correctOptionIndex === null || question.correctOptionIndex === undefined
                    ? null
                    : Number(question.correctOptionIndex),
            allow_file_upload: Boolean(question.allowFileUpload),
            answer: {
                selected_option_index:
                    answer?.mcqSelectedOptionIndex === null || answer?.mcqSelectedOptionIndex === undefined
                        ? null
                        : Number(answer.mcqSelectedOptionIndex),
                broad_text_answer: answer?.broadTextAnswer || '',
                answer_file_data: answer?.answerFileData || null,
                answer_file_name: answer?.answerFileName || null,
                answer_file_type: answer?.answerFileType || null
            },
            review: {
                awarded_marks:
                    answer?.awardedMarks === null || answer?.awardedMarks === undefined
                        ? null
                        : Number(answer.awardedMarks),
                teacher_explanation: answer?.teacherExplanation || '',
                review_file_data: answer?.reviewFileData || null,
                review_file_name: answer?.reviewFileName || null,
                review_file_type: answer?.reviewFileType || null,
                reviewed_at: toISOStringOrNull(answer?.reviewedAt)
            }
        };
    });

    const totalMarks = questions.reduce((sum, question) => sum + Number(question.marks || 0), 0);

    return {
        attempt_id: attempt.id,
        attempt_number: Number(attempt.attemptNumber || 0),
        attempt_status: attempt.status,
        grading_status: attempt.gradingStatus || ATTEMPT_GRADING_STATUS.PENDING,
        total_awarded_marks: Number(attempt.totalAwardedMarks || 0),
        submitted_at: toISOStringOrNull(attempt.submittedAt),
        graded_at: toISOStringOrNull(attempt.gradedAt),
        quiz: {
            id: attempt.quiz.id,
            title: attempt.quiz.title,
            description: attempt.quiz.description || '',
            batch_id: attempt.quiz.batchId,
            batch_name: attempt.quiz.batch?.batchName || attempt.quiz.batch?.name || null,
            total_marks: totalMarks
        },
        student: {
            id: attempt.student?.id || null,
            name: attempt.student?.name || null,
            email: attempt.student?.email || null
        },
        questions
    };
};

export const saveTeacherQuizAttemptReview = async (
    prisma,
    {
        requesterId,
        requesterRole,
        attemptId,
        reviews
    }
) => {
    if (!isUuid(requesterId)) {
        const error = new Error('Unable to resolve requester identity.');
        error.statusCode = 401;
        throw error;
    }
    if (!Array.isArray(reviews) || reviews.length === 0) {
        const error = new Error('reviews must be a non-empty array.');
        error.statusCode = 400;
        throw error;
    }

    const attempt = await getTeacherScopedAttempt(prisma, requesterId, requesterRole, attemptId);
    if (attempt.status !== ATTEMPT_STATUS.SUBMITTED) {
        const error = new Error('Only submitted quiz attempts can be reviewed.');
        error.statusCode = 400;
        throw error;
    }

    const questionById = new Map((attempt.quiz?.questions || []).map((question) => [question.id, question]));
    const existingAnswersByQuestionId = new Map((attempt.answers || []).map((answer) => [answer.questionId, answer]));
    const normalizedByQuestionId = new Map();

    for (const rawReview of reviews) {
        const questionId = normalizeString(rawReview?.question_id);
        if (!isUuid(questionId) || !questionById.has(questionId)) {
            const error = new Error('reviews contains invalid question_id.');
            error.statusCode = 400;
            throw error;
        }

        const question = questionById.get(questionId);
        const awardedMarks = toSafeInt(rawReview?.awarded_marks, -1);
        if (awardedMarks < 0 || awardedMarks > Number(question.marks || 0)) {
            const error = new Error(`awarded_marks for question ${question.orderNo} must be between 0 and ${question.marks}.`);
            error.statusCode = 400;
            throw error;
        }

        const teacherExplanation = normalizeString(rawReview?.teacher_explanation);
        if (teacherExplanation.length > MAX_TEACHER_EXPLANATION_LENGTH) {
            const error = new Error(`teacher_explanation too long for question ${question.orderNo}.`);
            error.statusCode = 400;
            throw error;
        }

        const reviewFileData = validateReviewFileData(rawReview?.review_file_data);
        const reviewFileName = normalizeString(rawReview?.review_file_name);
        const reviewFileType = normalizeString(rawReview?.review_file_type);

        normalizedByQuestionId.set(questionId, {
            awardedMarks,
            teacherExplanation: teacherExplanation || null,
            reviewFileData,
            reviewFileName: reviewFileName ? reviewFileName.slice(0, 255) : null,
            reviewFileType: reviewFileType ? reviewFileType.slice(0, 120) : null
        });
    }

    const now = new Date();
    let totalAwardedMarks = 0;

    await prisma.$transaction(async (tx) => {
        for (const question of attempt.quiz.questions || []) {
            const review = normalizedByQuestionId.get(question.id) || {
                awardedMarks: 0,
                teacherExplanation: null,
                reviewFileData: null,
                reviewFileName: null,
                reviewFileType: null
            };

            totalAwardedMarks += Number(review.awardedMarks || 0);

            const existingAnswer = existingAnswersByQuestionId.get(question.id) || null;
            await tx.quizAnswer.upsert({
                where: {
                    attemptId_questionId: {
                        attemptId: attempt.id,
                        questionId: question.id
                    }
                },
                create: {
                    attemptId: attempt.id,
                    questionId: question.id,
                    mcqSelectedOptionIndex: existingAnswer?.mcqSelectedOptionIndex ?? null,
                    broadTextAnswer: existingAnswer?.broadTextAnswer ?? null,
                    answerFileData: existingAnswer?.answerFileData ?? null,
                    answerFileName: existingAnswer?.answerFileName ?? null,
                    answerFileType: existingAnswer?.answerFileType ?? null,
                    awardedMarks: review.awardedMarks,
                    teacherExplanation: review.teacherExplanation,
                    reviewFileData: review.reviewFileData,
                    reviewFileName: review.reviewFileName,
                    reviewFileType: review.reviewFileType,
                    reviewedBy: requesterId,
                    reviewedAt: now
                },
                update: {
                    awardedMarks: review.awardedMarks,
                    teacherExplanation: review.teacherExplanation,
                    reviewFileData: review.reviewFileData,
                    reviewFileName: review.reviewFileName,
                    reviewFileType: review.reviewFileType,
                    reviewedBy: requesterId,
                    reviewedAt: now
                }
            });
        }

        await tx.quizAttempt.update({
            where: { id: attempt.id },
            data: {
                gradingStatus: ATTEMPT_GRADING_STATUS.GRADED,
                totalAwardedMarks,
                gradedBy: requesterId,
                gradedAt: now
            }
        });
    });

    return {
        message: 'Quiz evaluation saved successfully.',
        attempt_id: attempt.id,
        grading_status: ATTEMPT_GRADING_STATUS.GRADED,
        total_awarded_marks: totalAwardedMarks,
        graded_at: now.toISOString()
    };
};

export const getStudentResults = async (
    prisma,
    {
        studentId,
        batchId
    }
) => {
    if (!isUuid(studentId)) {
        const error = new Error('Unable to resolve student identity.');
        error.statusCode = 401;
        throw error;
    }

    const normalizedBatchId = normalizeString(batchId);
    if (normalizedBatchId && !isUuid(normalizedBatchId)) {
        const error = new Error('batch_id must be a valid UUID.');
        error.statusCode = 400;
        throw error;
    }

    const attempts = await prisma.quizAttempt.findMany({
        where: {
            studentId,
            status: ATTEMPT_STATUS.SUBMITTED,
            gradingStatus: ATTEMPT_GRADING_STATUS.GRADED,
            quiz: {
                batchId: normalizedBatchId || undefined
            }
        },
        include: {
            quiz: {
                select: {
                    id: true,
                    title: true,
                    batchId: true,
                    batch: {
                        select: {
                            id: true,
                            name: true,
                            batchName: true
                        }
                    },
                    questions: {
                        select: {
                            id: true,
                            marks: true
                        }
                    }
                }
            }
        },
        orderBy: {
            gradedAt: 'desc'
        }
    });

    const rows = attempts.map((attempt) => {
        const fullMarks = (attempt.quiz?.questions || []).reduce((sum, question) => sum + Number(question.marks || 0), 0);
        const obtainedMarks = Number(attempt.totalAwardedMarks || 0);
        const percentage = fullMarks > 0 ? Number(((obtainedMarks / fullMarks) * 100).toFixed(2)) : 0;

        return {
            attempt_id: attempt.id,
            quiz_id: attempt.quizId,
            quiz_title: attempt.quiz?.title || 'Quiz',
            batch_id: attempt.quiz?.batchId || null,
            batch_name: attempt.quiz?.batch?.batchName || attempt.quiz?.batch?.name || null,
            attempt_number: Number(attempt.attemptNumber || 0),
            obtained_marks: obtainedMarks,
            full_marks: fullMarks,
            percentage,
            submitted_at: toISOStringOrNull(attempt.submittedAt),
            graded_at: toISOStringOrNull(attempt.gradedAt)
        };
    });

    const totalObtained = rows.reduce((sum, row) => sum + Number(row.obtained_marks || 0), 0);
    const totalFullMarks = rows.reduce((sum, row) => sum + Number(row.full_marks || 0), 0);
    const averagePercentage = rows.length
        ? Number((rows.reduce((sum, row) => sum + Number(row.percentage || 0), 0) / rows.length).toFixed(2))
        : 0;
    const bestRow = rows.reduce((best, row) => (best === null || row.percentage > best.percentage ? row : best), null);

    return {
        metrics: {
            graded_quizzes: rows.length,
            total_obtained_marks: totalObtained,
            total_full_marks: totalFullMarks,
            average_percentage: averagePercentage,
            best_percentage: Number(bestRow?.percentage || 0),
            best_quiz_title: bestRow?.quiz_title || null
        },
        results: rows
    };
};

export const getStudentResultDetail = async (
    prisma,
    {
        studentId,
        attemptId
    }
) => {
    if (!isUuid(studentId)) {
        const error = new Error('Unable to resolve student identity.');
        error.statusCode = 401;
        throw error;
    }
    if (!isUuid(attemptId)) {
        const error = new Error('attempt_id must be a valid UUID.');
        error.statusCode = 400;
        throw error;
    }

    const attempt = await prisma.quizAttempt.findFirst({
        where: {
            id: attemptId,
            studentId,
            status: ATTEMPT_STATUS.SUBMITTED,
            gradingStatus: ATTEMPT_GRADING_STATUS.GRADED
        },
        include: {
            quiz: {
                include: {
                    batch: {
                        select: {
                            id: true,
                            name: true,
                            batchName: true
                        }
                    },
                    questions: {
                        orderBy: { orderNo: 'asc' }
                    }
                }
            },
            answers: true
        }
    });

    if (!attempt) {
        const error = new Error('Result not found.');
        error.statusCode = 404;
        throw error;
    }

    const answerByQuestionId = new Map((attempt.answers || []).map((answer) => [answer.questionId, answer]));
    const questions = (attempt.quiz?.questions || []).map((question) => {
        const answer = answerByQuestionId.get(question.id) || null;
        const options = Array.isArray(question.mcqOptions) ? question.mcqOptions : [];

        return {
            id: question.id,
            order_no: Number(question.orderNo || 0),
            type: question.questionType,
            question_text: question.questionText || '',
            question_image_data: question.questionImageData || null,
            marks: Number(question.marks || 0),
            options,
            correct_option_index:
                question.correctOptionIndex === null || question.correctOptionIndex === undefined
                    ? null
                    : Number(question.correctOptionIndex),
            answer: {
                selected_option_index:
                    answer?.mcqSelectedOptionIndex === null || answer?.mcqSelectedOptionIndex === undefined
                        ? null
                        : Number(answer.mcqSelectedOptionIndex),
                broad_text_answer: answer?.broadTextAnswer || '',
                answer_file_data: answer?.answerFileData || null,
                answer_file_name: answer?.answerFileName || null,
                answer_file_type: answer?.answerFileType || null
            },
            review: {
                awarded_marks:
                    answer?.awardedMarks === null || answer?.awardedMarks === undefined
                        ? 0
                        : Number(answer.awardedMarks),
                teacher_explanation: answer?.teacherExplanation || '',
                review_file_data: answer?.reviewFileData || null,
                review_file_name: answer?.reviewFileName || null,
                review_file_type: answer?.reviewFileType || null
            }
        };
    });

    const totalMarks = questions.reduce((sum, question) => sum + Number(question.marks || 0), 0);

    return {
        attempt_id: attempt.id,
        attempt_number: Number(attempt.attemptNumber || 0),
        obtained_marks: Number(attempt.totalAwardedMarks || 0),
        full_marks: totalMarks,
        percentage: totalMarks > 0 ? Number(((Number(attempt.totalAwardedMarks || 0) / totalMarks) * 100).toFixed(2)) : 0,
        submitted_at: toISOStringOrNull(attempt.submittedAt),
        graded_at: toISOStringOrNull(attempt.gradedAt),
        quiz: {
            id: attempt.quiz.id,
            title: attempt.quiz.title,
            description: attempt.quiz.description || '',
            batch_name: attempt.quiz?.batch?.batchName || attempt.quiz?.batch?.name || null
        },
        questions
    };
};

export const getStudentQuizzes = async (
    prisma,
    {
        studentId,
        batchId
    }
) => {
    if (!isUuid(studentId)) {
        const error = new Error('Unable to resolve student identity.');
        error.statusCode = 401;
        throw error;
    }

    const enrollments = await prisma.enrollment.findMany({
        where: {
            studentId,
            status: 'active'
        },
        select: { batchId: true }
    });

    const enrolledBatchIds = enrollments.map((enrollment) => enrollment.batchId);
    if (!enrolledBatchIds.length) return [];

    const normalizedBatchId = normalizeString(batchId);
    if (normalizedBatchId) {
        if (!isUuid(normalizedBatchId)) {
            const error = new Error('batch_id must be a valid UUID.');
            error.statusCode = 400;
            throw error;
        }
        if (!enrolledBatchIds.includes(normalizedBatchId)) {
            const error = new Error('You are not enrolled in the requested batch.');
            error.statusCode = 403;
            throw error;
        }
    }

    const scopedBatchIds = normalizedBatchId ? [normalizedBatchId] : enrolledBatchIds;
    if (scopedBatchIds.length) {
        await expireStudentAttemptsForScope(prisma, studentId, scopedBatchIds);
    }

    const quizzes = await prisma.quiz.findMany({
        where: {
            isActive: true,
            batchId: normalizedBatchId || { in: enrolledBatchIds }
        },
        include: {
            batch: {
                select: { id: true, name: true, batchName: true }
            },
            teacher: {
                select: { id: true, name: true }
            },
            questions: {
                select: {
                    id: true,
                    marks: true
                },
                orderBy: { id: 'asc' }
            },
            attempts: {
                where: { studentId },
                select: {
                    id: true,
                    attemptNumber: true,
                    status: true,
                    startedAt: true,
                    durationMinutes: true
                },
                orderBy: { attemptNumber: 'desc' }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    const now = new Date();
    return quizzes.map((quiz) => {
        const summary = summarizeStudentQuizAttemptState(quiz, now);
        const mapped = mapQuizResponse(quiz, { includeAnswers: false, includeQuestions: false });
        return {
            ...mapped,
            attempt_summary: summary,
            can_attempt: summary.can_attempt,
            can_resume: summary.can_resume,
            resume_attempt_id: summary.resume_attempt_id,
            attempt_message: summary.attempt_message
        };
    });
};

export const startQuizAttempt = async (
    prisma,
    {
        studentId,
        quizId
    }
) => {
    if (!isUuid(studentId)) {
        const error = new Error('Unable to resolve student identity.');
        error.statusCode = 401;
        throw error;
    }
    if (!isUuid(quizId)) {
        const error = new Error('quiz_id must be a valid UUID.');
        error.statusCode = 400;
        throw error;
    }

    const enrollment = await prisma.enrollment.findFirst({
        where: {
            studentId,
            status: 'active',
            batch: {
                quizzes: {
                    some: { id: quizId, isActive: true }
                }
            }
        },
        select: { batchId: true }
    });

    if (!enrollment) {
        const error = new Error('You are not allowed to attend this quiz.');
        error.statusCode = 403;
        throw error;
    }

    await expireStudentAttemptsForQuiz(prisma, studentId, quizId);

    const quiz = await prisma.quiz.findFirst({
        where: {
            id: quizId,
            isActive: true,
            batchId: enrollment.batchId
        },
        include: {
            batch: {
                select: { id: true, name: true, batchName: true }
            },
            teacher: {
                select: { id: true, name: true }
            },
            questions: {
                orderBy: { orderNo: 'asc' }
            },
            attempts: {
                where: { studentId },
                orderBy: { attemptNumber: 'desc' }
            }
        }
    });

    if (!quiz) {
        const error = new Error('Quiz not found.');
        error.statusCode = 404;
        throw error;
    }

    const inProgress = quiz.attempts.find((attempt) => attempt.status === ATTEMPT_STATUS.IN_PROGRESS) || null;
    if (inProgress) {
        const existing = await getAttemptByIdForStudent(prisma, inProgress.id, studentId);
        return mapAttemptResponse(existing);
    }

    const now = new Date();
    const { hasStarted, isEntryClosed } = getQuizEntryWindowState(quiz, now);
    if (!hasStarted) {
        const error = new Error('Quiz has not started yet.');
        error.statusCode = 400;
        throw error;
    }
    if (isEntryClosed) {
        const error = new Error('Quiz entry window is closed.');
        error.statusCode = 400;
        throw error;
    }

    if (quiz.attemptMode === QUIZ_ATTEMPT_MODE.ONE_TIME && quiz.attempts.length > 0) {
        const error = new Error('This quiz allows only one attempt.');
        error.statusCode = 400;
        throw error;
    }

    const nextAttemptNumber = (quiz.attempts[0]?.attemptNumber || 0) + 1;
    const created = await prisma.quizAttempt.create({
        data: {
            quizId: quiz.id,
            studentId,
            attemptNumber: nextAttemptNumber,
            status: ATTEMPT_STATUS.IN_PROGRESS,
            durationMinutes: quiz.durationMinutes
        }
    });

    const attempt = await getAttemptByIdForStudent(prisma, created.id, studentId);
    return mapAttemptResponse(attempt);
};

export const getStudentQuizAttempt = async (
    prisma,
    {
        studentId,
        attemptId
    }
) => {
    if (!isUuid(studentId)) {
        const error = new Error('Unable to resolve student identity.');
        error.statusCode = 401;
        throw error;
    }
    if (!isUuid(attemptId)) {
        const error = new Error('attempt_id must be a valid UUID.');
        error.statusCode = 400;
        throw error;
    }

    const attempt = await getAttemptByIdForStudent(prisma, attemptId, studentId);
    if (!attempt) {
        const error = new Error('Quiz attempt not found.');
        error.statusCode = 404;
        throw error;
    }

    if (attempt.status === ATTEMPT_STATUS.IN_PROGRESS && isExpiredByClock(attempt)) {
        await prisma.quizAttempt.update({
            where: { id: attempt.id },
            data: { status: ATTEMPT_STATUS.EXPIRED }
        });
        attempt.status = ATTEMPT_STATUS.EXPIRED;
    }

    return mapAttemptResponse(attempt);
};

export const submitQuizAttempt = async (prisma, { studentId, attemptId, answers }) => {
    const attempt = await prisma.quizAttempt.findUnique({
        where: { id: attemptId },
        include: {
            quiz: {
                include: {
                    questions: true
                }
            }
        }
    });

    if (!attempt || attempt.studentId !== studentId) {
        const error = new Error('Quiz attempt not found.');
        error.statusCode = 404;
        throw error;
    }

    if (attempt.status === ATTEMPT_STATUS.SUBMITTED) {
        const error = new Error('This attempt has already been submitted.');
        error.statusCode = 400;
        throw error;
    }

    let autoScore = 0;
    let hasBroadQuestions = false;

    const processedAnswers = (answers || []).map((ans) => {
        const question = attempt.quiz.questions.find((q) => q.id === ans.question_id);
        if (!question) return null;

        let awardedMarks = null; 

        if (question.questionType === QUESTION_TYPE.MCQ) {
            const isCorrect = question.correctOptionIndex === ans.selected_option_index;
            awardedMarks = isCorrect ? Number(question.marks || 0) : 0;
            autoScore += awardedMarks;
        } else {
            hasBroadQuestions = true;
        }

        return {
            questionId: question.id,
            mcqSelectedOptionIndex: ans.selected_option_index,
            broadTextAnswer: ans.broad_text_answer || null,
            awardedMarks: awardedMarks,
        };
    }).filter(Boolean);

    return await prisma.$transaction(async (tx) => {
        for (const data of processedAnswers) {
            await tx.quizAnswer.upsert({
                where: {
                    attemptId_questionId: {
                        attemptId: attemptId,
                        questionId: data.questionId
                    }
                },
                update: {
                    mcqSelectedOptionIndex: data.mcqSelectedOptionIndex,
                    broadTextAnswer: data.broadTextAnswer,
                    awardedMarks: data.awardedMarks,
                },
                create: {
                    attemptId: attemptId,
                    ...data
                }
            });
        }

        const finalGradingStatus = hasBroadQuestions 
            ? ATTEMPT_GRADING_STATUS.PENDING 
            : ATTEMPT_GRADING_STATUS.GRADED;

        const updatedAttempt = await tx.quizAttempt.update({
            where: { id: attemptId },
            data: {
                status: ATTEMPT_STATUS.SUBMITTED,
                submittedAt: new Date(),
                totalAwardedMarks: autoScore,
                gradingStatus: finalGradingStatus,
                gradedAt: hasBroadQuestions ? null : new Date()
            },
            include: {
                quiz: {
                    include: {
                        batch: true,
                        teacher: true,
                        questions: true
                    }
                },
                answers: true
            }
        });

        return mapAttemptResponse(updatedAttempt);
    });
};


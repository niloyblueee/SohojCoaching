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

const MAX_QUIZ_TITLE_LENGTH = 180;
const MAX_QUIZ_DESCRIPTION_LENGTH = 3000;
const MAX_QUESTION_TEXT_LENGTH = 4000;
const MAX_IMAGE_DATA_LENGTH = 1_500_000;
const MAX_QUESTIONS_PER_QUIZ = 60;
const MAX_BROAD_ANSWER_TEXT_LENGTH = 6000;
const MAX_ANSWER_FILE_DATA_LENGTH = 7_000_000;

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
                    answer_file_type: answer.answerFileType || null
                }
                : {
                    selected_option_index: null,
                    broad_text_answer: '',
                    answer_file_data: null,
                    answer_file_name: null,
                    answer_file_type: null
                }
        };
    });

    return {
        attempt_id: attempt.id,
        quiz_id: attempt.quizId,
        student_id: attempt.studentId,
        attempt_number: Number(attempt.attemptNumber || 0),
        status: attempt.status,
        started_at: toISOStringOrNull(attempt.startedAt),
        submitted_at: toISOStringOrNull(attempt.submittedAt),
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

    const answers = await prisma.quizAnswer.findMany({
        where: {
            answerFileData: {
                not: null
            },
            attempt: {
                quiz: {
                    id: normalizedQuizId || undefined,
                    batchId: normalizedBatchId || { in: scopedBatchIds }
                }
            }
        },
        include: {
            question: {
                select: {
                    id: true,
                    orderNo: true,
                    questionType: true,
                    questionText: true,
                    questionImageData: true,
                    marks: true
                }
            },
            attempt: {
                select: {
                    id: true,
                    attemptNumber: true,
                    status: true,
                    startedAt: true,
                    submittedAt: true,
                    student: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    quiz: {
                        select: {
                            id: true,
                            title: true,
                            batch: {
                                select: {
                                    id: true,
                                    name: true,
                                    batchName: true
                                }
                            }
                        }
                    }
                }
            }
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });

    const byQuiz = new Map();

    for (const answer of answers) {
        const quiz = answer.attempt.quiz;
        const batch = quiz.batch;
        const student = answer.attempt.student;

        if (!byQuiz.has(quiz.id)) {
            byQuiz.set(quiz.id, {
                quiz_id: quiz.id,
                quiz_title: quiz.title,
                batch_id: batch.id,
                batch_name: batch.batchName || batch.name || null,
                script_count: 0,
                student_groups: []
            });
        }

        const quizGroup = byQuiz.get(quiz.id);
        let studentGroup = quizGroup.student_groups.find((entry) => entry.student_id === student.id);
        if (!studentGroup) {
            studentGroup = {
                student_id: student.id,
                student_name: student.name,
                student_email: student.email,
                attempts: []
            };
            quizGroup.student_groups.push(studentGroup);
        }

        let attemptGroup = studentGroup.attempts.find((entry) => entry.attempt_id === answer.attempt.id);
        if (!attemptGroup) {
            attemptGroup = {
                attempt_id: answer.attempt.id,
                attempt_number: Number(answer.attempt.attemptNumber || 0),
                attempt_status: answer.attempt.status,
                started_at: toISOStringOrNull(answer.attempt.startedAt),
                submitted_at: toISOStringOrNull(answer.attempt.submittedAt),
                files: []
            };
            studentGroup.attempts.push(attemptGroup);
        }

        attemptGroup.files.push({
            answer_id: answer.id,
            question_id: answer.questionId,
            question_order_no: Number(answer.question.orderNo || 0),
            question_type: answer.question.questionType,
            question_text: answer.question.questionText || '',
            question_image_data: answer.question.questionImageData || null,
            marks: Number(answer.question.marks || 0),
            answer_file_data: answer.answerFileData || null,
            answer_file_name: answer.answerFileName || null,
            answer_file_type: answer.answerFileType || null,
            updated_at: toISOStringOrNull(answer.updatedAt)
        });

        quizGroup.script_count += 1;
    }

    const grouped = Array.from(byQuiz.values());
    grouped.forEach((quizGroup) => {
        quizGroup.student_groups.forEach((studentGroup) => {
            studentGroup.attempts.sort((a, b) => b.attempt_number - a.attempt_number);
            studentGroup.attempts.forEach((attempt) => {
                attempt.files.sort((a, b) => a.question_order_no - b.question_order_no);
            });
        });
        quizGroup.student_groups.sort((a, b) => a.student_name.localeCompare(b.student_name));
    });

    return grouped;
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

export const submitQuizAttempt = async (
    prisma,
    {
        studentId,
        attemptId,
        answers
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
    if (!Array.isArray(answers)) {
        const error = new Error('answers must be an array.');
        error.statusCode = 400;
        throw error;
    }

    const attempt = await prisma.quizAttempt.findFirst({
        where: {
            id: attemptId,
            studentId
        },
        include: {
            quiz: {
                include: {
                    questions: {
                        orderBy: { orderNo: 'asc' }
                    }
                }
            }
        }
    });

    if (!attempt) {
        const error = new Error('Quiz attempt not found.');
        error.statusCode = 404;
        throw error;
    }

    if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
        const error = new Error('This attempt is already finished.');
        error.statusCode = 400;
        throw error;
    }

    if (isExpiredByClock(attempt)) {
        await prisma.quizAttempt.update({
            where: { id: attempt.id },
            data: { status: ATTEMPT_STATUS.EXPIRED }
        });
        const error = new Error('Time is over for this quiz attempt.');
        error.statusCode = 400;
        throw error;
    }

    const questionById = new Map(attempt.quiz.questions.map((question) => [question.id, question]));
    const normalizedAnswers = [];

    for (const rawAnswer of answers) {
        const questionId = normalizeString(rawAnswer?.question_id);
        if (!isUuid(questionId) || !questionById.has(questionId)) {
            const error = new Error('answers contains invalid question_id.');
            error.statusCode = 400;
            throw error;
        }

        const question = questionById.get(questionId);
        if (question.questionType === QUESTION_TYPE.MCQ) {
            const selectedOption =
                rawAnswer?.selected_option_index === null ||
                rawAnswer?.selected_option_index === undefined ||
                rawAnswer?.selected_option_index === ''
                    ? null
                    : toSafeInt(rawAnswer?.selected_option_index, -1);

            if (selectedOption === null) {
                continue;
            }

            const options = Array.isArray(question.mcqOptions) ? question.mcqOptions : [];
            if (selectedOption < 0 || selectedOption >= options.length) {
                const error = new Error(`Invalid selected_option_index for question ${question.orderNo}.`);
                error.statusCode = 400;
                throw error;
            }

            normalizedAnswers.push({
                attemptId: attempt.id,
                questionId,
                mcqSelectedOptionIndex: selectedOption,
                broadTextAnswer: null,
                answerFileData: null,
                answerFileName: null,
                answerFileType: null
            });
            continue;
        }

        const broadTextAnswer = normalizeString(rawAnswer?.broad_text_answer);
        if (broadTextAnswer.length > MAX_BROAD_ANSWER_TEXT_LENGTH) {
            const error = new Error(`broad_text_answer too long for question ${question.orderNo}.`);
            error.statusCode = 400;
            throw error;
        }

        const answerFileData = validateAnswerFileData(rawAnswer?.answer_file_data);
        const answerFileName = normalizeString(rawAnswer?.answer_file_name);
        const answerFileType = normalizeString(rawAnswer?.answer_file_type);

        if (!broadTextAnswer && !answerFileData) {
            continue;
        }

        normalizedAnswers.push({
            attemptId: attempt.id,
            questionId,
            mcqSelectedOptionIndex: null,
            broadTextAnswer: broadTextAnswer || null,
            answerFileData,
            answerFileName: answerFileName ? answerFileName.slice(0, 255) : null,
            answerFileType: answerFileType ? answerFileType.slice(0, 120) : null
        });
    }

    const answeredQuestionIds = normalizedAnswers.map((answer) => answer.questionId);
    const allQuestionIds = attempt.quiz.questions.map((question) => question.id);

    await prisma.$transaction(async (tx) => {
        for (const answer of normalizedAnswers) {
            await tx.quizAnswer.upsert({
                where: {
                    attemptId_questionId: {
                        attemptId: answer.attemptId,
                        questionId: answer.questionId
                    }
                },
                create: answer,
                update: {
                    mcqSelectedOptionIndex: answer.mcqSelectedOptionIndex,
                    broadTextAnswer: answer.broadTextAnswer,
                    answerFileData: answer.answerFileData,
                    answerFileName: answer.answerFileName,
                    answerFileType: answer.answerFileType
                }
            });
        }

        const unansweredQuestionIds = allQuestionIds.filter((id) => !answeredQuestionIds.includes(id));
        if (unansweredQuestionIds.length > 0) {
            await tx.quizAnswer.deleteMany({
                where: {
                    attemptId: attempt.id,
                    questionId: { in: unansweredQuestionIds }
                }
            });
        }

        await tx.quizAttempt.update({
            where: { id: attempt.id },
            data: {
                status: ATTEMPT_STATUS.SUBMITTED,
                submittedAt: new Date()
            }
        });
    });

    return {
        message: 'Quiz submitted successfully.',
        attempt_id: attempt.id,
        answered_count: normalizedAnswers.length,
        total_questions: allQuestionIds.length,
        submitted_at: new Date().toISOString()
    };
};

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

const MAX_QUIZ_TITLE_LENGTH = 180;
const MAX_QUIZ_DESCRIPTION_LENGTH = 3000;
const MAX_QUESTION_TEXT_LENGTH = 4000;
const MAX_IMAGE_DATA_LENGTH = 1_500_000;
const MAX_QUESTIONS_PER_QUIZ = 60;

const normalizeString = (value) => String(value || '').trim();

const toSafeInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const validateImageData = (value, fieldLabel) => {
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

const mapQuestionResponse = (question) => {
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
            question.correctOptionIndex === null || question.correctOptionIndex === undefined
                ? null
                : Number(question.correctOptionIndex),
        allow_file_upload: Boolean(question.allowFileUpload)
    };
};

const mapQuizResponse = (quiz, { includeAnswers = true } = {}) => {
    const questions = (quiz.questions || []).map((question) => {
        const mapped = mapQuestionResponse(question);
        if (!includeAnswers && mapped.type === QUESTION_TYPE.MCQ) {
            mapped.correct_option_index = null;
        }
        return mapped;
    });

    const totalMarks = questions.reduce((sum, question) => sum + Number(question.marks || 0), 0);
    const startsAt = quiz.startsAt ? new Date(quiz.startsAt) : null;
    const now = new Date();
    const canStartNow =
        quiz.availabilityType === QUIZ_AVAILABILITY.ANYTIME ||
        (startsAt ? startsAt.getTime() <= now.getTime() : false);

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
        duration_minutes: Number(quiz.durationMinutes || 0),
        attempt_mode: quiz.attemptMode,
        is_active: Boolean(quiz.isActive),
        question_count: questions.length,
        total_marks: totalMarks,
        can_start_now: canStartNow,
        created_at: quiz.createdAt?.toISOString?.() || quiz.createdAt,
        questions
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
        const imageData = validateImageData(question?.question_image_data, `questions[${index}].question_image_data`);

        if (!questionText && !imageData) {
            const error = new Error(
                `questions[${index}] must contain either question_text or question_image_data.`
            );
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
    if (normalizedAvailability === QUIZ_AVAILABILITY.SCHEDULED) {
        const parsed = new Date(startsAt);
        if (Number.isNaN(parsed.getTime())) {
            const error = new Error('starts_at is required and must be a valid datetime for scheduled quizzes.');
            error.statusCode = 400;
            throw error;
        }
        normalizedStartsAt = parsed;
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
                    select: {
                        id: true,
                        name: true,
                        batchName: true
                    }
                },
                teacher: {
                    select: {
                        id: true,
                        name: true
                    }
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
    if (!scopedBatchIds.length) {
        return [];
    }

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
                select: {
                    id: true,
                    name: true,
                    batchName: true
                }
            },
            teacher: {
                select: {
                    id: true,
                    name: true
                }
            },
            questions: {
                orderBy: { orderNo: 'asc' }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return quizzes.map((quiz) => mapQuizResponse(quiz));
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
        select: {
            batchId: true
        }
    });

    const enrolledBatchIds = enrollments.map((enrollment) => enrollment.batchId);
    if (!enrolledBatchIds.length) {
        return [];
    }

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

    const quizzes = await prisma.quiz.findMany({
        where: {
            isActive: true,
            batchId: normalizedBatchId || { in: enrolledBatchIds }
        },
        include: {
            batch: {
                select: {
                    id: true,
                    name: true,
                    batchName: true
                }
            },
            teacher: {
                select: {
                    id: true,
                    name: true
                }
            },
            questions: {
                orderBy: { orderNo: 'asc' }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return quizzes.map((quiz) => mapQuizResponse(quiz, { includeAnswers: false }));
};

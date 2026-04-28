import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js'; 

export const createFeeRoutes = (prisma) => {
    const router = Router();

    // 1. GET ALL FEES 
    router.get('/admin/fees', requireAdmin, async (req, res) => {
        try {
            const rawFees = await prisma.$queryRaw`
                SELECT 
                    e.id AS enrollment_id,
                    u.name AS student_name,
                    COALESCE(NULLIF(b.batch_name, ''), b.name) AS batch_name,              
                    b.batch_duration,
                    COALESCE(b.discounted_fee, b.monthly_fee, 0) AS effective_fee,
                    COALESCE(MAX(fp.month_number), 0)::int AS paid_months
                FROM enrollments e
                JOIN users u ON e.student_id = u.id
                JOIN batches b ON e.batch_id = b.id
                LEFT JOIN fee_payments fp ON e.id = fp.enrollment_id
                WHERE LOWER(e.status::text) = 'active'
                GROUP BY e.id, u.name, b.batch_name, b.name, b.batch_duration, b.discounted_fee, b.monthly_fee
                ORDER BY u.name ASC;
            `;

            const formattedFees = rawFees.map(fee => {
                const match = String(fee.batch_duration || '').match(/\d+/);
                const durationMonths = match ? parseInt(match[0], 10) : 1; 
                const monthlyFee = parseFloat(fee.effective_fee) || 0;

                return {
                    enrollment_id: fee.enrollment_id,
                    student_name: fee.student_name,
                    batch_name: fee.batch_name,
                    duration_months: durationMonths,
                    monthly_fee: monthlyFee, 
                    total_fee: durationMonths * monthlyFee, 
                    paid_months: Number(fee.paid_months) || 0
                };
            });

            res.json(formattedFees);
        } catch (err) {
            console.error("FEE FETCH ERROR:", err);
            res.status(500).json({ error: "Failed to fetch fee list." });
        }
    });

    // 2. MARK AS PAID 
    // Helper to check if a string is a valid UUID
    const isValidUUID = (uuid) => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
    };

    router.post('/admin/fees/pay', requireAdmin, async (req, res) => {
    const { enrollment_id, month_number, payment_method, transaction_info, amount_paid } = req.body;
    
    const rawAdminId = req.user?.id || req.auth?.sub || req.userId || null;

    try {
        // 1. Validate Enrollment ID format before querying
        if (!isValidUUID(enrollment_id)) {
            return res.status(400).json({ error: "Invalid Enrollment ID format." });
        }

        const enrollment = await prisma.enrollment.findUnique({
            where: { id: enrollment_id },
            include: { batch: true } 
        });

        if (!enrollment) {
            return res.status(404).json({ error: "Enrollment not found." });
        }

        // 2. Validate month numbers
        const match = String(enrollment.batch.batchDuration || '').match(/\d+/);
        const maxMonths = match ? parseInt(match[0], 10) : 1;

        if (month_number > maxMonths) {
            return res.status(400).json({ error: "Student has already completed all payments for this batch." });
        }

        // 3. Determine payment amount
        const fallbackFee = enrollment.batch.discountedFee != null 
            ? Number(enrollment.batch.discountedFee) 
            : Number(enrollment.batch.monthlyFee);

        const finalAmountPaid = amount_paid !== undefined ? Number(amount_paid) : fallbackFee;

        // 4. Clean the recordedBy ID
        const validRecordedBy = isValidUUID(rawAdminId) ? rawAdminId : null;

        await prisma.feePayment.create({
            data: {
                enrollmentId: enrollment_id,
                monthNumber: parseInt(month_number, 10),
                paymentMethod: payment_method || 'cash',
                transactionInfo: transaction_info || '',
                recordedBy: validRecordedBy, 
                amountPaid: Math.round(finalAmountPaid), 
            }
        });

        res.json({ message: "Payment recorded successfully!" });
        } catch (err) {
        console.error("PAYMENT ERROR:", err);
        
        if (err.code === 'P2002') {
            return res.status(400).json({ error: "This month is already paid." });
        }
        res.status(500).json({ error: "Database error. Failed to save payment." });
        }
        });

    return router;
};
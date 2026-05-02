import { useCallback, useEffect, useMemo, useState } from 'react';
import '../../FeeDashboard.css';
import { generateMonthlyDues, getAdminFeeDashboard, recordFeePayment } from '../../services/feeApi';

const money = new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0
});

const formatMoney = (value) => money.format(Number(value || 0));
const formatRate = (value) => `${Number(value || 0).toFixed(2)}%`;

const StatCard = ({ label, value, accent = 'primary' }) => (
    <article className={`fee-stat-card fee-stat-card-${accent}`}>
        <p>{label}</p>
        <strong>{value}</strong>
    </article>
);

function FeeManagement() {
    const [dashboard, setDashboard] = useState({
        generated: null,
        summary: null,
        enrollments: []
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    const [expandedId, setExpandedId] = useState('');
    const [paymentDraft, setPaymentDraft] = useState({
        enrollmentId: '',
        dueId: '',
        monthNumber: 0,
        paymentMethod: 'cash',
        transactionInfo: '',
        amountPaid: ''
    });
    const [submitting, setSubmitting] = useState(false);

    const loadDashboard = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        setError('');

        try {
            const data = await getAdminFeeDashboard();
            setDashboard({
                generated: data.generated || null,
                summary: data.summary || null,
                enrollments: Array.isArray(data.enrollments) ? data.enrollments : []
            });
        } catch (err) {
            setError(err.message || 'Failed to load fee dashboard.');
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const selectedDueContext = useMemo(() => {
        if (!paymentDraft.dueId || !paymentDraft.enrollmentId) return null;
        const enrollment = dashboard.enrollments.find((row) => row.enrollment_id === paymentDraft.enrollmentId);
        if (!enrollment) return null;
        const due = enrollment.dues?.find((item) => item.due_id === paymentDraft.dueId);
        if (!due) return null;
        return { enrollment, due };
    }, [dashboard.enrollments, paymentDraft.dueId, paymentDraft.enrollmentId]);

    const openPayment = (enrollment, due) => {
        setPaymentDraft({
            enrollmentId: enrollment.enrollment_id,
            dueId: due.due_id,
            monthNumber: due.month_number,
            paymentMethod: 'cash',
            transactionInfo: '',
            amountPaid: String(due.amount_due || 0)
        });
        setError('');
    };

    const closePayment = () => {
        setPaymentDraft({
            enrollmentId: '',
            dueId: '',
            monthNumber: 0,
            paymentMethod: 'cash',
            transactionInfo: '',
            amountPaid: ''
        });
    };

    const handleGenerate = async () => {
        setStatus('');
        setError('');
        try {
            const result = await generateMonthlyDues();
            setStatus(
                `Generation complete: ${result.created_due_rows || 0} new dues, ${result.synced_paid_rows || 0} synced payments.`
            );
            await loadDashboard({ silent: true });
        } catch (err) {
            setError(err.message || 'Failed to generate monthly dues.');
        }
    };

    const handlePaymentSubmit = async (event) => {
        event.preventDefault();
        if (!selectedDueContext || submitting) return;

        const fullDueAmount = Number(selectedDueContext.due.amount_due || 0);
        if (!Number.isFinite(fullDueAmount) || fullDueAmount <= 0) {
            setError('Invalid due amount for this month.');
            return;
        }

        setSubmitting(true);
        setError('');
        setStatus('');

        try {
            await recordFeePayment({
                enrollment_id: paymentDraft.enrollmentId,
                due_id: paymentDraft.dueId,
                month_number: paymentDraft.monthNumber,
                payment_method: paymentDraft.paymentMethod,
                transaction_info: paymentDraft.transactionInfo,
                amount_paid: fullDueAmount
            });

            setStatus(
                `Payment recorded for ${selectedDueContext.enrollment.student_name} (${selectedDueContext.due.due_month_label}).`
            );
            closePayment();
            await loadDashboard({ silent: true });
        } catch (err) {
            setError(err.message || 'Failed to record payment.');
        } finally {
            setSubmitting(false);
        }
    };

    const summary = dashboard.summary || {
        total_payable: 0,
        total_paid: 0,
        total_due: 0,
        collection_rate: 0,
        current_month_payable: 0,
        current_month_paid: 0,
        current_month_collection_rate: 0,
        active_students: 0,
        active_enrollments: 0,
        paid_due_count: 0,
        unpaid_due_count: 0
    };
    const generationTimestamp = dashboard.generated?.executed_at
        ? new Date(dashboard.generated.executed_at).toLocaleString()
        : '';

    return (
        <section className="fee-shell fee-shell-admin">
            <header className="fee-header">
                <div>
                    <p className="fee-kicker">FR-7: Automated Due Calculation</p>
                    <h2>Fee Management Dashboard</h2>
                    <p>
                        Monthly dues are auto-generated by system schedule and synced with payment records for
                        real-time collection visibility.
                    </p>
                </div>

                <div className="fee-header-actions">
                    <button type="button" className="fee-btn ghost" onClick={() => loadDashboard()}>
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <button type="button" className="fee-btn primary" onClick={handleGenerate}>
                        Generate Dues Now
                    </button>
                </div>
            </header>
            {generationTimestamp && <p className="fee-generated-at">Last due sync: {generationTimestamp}</p>}

            {status && <p className="fee-status">{status}</p>}
            {error && <p className="fee-status fee-status-error">{error}</p>}

            <div className="fee-stat-grid">
                <StatCard label="Total Payable" value={formatMoney(summary.total_payable)} accent="primary" />
                <StatCard label="Total Paid" value={formatMoney(summary.total_paid)} accent="success" />
                <StatCard label="Total Due" value={formatMoney(summary.total_due)} accent="danger" />
                <StatCard label="Collection Rate" value={formatRate(summary.collection_rate)} accent="neutral" />
                <StatCard label="Current Month Payable" value={formatMoney(summary.current_month_payable)} accent="primary" />
                <StatCard label="Current Month Paid" value={formatMoney(summary.current_month_paid)} accent="success" />
                <StatCard
                    label="Current Month Collection"
                    value={formatRate(summary.current_month_collection_rate)}
                    accent="neutral"
                />
                <StatCard label="Active Students" value={String(summary.active_students)} accent="neutral" />
            </div>

            <section className="fee-table-wrap">
                {dashboard.enrollments.length === 0 ? (
                    <p className="fee-empty">No active enrollment fee data available.</p>
                ) : (
                    <table className="fee-table">
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Batch</th>
                                <th>Monthly Fee</th>
                                <th>Total Payable</th>
                                <th>Total Paid</th>
                                <th>Total Due</th>
                                <th>Progress</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dashboard.enrollments.map((row) => {
                                const expanded = expandedId === row.enrollment_id;
                                const nextUnpaid = row.dues?.find((due) => !due.is_paid) || null;
                                return (
                                    <tr key={row.enrollment_id}>
                                        <td>
                                            <strong>{row.student_name}</strong>
                                        </td>
                                        <td>{row.batch_name}</td>
                                        <td>{formatMoney(row.monthly_fee)}</td>
                                        <td>{formatMoney(row.total_payable)}</td>
                                        <td>{formatMoney(row.total_paid)}</td>
                                        <td>{formatMoney(row.total_due)}</td>
                                        <td>
                                            <div className="fee-progress-meta">
                                                {row.paid_months}/{row.total_generated_months} months paid (
                                                {formatRate(row.completion_rate)})
                                            </div>
                                            <div className="fee-progress-track">
                                                <div
                                                    className="fee-progress-fill"
                                                    style={{ width: `${Math.min(row.completion_rate || 0, 100)}%` }}
                                                />
                                            </div>
                                        </td>
                                        <td>
                                            <div className="fee-row-actions">
                                                <button
                                                    type="button"
                                                    className="fee-btn ghost small"
                                                    onClick={() =>
                                                        setExpandedId(expanded ? '' : row.enrollment_id)
                                                    }
                                                >
                                                    {expanded ? 'Hide Months' : 'View Months'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="fee-btn primary small"
                                                    disabled={!nextUnpaid}
                                                    onClick={() => nextUnpaid && openPayment(row, nextUnpaid)}
                                                >
                                                    {nextUnpaid ? 'Pay Next Due' : 'Paid'}
                                                </button>
                                            </div>
                                            {nextUnpaid && (
                                                <small className="fee-next-due">
                                                    Next: {nextUnpaid.due_month_label} ({formatMoney(nextUnpaid.amount_due)})
                                                </small>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </section>

            {expandedId && (
                <section className="fee-detail-panel">
                    {dashboard.enrollments
                        .filter((row) => row.enrollment_id === expandedId)
                        .map((row) => (
                            <div key={`${row.enrollment_id}-detail`}>
                                <h3>
                                    Monthly Dues - {row.student_name} ({row.batch_name})
                                </h3>
                                <div className="fee-detail-table-wrap">
                                    <table className="fee-detail-table">
                                        <thead>
                                            <tr>
                                                <th>Month</th>
                                                <th>Status</th>
                                                <th>Amount Due</th>
                                                <th>Amount Paid</th>
                                                <th>Payment Method</th>
                                                <th>Payment Date</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {row.dues?.map((due) => (
                                                <tr key={due.due_id}>
                                                    <td>{due.due_month_label}</td>
                                                    <td>
                                                        <span
                                                            className={`fee-badge ${
                                                                due.is_paid ? 'fee-badge-paid' : 'fee-badge-unpaid'
                                                            }`}
                                                        >
                                                            {due.is_paid ? 'Paid' : 'Unpaid'}
                                                        </span>
                                                    </td>
                                                    <td>{formatMoney(due.amount_due)}</td>
                                                    <td>{formatMoney(due.amount_paid)}</td>
                                                    <td>{due.payment_method || '-'}</td>
                                                    <td>{due.payment_date ? new Date(due.payment_date).toLocaleString() : '-'}</td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="fee-btn primary small"
                                                            disabled={due.is_paid}
                                                            onClick={() => openPayment(row, due)}
                                                        >
                                                            {due.is_paid ? 'Done' : 'Pay'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                </section>
            )}

            {selectedDueContext && (
                <div className="fee-modal-backdrop" onClick={closePayment} role="presentation">
                    <div className="fee-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                        <h3>Record Payment</h3>
                        <p>
                            {selectedDueContext.enrollment.student_name} - {selectedDueContext.enrollment.batch_name}
                        </p>
                        <p className="fee-modal-due">
                            Paying {selectedDueContext.due.due_month_label} (
                            {formatMoney(selectedDueContext.due.amount_due)})
                        </p>

                        <form onSubmit={handlePaymentSubmit} className="fee-modal-form">
                            <label>
                                Payment Method
                                <select
                                    value={paymentDraft.paymentMethod}
                                    onChange={(event) =>
                                        setPaymentDraft((prev) => ({ ...prev, paymentMethod: event.target.value }))
                                    }
                                    required
                                >
                                    <option value="cash">Cash</option>
                                    <option value="bKash">bKash</option>
                                    <option value="Nagad">Nagad</option>
                                    <option value="Bank">Bank Transfer</option>
                                </select>
                            </label>

                            <label>
                                Amount (Fixed Full Due)
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={paymentDraft.amountPaid}
                                    readOnly
                                    required
                                />
                            </label>

                            <label>
                                Transaction Info
                                <input
                                    type="text"
                                    value={paymentDraft.transactionInfo}
                                    onChange={(event) =>
                                        setPaymentDraft((prev) => ({
                                            ...prev,
                                            transactionInfo: event.target.value
                                        }))
                                    }
                                    placeholder="TRX/Receipt/Reference"
                                />
                            </label>

                            <div className="fee-modal-actions">
                                <button type="button" className="fee-btn ghost" onClick={closePayment}>
                                    Cancel
                                </button>
                                <button type="submit" className="fee-btn primary" disabled={submitting}>
                                    {submitting ? 'Saving...' : 'Confirm Payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}

export default FeeManagement;

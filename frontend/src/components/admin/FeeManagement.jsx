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
        enrollments: [],
        analytics: null
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
    const [activePanel, setActivePanel] = useState('overview');
    const [dueDetails, setDueDetails] = useState(null);

    const loadDashboard = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        setError('');

        try {
            const data = await getAdminFeeDashboard();
            setDashboard({
                generated: data.generated || null,
                summary: data.summary || null,
                enrollments: Array.isArray(data.enrollments) ? data.enrollments : [],
                analytics: data.analytics || null
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

    const dueMonitoring = useMemo(() => {
        const studentsMap = new Map();
        let totalOutstanding = 0;

        for (const enrollment of dashboard.enrollments) {
            const enrollmentDue = Number(enrollment.total_due || 0);
            if (!Number.isFinite(enrollmentDue)) continue;
            totalOutstanding += enrollmentDue;

            if (enrollmentDue <= 0) continue;

            const existing = studentsMap.get(enrollment.student_id) || {
                student_id: enrollment.student_id,
                student_name: enrollment.student_name,
                total_due: 0,
                batches: new Map(),
                enrollments: []
            };

            existing.total_due += enrollmentDue;
            existing.enrollments.push({
                batch_name: enrollment.batch_name,
                dues: enrollment.dues || []
            });
            if (enrollment.batch_name) {
                existing.batches.set(enrollment.batch_name, true);
            }
            studentsMap.set(enrollment.student_id, existing);
        }

        const students = Array.from(studentsMap.values())
            .map((student) => ({
                ...student,
                batch_list: Array.from(student.batches.keys()).filter(Boolean)
            }))
            .sort((a, b) => b.total_due - a.total_due);

        return {
            total_outstanding: totalOutstanding,
            students
        };
    }, [dashboard.enrollments]);

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

    const handleSegmentChange = (segment) => {
        setActivePanel(segment);
        setExpandedId('');
        setStatus('');
        setError('');
        setDueDetails(null);
        if (segment !== 'overview') {
            closePayment();
        }
    };

    const formatBatchList = (batchList = []) => {
        if (!batchList.length) return '-';
        if (batchList.length <= 2) return batchList.join(', ');
        return `${batchList[0]}, ${batchList[1]} +${batchList.length - 2}`;
    };

    const buildDueDetails = (student) => {
        const monthMap = new Map();
        const batchMap = new Map();

        for (const enrollment of student.enrollments || []) {
            const batchName = enrollment.batch_name || 'Unknown';
            for (const due of enrollment.dues || []) {
                if (due.is_paid) continue;
                const amountDue = Number(due.amount_due || 0);
                if (!Number.isFinite(amountDue) || amountDue <= 0) continue;

                const monthKey = due.due_month_key || due.due_month_label || 'unknown';
                const monthLabel = due.due_month_label || 'Unknown';

                const monthEntry = monthMap.get(monthKey) || {
                    month_key: monthKey,
                    month_label: monthLabel,
                    amount_due: 0
                };
                monthEntry.amount_due += amountDue;
                monthMap.set(monthKey, monthEntry);

                const batchEntry = batchMap.get(batchName) || {
                    batch_name: batchName,
                    amount_due: 0
                };
                batchEntry.amount_due += amountDue;
                batchMap.set(batchName, batchEntry);
            }
        }

        return {
            student_name: student.student_name,
            total_due: student.total_due,
            months: Array.from(monthMap.values()).sort((a, b) => a.month_key.localeCompare(b.month_key)),
            batches: Array.from(batchMap.values()).sort((a, b) => b.amount_due - a.amount_due)
        };
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
    const analytics = dashboard.analytics || {};
    const revenueSummary = analytics.revenue_summary || {
        expected_total: 0,
        realized_total: 0,
        pending_total: 0
    };
    const monthlyIncome = Array.isArray(analytics.monthly_income) ? analytics.monthly_income : [];
    const expectedRevenue = Number(revenueSummary.expected_total || 0);
    const realizedRevenue = Number(revenueSummary.realized_total || 0);
    const pendingRevenue = Number(revenueSummary.pending_total || Math.max(expectedRevenue - realizedRevenue, 0));
    const collectedRate = expectedRevenue > 0 ? Math.round((realizedRevenue / expectedRevenue) * 100) : 0;
    const pieStyle = {
        background: `conic-gradient(#1f9e79 0% ${collectedRate}%, #e0556f ${collectedRate}% 100%)`
    };
    const incomeYearLabel = analytics.year ? ` (${analytics.year})` : '';
    const maxIncome = monthlyIncome.length
        ? Math.max(...monthlyIncome.map((row) => Number(row.total_paid || 0)))
        : 0;

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

            <div className="fee-segmented" role="tablist" aria-label="Fee dashboard views">
                <button
                    type="button"
                    className="fee-segment-btn"
                    data-active={activePanel === 'overview'}
                    onClick={() => handleSegmentChange('overview')}
                >
                    Overview
                </button>
                <button
                    type="button"
                    className="fee-segment-btn"
                    data-active={activePanel === 'due'}
                    onClick={() => handleSegmentChange('due')}
                >
                    Due Monitoring
                </button>
                <button
                    type="button"
                    className="fee-segment-btn"
                    data-active={activePanel === 'income'}
                    onClick={() => handleSegmentChange('income')}
                >
                    Monthly Income
                </button>
            </div>

            {activePanel === 'overview' && (
                <>
                    <div className="fee-stat-grid">
                        <StatCard label="Total Payable" value={formatMoney(summary.total_payable)} accent="primary" />
                        <StatCard label="Total Paid" value={formatMoney(summary.total_paid)} accent="success" />
                        <StatCard label="Total Due" value={formatMoney(summary.total_due)} accent="danger" />
                        <StatCard label="Collection Rate" value={formatRate(summary.collection_rate)} accent="neutral" />
                        <StatCard
                            label="Current Month Payable"
                            value={formatMoney(summary.current_month_payable)}
                            accent="primary"
                        />
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
                                                            style={{
                                                                width: `${Math.min(row.completion_rate || 0, 100)}%`
                                                            }}
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
                                                            Next: {nextUnpaid.due_month_label} (
                                                            {formatMoney(nextUnpaid.amount_due)})
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
                                                                        due.is_paid
                                                                            ? 'fee-badge-paid'
                                                                            : 'fee-badge-unpaid'
                                                                    }`}
                                                                >
                                                                    {due.is_paid ? 'Paid' : 'Unpaid'}
                                                                </span>
                                                            </td>
                                                            <td>{formatMoney(due.amount_due)}</td>
                                                            <td>{formatMoney(due.amount_paid)}</td>
                                                            <td>{due.payment_method || '-'}</td>
                                                            <td>
                                                                {due.payment_date
                                                                    ? new Date(due.payment_date).toLocaleString()
                                                                    : '-'}
                                                            </td>
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
                </>
            )}

            {activePanel === 'due' && (
                <section className="fee-panel fee-panel-due">
                    <header className="fee-panel-header">
                        <div>
                            <p className="fee-kicker">FR-8: Due Monitoring</p>
                            <h3>Outstanding Balance Monitor</h3>
                            <p>Track unpaid dues by student with drill-down views across months and batches.</p>
                        </div>
                        <div className="fee-panel-stat">
                            <span>Global Outstanding Balance</span>
                            <strong>{formatMoney(summary.total_due || dueMonitoring.total_outstanding)}</strong>
                        </div>
                    </header>

                    {dueMonitoring.students.length === 0 ? (
                        <p className="fee-empty">No outstanding balances found.</p>
                    ) : (
                        <div className="fee-table-wrap">
                            <table className="fee-table fee-due-table">
                                <thead>
                                    <tr>
                                        <th>Student</th>
                                        <th>Batches</th>
                                        <th>Total Due</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dueMonitoring.students.map((student) => (
                                        <tr key={student.student_id}>
                                            <td>
                                                <strong>{student.student_name}</strong>
                                            </td>
                                            <td>{formatBatchList(student.batch_list)}</td>
                                            <td>{formatMoney(student.total_due)}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="fee-btn primary small"
                                                    onClick={() => setDueDetails(buildDueDetails(student))}
                                                >
                                                    Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}

            {activePanel === 'income' && (
                <section className="fee-panel fee-panel-income">
                    <header className="fee-panel-header">
                        <div>
                            <p className="fee-kicker">FR-9: Monthly Income</p>
                            <h3>Monthly Income Dashboard</h3>
                            <p>Visualize collections by month and compare expected revenue with realized payments.</p>
                        </div>
                    </header>

                    <div className="fee-income-summary">
                        <article className="fee-income-card">
                            <p>Total Expected Revenue</p>
                            <strong>{formatMoney(expectedRevenue)}</strong>
                            <span>Active enrollments: {analytics.revenue_summary?.active_enrollments || 0}</span>
                        </article>
                        <article className="fee-income-card fee-income-card-secondary">
                            <p>Total Realized Revenue</p>
                            <strong>{formatMoney(realizedRevenue)}</strong>
                            <span>Pending this month: {formatMoney(pendingRevenue)}</span>
                        </article>
                        <article className="fee-income-pie-card">
                            <div className="fee-pie" style={pieStyle}>
                                <div>
                                    <strong>{collectedRate}%</strong>
                                    <span>Collected</span>
                                </div>
                            </div>
                            <div className="fee-pie-legend">
                                <div>
                                    <span className="fee-dot fee-dot-collected" />Collected
                                </div>
                                <div>
                                    <span className="fee-dot fee-dot-pending" />Pending
                                </div>
                            </div>
                        </article>
                    </div>

                    <div className="fee-income-chart-card">
                        <div className="fee-income-chart-header">
                            Total Fees Collected by Month{incomeYearLabel}
                        </div>
                        <div className="fee-income-chart">
                            {monthlyIncome.map((row) => {
                                const amount = Number(row.total_paid || 0);
                                const heightPercent = maxIncome > 0 ? (amount / maxIncome) * 100 : 0;
                                const normalizedHeight = amount > 0 ? Math.max(heightPercent, 6) : 2;
                                return (
                                    <div className="fee-income-bar" key={`${row.month}-${row.label}`}>
                                        <div className="fee-income-bar-track">
                                            <div
                                                className="fee-income-bar-fill"
                                                style={{ height: `${normalizedHeight}%` }}
                                                title={formatMoney(amount)}
                                            />
                                        </div>
                                        <span>{row.label}</span>
                                        <em>{formatMoney(amount)}</em>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {activePanel === 'overview' && selectedDueContext && (
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

            {activePanel === 'due' && dueDetails && (
                <div className="fee-modal-backdrop" onClick={() => setDueDetails(null)} role="presentation">
                    <div
                        className="fee-modal fee-modal-wide"
                        role="dialog"
                        aria-modal="true"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h3>Outstanding Breakdown</h3>
                        <p>{dueDetails.student_name}</p>
                        <p className="fee-modal-due">Total Due: {formatMoney(dueDetails.total_due)}</p>

                        <div className="fee-breakdown-grid">
                            <div className="fee-breakdown-card">
                                <h4>By Month</h4>
                                {dueDetails.months.length === 0 ? (
                                    <p className="fee-empty">No unpaid months found.</p>
                                ) : (
                                    <table className="fee-breakdown-table">
                                        <thead>
                                            <tr>
                                                <th>Month</th>
                                                <th>Amount Due</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dueDetails.months.map((month) => (
                                                <tr key={month.month_key}>
                                                    <td>{month.month_label}</td>
                                                    <td>{formatMoney(month.amount_due)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            <div className="fee-breakdown-card">
                                <h4>By Batch</h4>
                                {dueDetails.batches.length === 0 ? (
                                    <p className="fee-empty">No batch dues found.</p>
                                ) : (
                                    <table className="fee-breakdown-table">
                                        <thead>
                                            <tr>
                                                <th>Batch</th>
                                                <th>Amount Due</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dueDetails.batches.map((batch) => (
                                                <tr key={batch.batch_name}>
                                                    <td>{batch.batch_name}</td>
                                                    <td>{formatMoney(batch.amount_due)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                        <div className="fee-modal-actions">
                            <button type="button" className="fee-btn ghost" onClick={() => setDueDetails(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default FeeManagement;

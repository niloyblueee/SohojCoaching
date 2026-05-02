import { useCallback, useEffect, useState } from 'react';
import '../../FeeDashboard.css';
import { getStudentFeeDashboard } from '../../services/feeApi';

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

function StudentFeeOverview() {
    const [payload, setPayload] = useState({
        summary: null,
        enrollments: []
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [expandedId, setExpandedId] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getStudentFeeDashboard();
            setPayload({
                summary: data.summary || null,
                enrollments: Array.isArray(data.enrollments) ? data.enrollments : []
            });
        } catch (err) {
            setError(err.message || 'Failed to load fee details.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const summary = payload.summary || {
        total_payable: 0,
        total_paid: 0,
        total_due: 0,
        collection_rate: 0,
        active_enrollments: 0,
        paid_months: 0,
        total_generated_months: 0
    };

    return (
        <section className="fee-shell fee-shell-student">
            <header className="fee-header">
                <div>
                    <p className="fee-kicker">FR-7 Student Fee View</p>
                    <h2>My Monthly Fee Dues</h2>
                    <p>Track each month&apos;s payable status, payment progress, and remaining balance.</p>
                </div>
                <div className="fee-header-actions">
                    <button type="button" className="fee-btn ghost" onClick={load}>
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </header>

            {error && <p className="fee-status fee-status-error">{error}</p>}

            <div className="fee-stat-grid">
                <StatCard label="Total Payable" value={formatMoney(summary.total_payable)} accent="primary" />
                <StatCard label="Total Paid" value={formatMoney(summary.total_paid)} accent="success" />
                <StatCard label="Total Due" value={formatMoney(summary.total_due)} accent="danger" />
                <StatCard label="Collection Progress" value={formatRate(summary.collection_rate)} accent="neutral" />
                <StatCard label="Active Enrollments" value={String(summary.active_enrollments)} accent="neutral" />
                <StatCard
                    label="Paid Months"
                    value={`${summary.paid_months}/${summary.total_generated_months}`}
                    accent="neutral"
                />
            </div>

            {payload.enrollments.length === 0 ? (
                <section className="fee-table-wrap">
                    <p className="fee-empty">No active fee dues found for your account yet.</p>
                </section>
            ) : (
                <section className="fee-card-list">
                    {payload.enrollments.map((row) => {
                        const expanded = expandedId === row.enrollment_id;
                        return (
                            <article key={row.enrollment_id} className="fee-enrollment-card">
                                <header>
                                    <div>
                                        <h3>{row.batch_name}</h3>
                                        <p>
                                            Monthly Fee: {formatMoney(row.monthly_fee)} | Due: {formatMoney(row.total_due)}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="fee-btn ghost small"
                                        onClick={() => setExpandedId(expanded ? '' : row.enrollment_id)}
                                    >
                                        {expanded ? 'Hide Months' : 'View Months'}
                                    </button>
                                </header>

                                <div className="fee-progress-meta">
                                    {row.paid_months}/{row.total_generated_months} months paid ({formatRate(row.completion_rate)})
                                </div>
                                <div className="fee-progress-track">
                                    <div
                                        className="fee-progress-fill"
                                        style={{ width: `${Math.min(row.completion_rate || 0, 100)}%` }}
                                    />
                                </div>

                                {expanded && (
                                    <div className="fee-detail-table-wrap">
                                        <table className="fee-detail-table">
                                            <thead>
                                                <tr>
                                                    <th>Month</th>
                                                    <th>Status</th>
                                                    <th>Amount Due</th>
                                                    <th>Amount Paid</th>
                                                    <th>Payment Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {row.dues?.map((due) => (
                                                    <tr key={due.due_id}>
                                                        <td>{due.due_month_label}</td>
                                                        <td>
                                                            <span
                                                                className={`fee-badge ${due.is_paid ? 'fee-badge-paid' : 'fee-badge-unpaid'
                                                                    }`}
                                                            >
                                                                {due.is_paid ? 'Paid' : 'Unpaid'}
                                                            </span>
                                                        </td>
                                                        <td>{formatMoney(due.amount_due)}</td>
                                                        <td>{formatMoney(due.amount_paid)}</td>
                                                        <td>{due.payment_date ? new Date(due.payment_date).toLocaleString() : '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </section>
            )}
        </section>
    );
}

export default StudentFeeOverview;

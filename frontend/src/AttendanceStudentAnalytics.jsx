import { useEffect, useMemo, useState } from 'react';
import { getStudentAttendanceAnalytics } from './services/attendanceApi';
import './AttendanceAnalytics.css';

const LOOKBACK_OPTIONS = [14, 30, 60, 90, 180];

const toPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const statusLabel = (value) => {
    const safe = String(value || '').toLowerCase();
    if (safe === 'present') return 'Present';
    if (safe === 'late') return 'Late';
    if (safe === 'absent') return 'Absent';
    if (safe === 'excused') return 'Excused';
    return 'Unknown';
};

const monthLabel = (key) => {
    const date = new Date(`${key}-01T00:00:00`);
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

const StatCard = ({ label, value, accent }) => (
    <article className={`attendance-stat attendance-stat-${accent}`}>
        <p>{label}</p>
        <h3>{value}</h3>
    </article>
);

function AttendanceStudentAnalytics({ user }) {
    const [days, setDays] = useState(60);
    const [batchId, setBatchId] = useState('');
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            setError('');

            try {
                const payload = await getStudentAttendanceAnalytics({
                    batch_id: batchId || undefined,
                    days
                });

                setAnalytics(payload);
            } catch (err) {
                setError(err.message || 'Failed to load attendance analytics.');
                setAnalytics(null);
            } finally {
                setLoading(false);
            }
        };

        run();
    }, [batchId, days]);

    useEffect(() => {
        if (!analytics) return;

        const availableBatches = analytics.available_batches || [];
        if (batchId && !availableBatches.some((batch) => batch.id === batchId)) {
            setBatchId('');
        }
    }, [analytics, batchId]);

    const summary = analytics?.summary || {
        attendance_rate: 0,
        attended_count: 0,
        absent_count: 0,
        total_sessions: 0,
        late_count: 0
    };

    const availableBatches = useMemo(() => analytics?.available_batches ?? [], [analytics]);
    const courseWise = useMemo(() => analytics?.course_wise ?? [], [analytics]);
    const trend = useMemo(() => analytics?.trend ?? [], [analytics]);

    const monthlyConsistency = useMemo(() => {
        const grouped = new Map();

        trend.forEach((entry) => {
            const key = entry.session_date.slice(0, 7);
            const current = grouped.get(key) || { attended: 0, total: 0 };
            current.attended += Number(entry.attended_flag || 0);
            current.total += 1;
            grouped.set(key, current);
        });

        return Array.from(grouped.entries()).map(([key, value]) => {
            const rate = value.total > 0 ? (value.attended / value.total) * 100 : 0;
            return {
                key,
                rate: Number(rate.toFixed(2)),
                attended: value.attended,
                total: value.total
            };
        });
    }, [trend]);

    const recentTrend = useMemo(() => trend.slice(-30), [trend]);

    return (
        <section className="attendance-shell attendance-shell-student">
            <header className="attendance-header">
                <h2>My Attendance Analytics</h2>
                <p>
                    {user?.name || 'Student'} - track your consistency by course and monitor recent attendance sessions.
                </p>
            </header>

            <div className="attendance-panel attendance-filters">
                <div className="attendance-field">
                    <label>Course / Batch</label>
                    <select value={batchId} onChange={(event) => setBatchId(event.target.value)}>
                        <option value="">All my courses</option>
                        {availableBatches.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                                {batch.batch_name} - {batch.course}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="attendance-field">
                    <label>Lookback window</label>
                    <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
                        {LOOKBACK_OPTIONS.map((value) => (
                            <option key={value} value={value}>
                                Last {value} days
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loading && <p className="attendance-status">Loading attendance analytics...</p>}
            {!loading && error && <p className="attendance-status attendance-status-error">{error}</p>}

            <div className="attendance-stat-grid">
                <StatCard label="Overall Attendance" value={toPercent(summary.attendance_rate)} accent="primary" />
                <StatCard label="Classes Attended" value={String(summary.attended_count)} accent="success" />
                <StatCard label="Classes Missed" value={String(summary.absent_count)} accent="danger" />
                <StatCard label="Sessions Marked" value={String(summary.total_sessions)} accent="neutral" />
            </div>

            <div className="attendance-grid-two">
                <article className="attendance-panel">
                    <h3>Course-wise Attendance</h3>
                    {courseWise.length === 0 ? (
                        <p className="attendance-empty">No course attendance rows available for this period.</p>
                    ) : (
                        <div className="attendance-bar-chart">
                            {courseWise.map((course) => (
                                <div key={course.batch_id} className="attendance-bar-item">
                                    <div className="attendance-bar-head">
                                        <span>{course.batch_name}</span>
                                        <strong>{toPercent(course.attendance_rate)}</strong>
                                    </div>
                                    <div className="attendance-bar-track">
                                        <div
                                            className="attendance-bar-fill attendance-bar-fill-student"
                                            style={{ width: `${Math.min(100, course.attendance_rate)}%` }}
                                        />
                                    </div>
                                    <small>
                                        Present/Late: {course.attended_count} | Absent: {course.absent_count} | Sessions: {course.total_sessions}
                                    </small>
                                </div>
                            ))}
                        </div>
                    )}
                </article>

                <article className="attendance-panel">
                    <h3>Monthly Consistency</h3>
                    {monthlyConsistency.length === 0 ? (
                        <p className="attendance-empty">No monthly consistency data yet.</p>
                    ) : (
                        <div className="attendance-month-bars">
                            {monthlyConsistency.map((item) => (
                                <div key={item.key} className="attendance-month-bar-item">
                                    <div className="attendance-month-meta">
                                        <span>{monthLabel(item.key)}</span>
                                        <strong>{toPercent(item.rate)}</strong>
                                    </div>
                                    <div className="attendance-month-track">
                                        <div className="attendance-month-fill" style={{ width: `${Math.min(100, item.rate)}%` }} />
                                    </div>
                                    <small>
                                        Attended {item.attended} of {item.total} sessions
                                    </small>
                                </div>
                            ))}
                        </div>
                    )}
                </article>
            </div>

            <article className="attendance-panel">
                <h3>Recent Session Timeline</h3>

                {recentTrend.length === 0 ? (
                    <p className="attendance-empty">No recent timeline data available.</p>
                ) : (
                    <>
                        <div className="attendance-session-strips" role="img" aria-label="Recent session attendance strip chart">
                            {recentTrend.map((entry, index) => (
                                <span
                                    key={`${entry.session_date}-${index}`}
                                    className={`attendance-strip attendance-strip-${entry.status}`}
                                    title={`${entry.session_date} - ${entry.batch_name} - ${statusLabel(entry.status)}`}
                                />
                            ))}
                        </div>

                        <div className="attendance-table-wrap">
                            <table className="attendance-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Course</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTrend
                                        .slice()
                                        .reverse()
                                        .map((entry, index) => (
                                            <tr key={`${entry.session_date}-row-${index}`}>
                                                <td>{entry.session_date}</td>
                                                <td>{entry.batch_name}</td>
                                                <td>
                                                    <span className={`attendance-badge attendance-badge-${entry.status}`}>
                                                        {statusLabel(entry.status)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </article>
        </section>
    );
}

export default AttendanceStudentAnalytics;

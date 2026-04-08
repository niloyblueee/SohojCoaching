import { useEffect, useMemo, useState } from 'react';
import { getTeacherAttendanceAnalytics } from './services/attendanceApi';
import './AttendanceAnalytics.css';

const LOOKBACK_OPTIONS = [14, 30, 60, 90, 180];

const toPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const humanDate = (value) => {
    const date = new Date(`${value}T00:00:00`);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const StatCard = ({ label, value, accent }) => (
    <article className={`attendance-stat attendance-stat-${accent}`}>
        <p>{label}</p>
        <h3>{value}</h3>
    </article>
);

const RateTrendChart = ({ points }) => {
    if (!points.length) {
        return <p className="attendance-empty">No attendance trend available for this filter.</p>;
    }

    const width = 720;
    const height = 230;
    const top = 20;
    const bottom = 34;
    const left = 24;
    const right = 18;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;

    const polyline = points
        .map((point, index) => {
            const x = left + (chartWidth * index) / Math.max(points.length - 1, 1);
            const y = top + ((100 - point.attendance_rate) / 100) * chartHeight;
            return `${x},${y}`;
        })
        .join(' ');

    const markerIndexes = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter(
        (value, index, source) => source.indexOf(value) === index && value >= 0
    );

    return (
        <div className="attendance-trend-wrap">
            <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Attendance trend chart" className="attendance-trend-svg">
                <line x1={left} y1={top} x2={left} y2={height - bottom} className="attendance-axis" />
                <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="attendance-axis" />

                {[20, 40, 60, 80].map((rate) => {
                    const y = top + ((100 - rate) / 100) * chartHeight;
                    return (
                        <g key={rate}>
                            <line x1={left} y1={y} x2={width - right} y2={y} className="attendance-grid-line" />
                            <text x={6} y={y + 4} className="attendance-grid-label">{rate}%</text>
                        </g>
                    );
                })}

                <polyline className="attendance-trend-line" points={polyline} />

                {points.map((point, index) => {
                    const x = left + (chartWidth * index) / Math.max(points.length - 1, 1);
                    const y = top + ((100 - point.attendance_rate) / 100) * chartHeight;
                    return <circle key={`${point.session_date}-${index}`} cx={x} cy={y} r="3" className="attendance-trend-point" />;
                })}

                {markerIndexes.map((index) => {
                    const point = points[index];
                    const x = left + (chartWidth * index) / Math.max(points.length - 1, 1);
                    return (
                        <text key={`label-${point.session_date}`} x={x} y={height - 10} textAnchor="middle" className="attendance-x-label">
                            {humanDate(point.session_date)}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
};

function AttendanceTeacherAnalytics() {
    const [days, setDays] = useState(60);
    const [batchId, setBatchId] = useState('');
    const [studentId, setStudentId] = useState('');
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            setError('');

            try {
                const payload = await getTeacherAttendanceAnalytics({
                    batch_id: batchId || undefined,
                    student_id: studentId || undefined,
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
    }, [batchId, studentId, days]);

    useEffect(() => {
        if (!analytics) return;

        const availableBatches = analytics.available_batches || [];
        const availableStudents = analytics.available_students || [];

        if (batchId && !availableBatches.some((batch) => batch.id === batchId)) {
            setBatchId('');
        }

        if (studentId && !availableStudents.some((student) => student.id === studentId)) {
            setStudentId('');
        }
    }, [analytics, batchId, studentId]);

    const summary = analytics?.summary || {
        attendance_rate: 0,
        attended_count: 0,
        absent_count: 0,
        total_sessions: 0
    };

    const courseWise = analytics?.course_wise || [];
    const studentWise = analytics?.student_wise || [];
    const trend = analytics?.trend || [];
    const availableBatches = analytics?.available_batches || [];
    const availableStudents = analytics?.available_students || [];

    const topCourse = useMemo(() => {
        if (!courseWise.length) return null;
        return courseWise.reduce((best, row) => {
            if (!best || row.attendance_rate > best.attendance_rate) return row;
            return best;
        }, null);
    }, [courseWise]);

    const topStudent = useMemo(() => {
        if (!studentWise.length) return null;
        return studentWise.reduce((best, row) => {
            if (!best || row.attendance_rate > best.attendance_rate) return row;
            return best;
        }, null);
    }, [studentWise]);

    return (
        <section className="attendance-shell attendance-shell-teacher">
            <header className="attendance-header">
                <h2>Attendance Analytics</h2>
                <p>
                    Course-wise and student-wise attendance health across your assigned classes.
                </p>
            </header>

            <div className="attendance-panel attendance-filters">
                <div className="attendance-field">
                    <label>Batch</label>
                    <select value={batchId} onChange={(event) => setBatchId(event.target.value)}>
                        <option value="">All accessible batches</option>
                        {availableBatches.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                                {batch.batch_name} - {batch.course}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="attendance-field">
                    <label>Student</label>
                    <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
                        <option value="">All students</option>
                        {availableStudents.map((student) => (
                            <option key={student.id} value={student.id}>
                                {student.name}
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
                <StatCard label="Present/Late Marks" value={String(summary.attended_count)} accent="success" />
                <StatCard label="Absent Marks" value={String(summary.absent_count)} accent="danger" />
                <StatCard label="Class Sessions" value={String(summary.total_sessions)} accent="neutral" />
            </div>

            <div className="attendance-grid-two">
                <article className="attendance-panel">
                    <h3>Course-wise Performance</h3>
                    {courseWise.length === 0 ? (
                        <p className="attendance-empty">No attendance rows for this selection.</p>
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
                                            className="attendance-bar-fill attendance-bar-fill-teacher"
                                            style={{ width: `${Math.min(100, course.attendance_rate)}%` }}
                                        />
                                    </div>
                                    <small>
                                        Attended: {course.attended_count} | Absent: {course.absent_count} | Sessions: {course.total_sessions}
                                    </small>
                                </div>
                            ))}
                        </div>
                    )}

                    {topCourse && (
                        <p className="attendance-highlight">
                            Best course right now: <strong>{topCourse.batch_name}</strong> at {toPercent(topCourse.attendance_rate)}.
                        </p>
                    )}
                </article>

                <article className="attendance-panel">
                    <h3>Attendance Trend</h3>
                    <RateTrendChart points={trend} />
                </article>
            </div>

            <article className="attendance-panel">
                <h3>Student-wise Breakdown</h3>

                {studentWise.length === 0 ? (
                    <p className="attendance-empty">No student-wise rows for this filter.</p>
                ) : (
                    <div className="attendance-table-wrap">
                        <table className="attendance-table">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Attendance Rate</th>
                                    <th>Present/Late</th>
                                    <th>Absent</th>
                                    <th>Late</th>
                                </tr>
                            </thead>
                            <tbody>
                                {studentWise.map((student) => (
                                    <tr key={student.student_id}>
                                        <td>{student.student_name}</td>
                                        <td>{toPercent(student.attendance_rate)}</td>
                                        <td>{student.attended_count}</td>
                                        <td>{student.absent_count}</td>
                                        <td>{student.late_count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {topStudent && (
                    <p className="attendance-highlight">
                        Top student in current scope: <strong>{topStudent.student_name}</strong> with {toPercent(topStudent.attendance_rate)}.
                    </p>
                )}
            </article>
        </section>
    );
}

export default AttendanceTeacherAnalytics;

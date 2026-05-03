import { useCallback, useEffect, useMemo, useState } from 'react';
import { getBatchStudentCounts } from './services/batchApi';
import './BatchStudentCount.css';

const DEFAULT_CAPACITY_LIMIT = 30;

function BatchStudentCountPage() {
    const [payload, setPayload] = useState({
        summary: {
            total_batches: 0,
            total_active_students: 0
        },
        batches: []
    });
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const loadCounts = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        setStatus('');

        try {
            const data = await getBatchStudentCounts();
            setPayload({
                summary: data.summary || { total_batches: 0, total_active_students: 0 },
                batches: Array.isArray(data.batches) ? data.batches : []
            });
        } catch (error) {
            setStatus(error.message || 'Failed to load batch-wise student counts.');
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCounts();
    }, [loadCounts]);

    useEffect(() => {
        const handleRefresh = () => loadCounts({ silent: true });
        window.addEventListener('enrollment-changed', handleRefresh);
        window.addEventListener('focus', handleRefresh);
        return () => {
            window.removeEventListener('enrollment-changed', handleRefresh);
            window.removeEventListener('focus', handleRefresh);
        };
    }, [loadCounts]);

    const maxStudents = useMemo(() => {
        if (!payload.batches.length) return 1;
        return Math.max(1, ...payload.batches.map((row) => Number(row.student_count || 0)));
    }, [payload.batches]);

    return (
        <section className="batch-count-page">
            <header className="batch-count-header">
                <div>
                    <p className="batch-count-kicker">FR-24: Batch-wise Student Count</p>
                    <h2>Batch-wise Student Count</h2>
                    <p className="batch-count-sub">
                        Monitor active student distribution by batch and compare capacity health at a glance.
                    </p>
                </div>
                <button type="button" className="batch-count-refresh" onClick={() => loadCounts()} disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </header>

            <div className="batch-count-cards">
                <article className="batch-count-card">
                    <p>Total Batches</p>
                    <strong>{payload.summary.total_batches || 0}</strong>
                </article>
                <article className="batch-count-card">
                    <p>Total Active Students</p>
                    <strong>{payload.summary.total_active_students || 0}</strong>
                </article>
                <article className="batch-count-card batch-count-card-accent">
                    <p>Default Capacity Limit</p>
                    <strong>{DEFAULT_CAPACITY_LIMIT}</strong>
                </article>
            </div>

            <section className="batch-count-panel">
                <h3>Active Students by Batch</h3>
                {status && <p className="batch-count-status">{status}</p>}
                {!status && loading && <p className="batch-count-status">Loading batch counts...</p>}
                {!loading && !status && payload.batches.length === 0 && (
                    <p className="batch-count-status">No batch data available.</p>
                )}

                {!status && payload.batches.length > 0 && (
                    <div className="batch-count-chart">
                        {payload.batches.map((row) => {
                            const studentCount = Number(row.student_count || 0);
                            const widthPercent = Math.round((studentCount / maxStudents) * 100);
                            const fillWidth = studentCount > 0 ? Math.max(widthPercent, 6) : 2;
                            return (
                                <div className="batch-count-row" key={row.batch_id}>
                                    <div className="batch-count-label">
                                        <span>{row.batch_name}</span>
                                    </div>
                                    <div className="batch-count-bar">
                                        <div className="batch-count-bar-fill" style={{ width: `${fillWidth}%` }} />
                                    </div>
                                    <div className="batch-count-value">{studentCount}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="batch-count-panel">
                <h3>Batch Capacity Table</h3>
                {!status && payload.batches.length > 0 && (
                    <div className="batch-count-table-wrap">
                        <table className="batch-count-table">
                            <thead>
                                <tr>
                                    <th>Batch Name</th>
                                    <th>Active Students</th>
                                    <th>Capacity Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payload.batches.map((row) => {
                                    const studentCount = Number(row.student_count || 0);
                                    const isFull = studentCount >= DEFAULT_CAPACITY_LIMIT;
                                    return (
                                        <tr key={`${row.batch_id}-table`}>
                                            <td>{row.batch_name}</td>
                                            <td>{studentCount}</td>
                                            <td>
                                                <span
                                                    className={`batch-count-pill ${
                                                        isFull ? 'batch-count-pill-full' : 'batch-count-pill-open'
                                                    }`}
                                                >
                                                    {isFull ? 'Full' : 'Open'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </section>
    );
}

export default BatchStudentCountPage;

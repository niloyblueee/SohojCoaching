import { useEffect, useState } from 'react';
import { getBatchOverview } from './services/batchApi';
import './BatchOverview.css';

function BatchOverviewPage() {
    const [overview, setOverview] = useState({
        summary: {
            total_batches: 0,
            total_students: 0,
            overall_attendance_rate: 0,
            overall_fee_collection_rate: 0
        },
        batches: []
    });
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const loadOverview = async () => {
        setLoading(true);
        setStatus('');

        try {
            const data = await getBatchOverview();
            setOverview({
                summary: data.summary || {
                    total_batches: 0,
                    total_students: 0,
                    overall_attendance_rate: 0,
                    overall_fee_collection_rate: 0
                },
                batches: data.batches || []
            });
        } catch (error) {
            setStatus(error.message || 'Failed to load batch overview.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOverview();
    }, []);

    return (
        <section className="batch-overview-page">
            <header className="batch-overview-header">
                <div>
                    <p className="batch-overview-kicker">FR-5: Batch Overview</p>
                    <h2>Batch Overview</h2>
                    <p className="batch-overview-sub">
                        See per-batch student totals, attendance performance, and fee collection health.
                    </p>
                </div>
                <button type="button" className="batch-overview-refresh" onClick={loadOverview} disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </header>

            <div className="batch-overview-cards">
                <article className="batch-overview-card">
                    <p>Total Batches</p>
                    <strong>{overview.summary.total_batches || 0}</strong>
                </article>

                <article className="batch-overview-card">
                    <p>Total Students</p>
                    <strong>{overview.summary.total_students || 0}</strong>
                </article>

                <article className="batch-overview-card">
                    <p>Overall Attendance Rate</p>
                    <strong>{Number(overview.summary.overall_attendance_rate || 0).toFixed(2)}%</strong>
                </article>

                <article className="batch-overview-card">
                    <p>Overall Fee Collection</p>
                    <strong>{Number(overview.summary.overall_fee_collection_rate || 0).toFixed(2)}%</strong>
                </article>
            </div>

            <section className="batch-overview-table-wrap">
                {status && <p className="batch-overview-status">{status}</p>}
                {!status && loading && <p className="batch-overview-status">Loading batch overview...</p>}

                {!loading && !status && overview.batches.length === 0 && (
                    <p className="batch-overview-status">No batch overview data available.</p>
                )}

                {!status && overview.batches.length > 0 && (
                    <table className="batch-overview-table">
                        <thead>
                            <tr>
                                <th>Batch</th>
                                <th>Course</th>
                                <th>Teachers</th>
                                <th>Total Students</th>
                                <th>Attendance Rate</th>
                                <th>Fee Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overview.batches.map((batch) => (
                                <tr key={batch.id}>
                                    <td>{batch.batch_name}</td>
                                    <td>{batch.course}</td>
                                    <td>{batch.teacher_count ?? 0}</td>
                                    <td>{batch.total_students}</td>
                                    <td>{Number(batch.attendance_rate || 0).toFixed(2)}%</td>
                                    <td>{batch.fee_status || 'No dues yet'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </section>
    );
}

export default BatchOverviewPage;

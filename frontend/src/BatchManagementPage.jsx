import { useEffect, useMemo, useState } from 'react';
import BatchList from './components/batches/BatchList';
import CreateBatchModal from './components/batches/CreateBatchModal';
import EditBatchModal from './components/batches/EditBatchModal';
import {
    createBatch,
    deleteBatch,
    getBatches,
    getTeachers,
    updateBatch
} from './services/batchApi';
import './BatchManagement.css';

function BatchManagementPage() {
    const [batches, setBatches] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [search, setSearch] = useState('');
    const [sortOrder, setSortOrder] = useState('desc');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingBatch, setEditingBatch] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const studentTotal = useMemo(
        () => batches.reduce((sum, batch) => sum + Number(batch.student_count || 0), 0),
        [batches]
    );

    const loadPageData = async () => {
        setLoading(true);
        setStatus('');
        try {
            const [batchData, teacherData] = await Promise.all([
                getBatches({ search, sortBy: 'student_count', sortOrder }),
                getTeachers()
            ]);
            setBatches(batchData);
            setTeachers(teacherData);
        } catch (error) {
            setStatus(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPageData();
    }, [search, sortOrder]);

    const handleCreateBatch = async (payload) => {
        await createBatch(payload);
        setShowCreateModal(false);
        await loadPageData();
        setStatus('Batch created successfully.');
    };

    const handleUpdateBatch = async (id, payload) => {
        await updateBatch(id, payload);
        setEditingBatch(null);
        await loadPageData();
        setStatus('Batch updated successfully.');
    };

    const handleDeleteBatch = async (batch) => {
        const confirmed = window.confirm(`Delete batch "${batch.batch_name}"? This will also remove related enrollments, assignments, and scripts.`);
        if (!confirmed) return;

        try {
            await deleteBatch(batch.id);
            await loadPageData();
            setStatus('Batch deleted successfully.');
        } catch (error) {
            setStatus(error.message);
        }
    };

    return (
        <section className="batch-page">
            <header className="batch-page-header">
                <div>
                    <p className="batch-kicker">FR-3: Batch Creation & Configuration</p>
                    <h2>Batch Management</h2>
                    <p>Create, configure, and maintain batches for enrollment workflows.</p>
                </div>
                <button type="button" className="batch-btn primary" onClick={() => setShowCreateModal(true)}>
                    + Create Batch
                </button>
            </header>

            <div className="batch-layout">
                <aside className="batch-sidebar">
                    <h3>Controls</h3>
                    <label htmlFor="batch-search">Search by batch name</label>
                    <input
                        id="batch-search"
                        type="text"
                        placeholder="Type batch name..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />

                    <label htmlFor="sort-order">Sort by student count</label>
                    <select id="sort-order" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                        <option value="desc">Highest first</option>
                        <option value="asc">Lowest first</option>
                    </select>

                    <div className="batch-stat-card">
                        <p>Total Batches</p>
                        <strong>{batches.length}</strong>
                    </div>

                    <div className="batch-stat-card">
                        <p>Total Enrollments</p>
                        <strong>{studentTotal}</strong>
                    </div>
                </aside>

                <main className="batch-main">
                    {loading && <p className="batch-feedback">Loading batch data...</p>}
                    {!loading && status && <p className="batch-feedback">{status}</p>}
                    <BatchList batches={batches} onEdit={setEditingBatch} onDelete={handleDeleteBatch} />
                </main>
            </div>

            <CreateBatchModal
                open={showCreateModal}
                teachers={teachers}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreateBatch}
            />

            <EditBatchModal
                open={Boolean(editingBatch)}
                teachers={teachers}
                batch={editingBatch}
                onClose={() => setEditingBatch(null)}
                onSubmit={handleUpdateBatch}
            />
        </section>
    );
}

export default BatchManagementPage;

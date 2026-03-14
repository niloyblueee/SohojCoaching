function BatchCard({ batch, onEdit, onDelete }) {
    return (
        <article className="batch-card">
            <header className="batch-card-header">
                <h3>{batch.batch_name}</h3>
                <span className="batch-pill">{batch.student_count} students</span>
            </header>

            <div className="batch-meta">
                <p><strong>Subject:</strong> {batch.subject}</p>
                <p><strong>Schedule:</strong> {batch.schedule || 'Not set'}</p>
                <p><strong>Monthly Fee:</strong> BDT {Number(batch.monthly_fee || 0).toFixed(2)}</p>
                <p><strong>Teacher:</strong> {batch.teacher_name || 'Unassigned'}</p>
            </div>

            <footer className="batch-actions">
                <button type="button" className="batch-btn ghost" onClick={() => onEdit(batch)}>Edit</button>
                <button type="button" className="batch-btn danger" onClick={() => onDelete(batch)}>Delete</button>
            </footer>
        </article>
    );
}

export default BatchCard;

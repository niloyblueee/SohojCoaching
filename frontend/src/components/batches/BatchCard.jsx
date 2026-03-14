function BatchCard({ batch, onEdit, onDelete }) {
    const normalPrice = Number(batch.monthly_fee || 0);
    const discountedPrice =
        batch.discounted_fee === null || batch.discounted_fee === undefined
            ? null
            : Number(batch.discounted_fee);
    const hasDiscount = discountedPrice !== null && discountedPrice < normalPrice;

    return (
        <article className="batch-card">
            <header className="batch-card-header">
                <h3>{batch.batch_name}</h3>
                <span className="batch-pill">{batch.student_count} students</span>
            </header>

            <div className="batch-meta">
                <p><strong>Subject:</strong> {batch.subject}</p>
                <p><strong>Duration:</strong> {batch.batch_duration || 'Not set'}</p>
                <p><strong>Schedule:</strong> {batch.schedule || 'Not set'}</p>
                <p>
                    <strong>Price:</strong> BDT {normalPrice.toFixed(2)}
                    {hasDiscount && <span className="batch-discount"> {'->'} BDT {discountedPrice.toFixed(2)}</span>}
                </p>
                <p><strong>Teacher:</strong> {batch.teacher_name || 'Unassigned'}</p>
                {batch.description && <p><strong>Description:</strong> {batch.description}</p>}
            </div>

            {Array.isArray(batch.weekly_routine) && batch.weekly_routine.length > 0 && (
                <div className="batch-routine">
                    <p><strong>Weekly Routine</strong></p>
                    <ul>
                        {batch.weekly_routine.map((slot, index) => (
                            <li key={`${batch.id}-slot-${index}`}>
                                {slot.day}: {slot.subject} at {slot.time}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <footer className="batch-actions">
                <button type="button" className="batch-btn ghost" onClick={() => onEdit(batch)}>Edit</button>
                <button type="button" className="batch-btn danger" onClick={() => onDelete(batch)}>Delete</button>
            </footer>
        </article>
    );
}

export default BatchCard;

import BatchCard from './BatchCard';

function BatchList({ batches, onEdit, onDelete }) {
    if (!batches.length) {
        return <p className="batch-empty">No batches found for current filter.</p>;
    }

    return (
        <div className="batch-list-grid">
            {batches.map((batch) => (
                <BatchCard key={batch.id} batch={batch} onEdit={onEdit} onDelete={onDelete} />
            ))}
        </div>
    );
}

export default BatchList;

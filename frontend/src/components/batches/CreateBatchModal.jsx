import { useMemo, useState } from 'react';

const initialState = {
    batch_name: '',
    subject: '',
    schedule: '',
    monthly_fee: '',
    teacher_id: ''
};

function CreateBatchModal({ open, teachers, onClose, onSubmit }) {
    const [form, setForm] = useState(initialState);
    const [error, setError] = useState('');

    const submitPayload = useMemo(() => ({
        ...form,
        monthly_fee: Number(form.monthly_fee),
        teacher_id: form.teacher_id || null
    }), [form]);

    if (!open) return null;

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (!form.batch_name.trim()) return setError('Batch name is required.');
        if (!form.subject.trim()) return setError('Subject is required.');
        if (!form.schedule.trim()) return setError('Schedule cannot be empty.');
        if (!form.monthly_fee || Number(form.monthly_fee) < 0) return setError('Monthly fee must be positive or zero.');

        try {
            await onSubmit(submitPayload);
            setForm(initialState);
        } catch (err) {
            setError(err.message || 'Unable to create batch.');
        }
    };

    return (
        <div className="batch-modal-backdrop" role="dialog" aria-modal="true" aria-label="Create batch modal">
            <div className="batch-modal">
                <h3>Create Batch</h3>
                <form className="batch-form" onSubmit={handleSubmit}>
                    <input name="batch_name" placeholder="Batch Name" value={form.batch_name} onChange={handleChange} />
                    <input name="subject" placeholder="Subject" value={form.subject} onChange={handleChange} />
                    <input name="schedule" placeholder="Schedule" value={form.schedule} onChange={handleChange} />
                    <input name="monthly_fee" type="number" min="0" step="0.01" placeholder="Monthly Fee" value={form.monthly_fee} onChange={handleChange} />
                    <select name="teacher_id" value={form.teacher_id} onChange={handleChange}>
                        <option value="">-- Assign Teacher (optional) --</option>
                        {teachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                        ))}
                    </select>

                    {error && <p className="batch-form-error">{error}</p>}

                    <div className="batch-modal-actions">
                        <button type="button" className="batch-btn ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="batch-btn primary">Create</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CreateBatchModal;

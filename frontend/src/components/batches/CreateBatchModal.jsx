import { useMemo, useState } from 'react';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const initialState = {
    batch_name: '',
    subject: '',
    schedule: '',
    monthly_fee: '',
    discounted_fee: '',
    batch_duration: '',
    description: '',
    weekly_routine: [{ day: '', subject: '', time: '' }],
    teacher_id: ''
};

function CreateBatchModal({ open, teachers, onClose, onSubmit }) {
    const [form, setForm] = useState(initialState);
    const [error, setError] = useState('');

    const submitPayload = useMemo(() => ({
        ...form,
        monthly_fee: Number(form.monthly_fee),
        discounted_fee:
            form.discounted_fee === '' || form.discounted_fee === null
                ? null
                : Number(form.discounted_fee),
        weekly_routine: form.weekly_routine
            .map((entry) => ({
                day: String(entry.day || '').trim(),
                subject: String(entry.subject || '').trim(),
                time: String(entry.time || '').trim()
            }))
            .filter((entry) => entry.day && entry.subject && entry.time),
        teacher_id: form.teacher_id || null
    }), [form]);

    if (!open) return null;

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleRoutineChange = (index, key, value) => {
        setForm((prev) => ({
            ...prev,
            weekly_routine: prev.weekly_routine.map((entry, idx) =>
                idx === index ? { ...entry, [key]: value } : entry
            )
        }));
    };

    const addRoutineRow = () => {
        setForm((prev) => ({
            ...prev,
            weekly_routine: [...prev.weekly_routine, { day: '', subject: '', time: '' }]
        }));
    };

    const removeRoutineRow = (index) => {
        setForm((prev) => ({
            ...prev,
            weekly_routine: prev.weekly_routine.filter((_, idx) => idx !== index)
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (!form.batch_name.trim()) return setError('Batch name is required.');
        if (!form.subject.trim()) return setError('Subject is required.');
        if (!form.monthly_fee || Number(form.monthly_fee) < 0) return setError('Monthly fee must be positive or zero.');
        if (!form.batch_duration.trim()) return setError('Batch duration is required.');
        if (form.discounted_fee !== '' && Number(form.discounted_fee) < 0) return setError('Discounted fee must be positive or zero.');
        if (form.discounted_fee !== '' && Number(form.discounted_fee) > Number(form.monthly_fee)) {
            return setError('Discounted fee cannot be greater than normal price.');
        }

        const hasCompleteRoutine = submitPayload.weekly_routine.length > 0;
        if (!hasCompleteRoutine) {
            return setError('Add at least one complete weekly routine row (day, subject, time).');
        }

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
                    <input name="batch_duration" placeholder="Batch Duration (e.g. 6 months)" value={form.batch_duration} onChange={handleChange} />
                    <input name="schedule" placeholder="Schedule Note (optional)" value={form.schedule} onChange={handleChange} />
                    <input name="monthly_fee" type="number" min="0" step="0.01" placeholder="Normal Price (BDT)" value={form.monthly_fee} onChange={handleChange} />
                    <input
                        name="discounted_fee"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Discounted Price (BDT, optional)"
                        value={form.discounted_fee}
                        onChange={handleChange}
                    />
                    <select name="teacher_id" value={form.teacher_id} onChange={handleChange}>
                        <option value="">-- Assign Teacher (optional) --</option>
                        {teachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                        ))}
                    </select>
                    <textarea
                        name="description"
                        placeholder="Batch Description (optional)"
                        rows={3}
                        value={form.description}
                        onChange={handleChange}
                    />

                    <div className="routine-section">
                        <div className="routine-header">
                            <p>Weekly Routine</p>
                            <button type="button" className="batch-btn ghost" onClick={addRoutineRow}>+ Add Slot</button>
                        </div>
                        {form.weekly_routine.map((entry, index) => (
                            <div className="routine-row" key={`new-routine-${index}`}>
                                <select
                                    value={entry.day}
                                    onChange={(event) => handleRoutineChange(index, 'day', event.target.value)}
                                >
                                    <option value="">Day</option>
                                    {DAYS.map((day) => (
                                        <option key={day} value={day}>{day}</option>
                                    ))}
                                </select>
                                <input
                                    value={entry.subject}
                                    onChange={(event) => handleRoutineChange(index, 'subject', event.target.value)}
                                    placeholder="Subject"
                                />
                                <input
                                    type="time"
                                    value={entry.time}
                                    onChange={(event) => handleRoutineChange(index, 'time', event.target.value)}
                                />
                                <button
                                    type="button"
                                    className="batch-btn danger"
                                    onClick={() => removeRoutineRow(index)}
                                    disabled={form.weekly_routine.length === 1}
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>

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

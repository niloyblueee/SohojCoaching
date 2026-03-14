import { useEffect, useMemo, useState } from 'react';
import './Login.css';
import { login } from './services/authApi';

function Login({ onAuthSuccess }) {
    const loginTypes = useMemo(
        () => [
            {
                id: 'student',
                tabLabel: 'Student Login',
                heading: 'Student Portal',
                subtitle: 'Track lessons, assignments, and coaching updates in one place.',
                note: 'Daily progress, quiz alerts, and study reminders are waiting for you.',
                buttonText: 'Login as Student',
                badge: 'ST',
                motifs: ['Curiosity', 'Learning', 'Explore'],
            },
            {
                id: 'teacher',
                tabLabel: 'Teacher Login',
                heading: 'Teacher Workspace',
                subtitle: 'Manage class materials, attendance, and student feedback with speed.',
                note: 'Publish notes and mark scripts with a focused command center.',
                buttonText: 'Login as Teacher',
                badge: 'TC',
                motifs: ['Discipline', 'Care', 'Teaching'],
            },
            {
                id: 'admin',
                tabLabel: 'Admin Login',
                heading: 'Admin Control Room',
                subtitle: 'Monitor operations, users, and institute performance in real time.',
                note: 'Permissions, schedules, and system insights at your fingertips.',
                buttonText: 'Login as Admin',
                badge: 'AD',
                motifs: ['Control', 'System', 'Oversight'],
            },
        ],
        [],
    );

    const [selectedType, setSelectedType] = useState('student');
    const [authMode, setAuthMode] = useState('login');
    const [formValues, setFormValues] = useState({
        fullName: '',
        email: '',
        classLevel: '',
        subject: '',
        password: '',
        confirmPassword: ''
    });
    const [status, setStatus] = useState('');
    const [statusType, setStatusType] = useState('neutral');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const activeType = loginTypes.find((type) => type.id === selectedType) || loginTypes[0];
    const supportsSignup = selectedType === 'student' || selectedType === 'teacher';
    const isSignup = supportsSignup && authMode === 'signup';

    useEffect(() => {
        if (!supportsSignup && authMode === 'signup') {
            setAuthMode('login');
        }
    }, [authMode, supportsSignup]);

    useEffect(() => {
        setStatus('');
        setStatusType('neutral');
    }, [selectedType, authMode]);

    const onFieldChange = (event) => {
        const { id, value } = event.target;
        setFormValues((prev) => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setStatus('');

        if (!formValues.email.trim() || !formValues.password.trim()) {
            setStatusType('error');
            setStatus('Email and password are required.');
            return;
        }

        if (isSignup) {
            if (!formValues.fullName.trim()) {
                setStatusType('error');
                setStatus('Full Name is required for sign up.');
                return;
            }
            if (formValues.password !== formValues.confirmPassword) {
                setStatusType('error');
                setStatus('Password and Confirm Password do not match.');
                return;
            }

            setStatusType('info');
            setStatus('Signup UI is ready. Backend signup endpoint is not connected yet.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = await login({
                role: selectedType,
                email: formValues.email.trim(),
                password: formValues.password
            });

            if (typeof onAuthSuccess === 'function') {
                onAuthSuccess(payload);
            }
        } catch (error) {
            setStatusType('error');
            setStatus(error.message || 'Unable to login right now.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className={`login-shell role-${activeType.id}`}>
            <div className="ambient-layer" aria-hidden="true" />

            <section className="login-card" aria-label="Role based login">
                <div className="login-pane form-pane">
                    <p className="brand">Sohoj Coaching</p>
                    <h2 className="title">{isSignup ? `${activeType.tabLabel.replace('Login', 'Sign Up')}` : activeType.tabLabel}</h2>

                    <div className="role-switch" role="tablist" aria-label="Select login type">
                        {loginTypes.map((type) => (
                            <button
                                key={type.id}
                                type="button"
                                role="tab"
                                aria-selected={activeType.id === type.id}
                                className={activeType.id === type.id ? 'role-tab active' : 'role-tab'}
                                onClick={() => setSelectedType(type.id)}
                            >
                                {type.tabLabel.replace(' Login', '')}
                            </button>
                        ))}
                    </div>

                    <div className="role-select-wrap">
                        <label htmlFor="role-select" className="role-select-label">
                            Login as
                        </label>
                        <select
                            id="role-select"
                            className="role-select"
                            value={selectedType}
                            onChange={(event) => setSelectedType(event.target.value)}
                            aria-label="Select login type"
                        >
                            {loginTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.tabLabel}
                                </option>
                            ))}
                        </select>
                    </div>

                    {supportsSignup && (
                        <div className="auth-switch" role="tablist" aria-label="Select authentication mode">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={!isSignup}
                                className={!isSignup ? 'auth-switch-btn active' : 'auth-switch-btn'}
                                onClick={() => setAuthMode('login')}
                            >
                                Login
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={isSignup}
                                className={isSignup ? 'auth-switch-btn active' : 'auth-switch-btn'}
                                onClick={() => setAuthMode('signup')}
                            >
                                Sign Up
                            </button>
                        </div>
                    )}

                    <div className="auth-form-shell" key={`${selectedType}-${isSignup ? 'signup' : 'login'}`}>
                        <form className="login-form" onSubmit={handleSubmit}>
                            {isSignup && (
                                <>
                                    <label htmlFor="fullName" className="sr-only">
                                        Full Name
                                    </label>
                                    <input
                                        id="fullName"
                                        type="text"
                                        placeholder="Full Name"
                                        autoComplete="name"
                                        value={formValues.fullName}
                                        onChange={onFieldChange}
                                    />
                                </>
                            )}

                            <label htmlFor="email" className="sr-only">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                placeholder="Email"
                                autoComplete="email"
                                value={formValues.email}
                                onChange={onFieldChange}
                            />

                            {isSignup && selectedType === 'student' && (
                                <>
                                    <label htmlFor="classLevel" className="sr-only">
                                        Class / Batch
                                    </label>
                                    <input
                                        id="classLevel"
                                        type="text"
                                        placeholder="Class / Batch"
                                        autoComplete="off"
                                        value={formValues.classLevel}
                                        onChange={onFieldChange}
                                    />
                                </>
                            )}

                            {isSignup && selectedType === 'teacher' && (
                                <>
                                    <label htmlFor="subject" className="sr-only">
                                        Subject
                                    </label>
                                    <input
                                        id="subject"
                                        type="text"
                                        placeholder="Subject"
                                        autoComplete="off"
                                        value={formValues.subject}
                                        onChange={onFieldChange}
                                    />
                                </>
                            )}

                            <label htmlFor="password" className="sr-only">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                placeholder="Password"
                                autoComplete={isSignup ? 'new-password' : 'current-password'}
                                value={formValues.password}
                                onChange={onFieldChange}
                            />

                            {isSignup && (
                                <>
                                    <label htmlFor="confirmPassword" className="sr-only">
                                        Confirm Password
                                    </label>
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        placeholder="Confirm Password"
                                        autoComplete="new-password"
                                        value={formValues.confirmPassword}
                                        onChange={onFieldChange}
                                    />
                                </>
                            )}

                            <button type="submit" className="submit-btn" disabled={isSubmitting}>
                                {isSignup
                                    ? `Create ${selectedType === 'student' ? 'Student' : 'Teacher'} Account`
                                    : isSubmitting
                                        ? 'Signing In...'
                                        : activeType.buttonText}
                            </button>
                        </form>
                    </div>

                    {!!status && <p className={`auth-status auth-status-${statusType}`}>{status}</p>}

                    <p className="helper-text">
                        {supportsSignup
                            ? isSignup
                                ? 'Already have an account? Switch to login.'
                                : 'New here? Switch to sign up to create an account.'
                            : 'Admin access is provisioned by the institute.'}
                    </p>
                </div>

                <div className="login-pane visual-pane" key={activeType.id}>
                    <div className="theme-atmosphere" aria-hidden="true" />
                    <div className="motif-cloud" aria-hidden="true">
                        {activeType.motifs.map((motif) => (
                            <span key={motif} className="motif-chip">
                                {motif}
                            </span>
                        ))}
                    </div>

                    <h1>{activeType.heading}</h1>
                    <p>{activeType.subtitle}</p>
                    <p className="note">{activeType.note}</p>
                    <div className="shape shape-a" aria-hidden="true" />
                    <div className="shape shape-b" aria-hidden="true" />
                    <div className="shape shape-c" aria-hidden="true" />
                </div>
            </section>
        </main>
    );
}

export default Login;

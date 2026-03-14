import { useEffect, useMemo, useState } from 'react';
import './Login.css';
import { login, signup } from './services/authApi';

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
        }

        setIsSubmitting(true);
        try {
            const payload = isSignup
                ? await signup({
                    role: selectedType,
                    name: formValues.fullName.trim(),
                    email: formValues.email.trim(),
                    password: formValues.password
                })
                : await login({
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
                                {type.id === 'student' && (
                                    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                                    </svg>
                                )}
                                {type.id === 'teacher' && (
                                    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M2 3h20M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3M10 21v-5M14 21v-5M7 21h10" />
                                    </svg>
                                )}
                                {type.id === 'admin' && (
                                    <svg className="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    </svg>
                                )}
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
                                <span>
                                    {isSignup
                                        ? `Create ${selectedType === 'student' ? 'Student' : 'Teacher'} Account`
                                        : isSubmitting
                                            ? 'Signing In...'
                                            : activeType.buttonText}
                                </span>
                                {!isSubmitting && (
                                    <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 12h14"></path>
                                        <path d="m12 5 7 7-7 7"></path>
                                    </svg>
                                )}
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
                    <div className="visual-content">
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
                    </div>
                    <div className="role-illustration">
                        {activeType.id === 'student' && (
                            <>
                                <svg className="icon-main book-anim shadow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                                </svg>
                                <svg className="icon-float float-left cap-anim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                                    <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
                                </svg>
                                <svg className="icon-float float-right trophy-anim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                                    <path d="M4 22h16"></path>
                                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
                                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
                                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
                                </svg>
                            </>
                        )}
                        {activeType.id === 'teacher' && (
                            <>
                                <svg className="icon-main presentation-anim shadow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                                    <path d="M2 3h20M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3M10 21v-5M14 21v-5M7 21h10"></path>
                                    <path d="m8 10 3 3 5-5"></path>
                                </svg>
                                <svg className="icon-float float-left star-anim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                </svg>
                                <svg className="icon-float float-right msg-anim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2z"></path>
                                    <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"></path>
                                </svg>
                            </>
                        )}
                        {activeType.id === 'admin' && (
                            <>
                                <svg className="icon-main shield-anim shadow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                    <path d="m9 12 2 2 4-4"></path>
                                </svg>
                                <svg className="icon-float float-left gear-anim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"></path>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"></path>
                                </svg>
                                <svg className="icon-float float-right activity-anim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                                </svg>
                            </>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}

export default Login;

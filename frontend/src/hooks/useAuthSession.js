import { useEffect, useState } from 'react';
import { getCurrentUser } from '../services/authApi';
import { clearAuthSession, getAuthSession, saveAuthSession } from '../services/authStorage';

export const useAuthSession = () => {
    const [authState, setAuthState] = useState({
        loading: true,
        token: null,
        user: null
    });

    useEffect(() => {
        const restoreSession = async () => {
            const session = getAuthSession();
            if (!session?.token) {
                setAuthState({ loading: false, token: null, user: null });
                return;
            }

            try {
                const payload = await getCurrentUser(session.token);
                const nextSession = { token: session.token, user: payload.user };
                saveAuthSession(nextSession);
                setAuthState({ loading: false, ...nextSession });
            } catch {
                clearAuthSession();
                setAuthState({ loading: false, token: null, user: null });
            }
        };

        restoreSession();
    }, []);

    const completeLogin = (payload) => {
        const nextSession = { token: payload.token, user: payload.user };
        saveAuthSession(nextSession);
        setAuthState({ loading: false, ...nextSession });
    };

    const logout = () => {
        clearAuthSession();
        setAuthState({ loading: false, token: null, user: null });
    };

    return {
        authState,
        completeLogin,
        logout
    };
};

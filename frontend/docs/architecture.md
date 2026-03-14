# Frontend Architecture

The frontend auth and API access flow is split into reusable layers for maintainability.

## Folder Layout

- `src/App.jsx`: top-level app shell and auth gate.
- `src/layouts/AdminLayout.jsx`: authenticated admin navigation + routes.
- `src/layouts/TeacherLayout.jsx`: authenticated teacher navigation + routes.
- `src/layouts/StudentLayout.jsx`: authenticated student navigation + routes.
- `src/Login.jsx`: role-based login/signup UI + submit handling.
- `src/hooks/useAuthSession.js`: restore session, login complete, logout.
- `src/config/appConfig.js`: base URLs + storage keys.
- `src/services/authApi.js`: auth-focused API calls.
- `src/services/httpClient.js`: centralized fetch wrapper.
- `src/services/authStorage.js`: localStorage session helpers.

## API Client Rules

- All feature pages call `apiFetch` from one shared place.
- Auth header injection is controlled by `withAuth: true`.
- JSON request/response handling is centralized.

## Scaling Benefit

- New feature pages do not re-implement token logic.
- Auth/session logic can evolve without touching every page.
- Route-level organization remains clean as modules grow.
- Each role now has its own post-login shell for scalable feature expansion.

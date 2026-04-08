# Frontend Architecture

The frontend auth and API access flow is split into reusable layers for maintainability.

## Folder Layout

- `src/App.jsx`: top-level app shell and auth gate.
- `src/layouts/AdminLayout.jsx`: authenticated admin navigation + routes.
- `src/layouts/TeacherLayout.jsx`: authenticated teacher navigation + routes.
- `src/layouts/StudentLayout.jsx`: authenticated student navigation + routes.
- `src/BatchManagementPage.jsx`: FR-3 admin batch creation/configuration screen.
- `src/AttendanceTeacherAnalytics.jsx`: FR-12 teacher attendance analytics screen.
- `src/AttendanceStudentAnalytics.jsx`: FR-12 student attendance analytics screen.
- `src/components/batches/*`: FR-3 batch UI primitives.
- `src/Login.jsx`: role-based login/signup UI + submit handling.
- `src/hooks/useAuthSession.js`: restore session, login complete, logout.
- `src/config/appConfig.js`: base URLs + storage keys.
- `src/services/authApi.js`: auth-focused API calls.
- `src/services/batchApi.js`: FR-3 batch CRUD API calls.
- `src/services/attendanceApi.js`: FR-12 attendance analytics API calls.
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

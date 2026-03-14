# Backend Architecture

This backend now follows a modular structure so auth and feature routes can scale independently.

## Folder Layout

- `src/index.js`: minimal runtime entrypoint.
- `src/server.js`: server startup + DB connectivity checks.
- `src/app.js`: express app composition and route mounting.
- `src/config/authConfig.js`: JWT config + demo admin account catalog.
- `src/middleware/auth.js`: token issue/verify and role guards.
- `src/services/authService.js`: login/signup business logic per role.
- `src/controllers/batchController.js`: FR-3 request validation + HTTP responses.
- `src/services/batchService.js`: FR-3 batch business/query logic.
- `src/utils/validators.js`: reusable input validators.
- `src/routes/authRoutes.js`: authentication endpoints.
- `src/routes/batchRoutes.js`: FR-3 batch CRUD endpoints.
- `src/routes/publicRoutes.js`: read-only/shared API endpoints.
- `src/routes/adminRoutes.js`: admin-protected mutations and management endpoints.

## Auth Design

1. `POST /api/auth/signup` creates student/teacher users with hashed passwords.
2. `POST /api/auth/login` returns JWT for admin, teacher, and student roles.
3. `GET /api/auth/me` validates and returns active user profile.
4. Admin-only routes are protected by:
   - `requireAuth`
   - `requireAdmin`

## FR-3 Batch API

1. `POST /api/batches` (admin)
2. `GET /api/batches` (all authenticated roles)
3. `GET /api/batches/:id` (all authenticated roles)
4. `PUT /api/batches/:id` (admin)
5. `DELETE /api/batches/:id` (admin, blocked if enrollments exist)

`GET /api/batches` includes derived `student_count` from enrollments.

## Why This Structure

- Keeps startup concerns separate from business logic.
- Makes each domain route file smaller and easier to test.
- Reduces merge conflicts by isolating feature changes.
- Keeps role-specific auth logic isolated for easier future upgrades.

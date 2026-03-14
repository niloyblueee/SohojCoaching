# Backend Architecture

This backend now follows a modular structure so auth and feature routes can scale independently.

## Folder Layout

- `src/index.js`: minimal runtime entrypoint.
- `src/server.js`: server startup + DB connectivity checks.
- `src/app.js`: express app composition and route mounting.
- `src/config/authConfig.js`: JWT config + demo admin account catalog.
- `src/middleware/auth.js`: token issue/verify and role guards.
- `src/utils/validators.js`: reusable input validators.
- `src/routes/authRoutes.js`: authentication endpoints.
- `src/routes/publicRoutes.js`: read-only/shared API endpoints.
- `src/routes/adminRoutes.js`: admin-protected mutations and management endpoints.

## Auth Design

1. `POST /api/auth/login` returns JWT for admin credentials.
2. `GET /api/auth/me` validates and returns active user profile.
3. Admin-only routes are protected by:
   - `requireAuth`
   - `requireAdmin`

## Why This Structure

- Keeps startup concerns separate from business logic.
- Makes each domain route file smaller and easier to test.
- Reduces merge conflicts by isolating feature changes.
- Prepares clean extension point for Student/Teacher auth in next phase.

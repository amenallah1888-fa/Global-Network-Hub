---
name: Backend security boundary
description: Shared API request validation, safe errors, bounded pagination, and transactional mutation conventions.
---

All API routes pass through one request-security boundary before route handlers query the database. The boundary rejects oversized/deep/prototype-polluting payloads, unsafe route parameters, invalid pagination, and oversized JSON or URL-encoded bodies. Critical financial and counter-changing workflows keep their related writes inside one database transaction; notifications and reputation side effects occur after commit.

**Why:** The app has many route modules and generated clients, so duplicating only partial validation leaves inconsistent limits and can expose atomicity failures in multi-step financial flows.

**How to apply:** Add route-specific Zod schemas for new or high-risk payloads, preserve the shared `limit`/`offset` contract with a maximum of 20, and keep external side effects after the transaction commits. Return safe client errors while logging full server errors through the structured logger.
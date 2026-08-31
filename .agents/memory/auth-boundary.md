---
name: Authentication and authorization boundary
description: Cookie-first JWT sessions, persistent revocation, authenticated request identity, and resource-level RBAC.
---

Browser sessions use short-lived, issuer/audience-bound JWTs in secure HttpOnly SameSite cookies, with a database-backed session record so logout can revoke the token before JWT expiry. Native clients may use the bearer compatibility path.

**Why:** Stateless long-lived tokens and anonymous demo-user fallback allowed token replay, privilege escalation, and parameter-tampering risks.

**How to apply:** Keep authentication centralized before protected routers; derive identity only from the verified request user; use role middleware for privileged routes; scope private reads and writes to that identity; never serialize password hashes or trust client-supplied roles.
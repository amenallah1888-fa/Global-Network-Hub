---
name: Financial locking and audit boundary
description: Durable rules for simulated Pi financial state and security audit events.
---

Financial integrity uses the existing domain records as the source of truth because this project has no wallet-balance ledger. Every balance-like counter, ownership transfer, escrow transition, and reward update must re-read and lock its authoritative row inside a database transaction, validate state under the lock, and write its audit event in that same transaction. Notifications and reputation side effects happen only after commit.

**Why:** Concurrent requests previously could observe the same pending state or stale counter, while audit records could contain sensitive free-form request data or survive a rolled-back business mutation.

**How to apply:** Use the centralized audit helper for every sensitive event; record only sanitized metadata, hashed request IP context, and non-PII identifiers. Return typed expected conflicts (such as 409 state races) separately from unexpected 500 errors.
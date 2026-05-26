---
name: Escrow & Milestone Architecture
description: Status flows, API surface, and UI patterns for the smart escrow and milestone systems
---

## Smart Agreement Status Flow
`DRAFT` → `LOCKED_IN_ESCROW` → `ACTIVE`

POST /smart-agreements creates an agreement directly in LOCKED_IN_ESCROW state. Default 3-phase milestones: 30%/40%/30%.

## Milestone Status Flow
`locked` → `pending_proof` → `released`

- Founder submits proof URL → PATCH /milestones/:id { status: "pending_proof", proofUrl }
- Backer verifies → PATCH /milestones/:id { status: "released" }

## API Endpoints Added (pitches.ts)
- GET /pitches/:id/milestones — ordered by milestone.order
- GET /pitches/:id/documents — project documents for a pitch
- POST /pitches/:id/documents — founder submits a doc { documentUrl, documentType }
- PATCH /pitches/:id/verify — admin sets verificationStatus: "verified" | "pending"

## API Endpoints Added (smart-agreements.ts)
- PATCH /project-documents/:id — admin approves/rejects { status: "APPROVED"|"REJECTED", reviewNote }
- GET /admin/pending — returns { documents: PendingDoc[], pitches: PendingPitch[] }

## UI Patterns
- Pitch detail has 3 tabs: Overview | Milestones | Verification
- EscrowModal replaces simple disclaimer; shows step-by-step: initiating→locking→active
- termsHash displayed (first 6 + last 4 chars) in success view
- Trust score computed server-side (computeTrustScore fn in pitches.ts) — max 100, deducted for reports

**Why:** Milestone-based escrow is the core trust mechanic; funds locked until milestones verified by backers prevents fraud.

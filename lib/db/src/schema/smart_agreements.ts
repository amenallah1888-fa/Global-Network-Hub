import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const smartAgreementsTable = pgTable("smart_agreements", {
  id: text("id").primaryKey(),
  senderId: text("sender_id").notNull(),
  receiverId: text("receiver_id").notNull(),
  projectId: text("project_id").notNull(),
  totalPiCommitted: integer("total_pi_committed").notNull().default(0),
  termsHash: text("terms_hash").notNull().default(""),
  status: text("status").notNull().default("DRAFT"),
  refundDeadline: timestamp("refund_deadline", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  disputeStatus: text("dispute_status"),
  timelockDeadline: timestamp("timelock_deadline", { withTimezone: true }),
  juryDeadline: timestamp("jury_deadline", { withTimezone: true }),
  aiVerdict: text("ai_verdict"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const projectDocumentsTable = pgTable("project_documents", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  agreementId: text("agreement_id"),
  documentUrl: text("document_url").notNull(),
  documentType: text("document_type").notNull().default("proof"),
  status: text("status").notNull().default("PENDING"),
  reviewNote: text("review_note"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SmartAgreement = typeof smartAgreementsTable.$inferSelect;
export type ProjectDocument = typeof projectDocumentsTable.$inferSelect;

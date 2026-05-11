// Backwards-compatible exports; live data now comes from the API.
// Kept as types + the well-known current user id used across the UI.

export const CURRENT_USER_ID = "u_me";

export type Stage = "Idea" | "Pre-seed" | "Seed" | "Series A" | "Series B";

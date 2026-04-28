import { db, notificationsTable } from "@workspace/db";

type Args = {
  userId: string;
  type: string;
  actorId?: string;
  postId?: string;
  circleId?: string;
  pitchId?: string;
  amount?: number;
  message: string;
};

export async function createNotification(args: Args): Promise<void> {
  if (args.actorId && args.actorId === args.userId) return;
  await db.insert(notificationsTable).values({
    userId: args.userId,
    type: args.type,
    actorId: args.actorId ?? null,
    postId: args.postId ?? null,
    circleId: args.circleId ?? null,
    pitchId: args.pitchId ?? null,
    amount: args.amount ?? null,
    message: args.message,
  });
}

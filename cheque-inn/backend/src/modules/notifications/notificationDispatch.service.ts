import * as usersRepo from "../users/users.repository";
import * as repo from "./notifications.repository";
import { sendMailSafe } from "../../lib/mail/mail.service";
import {
  notificationEmailBody,
  notificationEmailSubject,
} from "../../lib/mail/notificationEmail";
import type { NotificationTypeValue } from "./notificationTypes";

export interface DispatchNotificationInput {
  companyId: string;
  userId: string;
  type: NotificationTypeValue;
  title: string;
  body: string;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
  sendEmail?: boolean;
}

/**
 * Create in-app notification (dedupe-safe) and optionally email the user.
 */
export async function dispatchNotification(
  input: DispatchNotificationInput
): Promise<repo.NotificationRecord | null> {
  if (input.dedupeKey) {
    const exists = await repo.existsByDedupeKey(
      input.companyId,
      input.userId,
      input.dedupeKey
    );
    if (exists) return null;
  }

  const row = await repo.insertNotification({
    company_id: input.companyId,
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    dedupe_key: input.dedupeKey ?? null,
    metadata: input.metadata ?? {},
  });

  if (input.sendEmail !== false) {
    await tryEmailNotification(row);
  }

  return row;
}

export async function dispatchToMany(
  userIds: string[],
  base: Omit<DispatchNotificationInput, "userId">
): Promise<number> {
  let created = 0;
  const uniq = [...new Set(userIds)];
  for (const userId of uniq) {
    const row = await dispatchNotification({ ...base, userId });
    if (row) created += 1;
  }
  return created;
}

async function tryEmailNotification(row: repo.NotificationRecord): Promise<void> {
  if (row.email_sent_at) return;
  const user = await usersRepo.getUserById(row.user_id);
  if (!user?.email) return;
  const ok = await sendMailSafe({
    to: user.email,
    subject: notificationEmailSubject(row),
    text: notificationEmailBody(row),
  });
  if (ok) {
    await repo.markEmailSent(row.id);
  }
}

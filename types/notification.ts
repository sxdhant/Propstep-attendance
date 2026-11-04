import type { IsoTimestamp } from "./common";

export type NotificationType =
  | "attendance_approved"
  | "attendance_rejected"
  | "attendance_submitted"
  | "attendance_reminder"
  | "payroll_finalized"
  | "payroll_paid"
  | "policy_update"
  | "holiday";

/** Recipient is an employee id, or `admin` for all administrators. */
export type NotificationRecipient = string;

export interface AppNotification {
  id: string;
  recipient: NotificationRecipient;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: IsoTimestamp;
  read: boolean;
  /** Where clicking the notification should take the user. */
  href?: string;
}

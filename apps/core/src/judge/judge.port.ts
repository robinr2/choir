export const JUDGE = Symbol('Judge');

export type Judge = {
  judge(notificationId: string): Promise<void>;
};

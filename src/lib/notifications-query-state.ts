export type NotificationsQueryState<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "success"; notifications: T[] };

export function getNotificationsQueryState<T>({
  data,
  isError,
  isPending,
}: {
  data: T[] | undefined;
  isError: boolean;
  isPending: boolean;
}): NotificationsQueryState<T> {
  if (isPending) return { status: "loading" };
  if (isError) return { status: "error" };

  const notifications = data ?? [];
  return notifications.length === 0 ? { status: "empty" } : { status: "success", notifications };
}

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { getNotificationsQueryState } from "../../src/lib/notifications-query-state.ts";

const routeSource = await readFile(
  new URL("../../src/routes/_authenticated/account.notifications.tsx", import.meta.url),
  "utf8",
);
const functionsSource = await readFile(
  new URL("../../src/lib/notifications.functions.ts", import.meta.url),
  "utf8",
);

function observe(queryFn) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return new QueryObserver(client, { queryKey: ["notifs", "test"], queryFn, retry: false });
}

function view(result) {
  return getNotificationsQueryState({
    data: result.data,
    isError: result.isError,
    isPending: result.isPending,
  });
}

test("pending notifications request renders loading and an empty success settles", async () => {
  let resolveRequest;
  const observer = observe(
    () =>
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
  );
  const states = [];
  const unsubscribe = observer.subscribe((result) => states.push(view(result).status));

  assert.equal(states[0], "loading");
  resolveRequest([]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(states.at(-1), "empty");
  unsubscribe();
});

test("successful notifications render the returned rows", async () => {
  const rows = [{ id: "notification-1", title: "Order shipped" }];
  const observer = observe(async () => rows);
  const settled = await new Promise((resolve) => {
    const unsubscribe = observer.subscribe((result) => {
      if (!result.isPending) {
        unsubscribe();
        resolve(view(result));
      }
    });
  });

  assert.deepEqual(settled, { status: "success", notifications: rows });
});

test("a rejected request settles as a recoverable error", async () => {
  const observer = observe(async () => {
    throw new Error("notifications unavailable");
  });
  const settled = await new Promise((resolve) => {
    const unsubscribe = observer.subscribe((result) => {
      if (result.isError) {
        unsubscribe();
        resolve(view(result));
      }
    });
  });

  assert.deepEqual(settled, { status: "error" });
  assert.match(routeSource, /Unable to load notifications\./);
  assert.match(routeSource, /"Retry"/);
});

test("retry performs a real refetch and can settle to the empty state", async () => {
  let attempts = 0;
  const observer = observe(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("first attempt fails");
    return [];
  });
  await new Promise((resolve) => {
    const unsubscribe = observer.subscribe((result) => {
      if (result.isError) {
        unsubscribe();
        resolve();
      }
    });
  });

  const result = await observer.refetch();
  assert.equal(attempts, 2);
  assert.deepEqual(view(result), { status: "empty" });
  assert.match(routeSource, /list\.refetch\(\)/);
});

test("notification reads and actions remain authenticated and user-scoped", () => {
  assert.match(functionsSource, /\.middleware\(\[requireSupabaseAuth\]\)/);
  assert.match(functionsSource, /\.eq\("user_id", context\.userId\)/);
  assert.match(functionsSource, /export const markRead/);
  assert.match(functionsSource, /export const markAllRead/);
  assert.match(routeSource, /doMarkRead\(\{ data: \{ id \} \}\)/);
  assert.match(routeSource, /doMarkAll\(\{\}\)/);
  assert.match(routeSource, /invalidateQueries\(\{ queryKey: \["notifs"\] \}\)/);
});

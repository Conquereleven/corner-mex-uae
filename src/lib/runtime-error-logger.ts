/**
 * Lightweight runtime error logger. Captures uncaught errors and
 * unhandled promise rejections, and surfaces failed asset loads
 * (CSS/JS) to the console with the request URL so the underlying
 * Vite transform error is easy to find. Dev-only side effects.
 */

let installed = false;

export function installRuntimeErrorLogger() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "LINK" || target.tagName === "SCRIPT" || target.tagName === "IMG")) {
      // Asset load failure
      const url = (target as HTMLLinkElement).href || (target as HTMLScriptElement).src || (target as HTMLImageElement).src;
      // eslint-disable-next-line no-console
      console.error("[asset-load-failed]", target.tagName, url);
    } else {
      // eslint-disable-next-line no-console
      console.error("[runtime-error]", event.error ?? event.message);
    }
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    // eslint-disable-next-line no-console
    console.error("[unhandled-promise-rejection]", event.reason);
  });
}
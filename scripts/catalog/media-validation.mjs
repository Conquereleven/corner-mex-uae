import net from "node:net";
import { sha256, VERSIONS } from "./catalog-lib.mjs";

const MIME_BY_EXTENSION = Object.freeze({
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
});
const privateHost = (host) => {
  const value = host.toLowerCase();
  if (value === "localhost" || value.endsWith(".local")) return true;
  if (!net.isIP(value)) return false;
  return (
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc|fd)/i.test(value) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(value)
  );
};

export async function fetchMediaContent(
  item,
  { fetchImpl = fetch, timeoutMs = 10_000, maxBytes = 10_485_760 } = {},
) {
  const sourceUrl = assertSafeMediaUrl(item.sourceUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(sourceUrl, {
      redirect: "manual",
      signal: controller.signal,
      headers: { accept: "image/jpeg,image/png,image/webp" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("MEDIA_REDIRECT_LOCATION_MISSING");
      try {
        assertSafeMediaUrl(new URL(location, sourceUrl).toString());
      } catch {
        throw new Error("MEDIA_REDIRECT_PRIVATE_HOST_DENIED");
      }
      throw new Error("MEDIA_REDIRECT_DENIED");
    }
    if (!response.ok) throw new Error("MEDIA_DOWNLOAD_FAILED");
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error("MEDIA_OVERSIZED");
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw new Error("MEDIA_OVERSIZED");
    return {
      bytes,
      contentType: response.headers.get("content-type"),
      contentLength: declaredLength || bytes.length,
      finalUrl: sourceUrl.toString(),
      maxBytes,
    };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("MEDIA_TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export function assertSafeMediaUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("MEDIA_URL_INVALID");
  }
  if (url.protocol !== "https:") throw new Error("MEDIA_HTTPS_REQUIRED");
  if (privateHost(url.hostname)) throw new Error("MEDIA_PRIVATE_HOST_DENIED");
  const signed = [...url.searchParams.keys()].some((key) =>
    /token|signature|x-amz|credential|expires/i.test(key),
  );
  if (signed) throw new Error("MEDIA_SIGNED_URL_DENIED");
  if (decodeURIComponent(url.pathname).includes("..")) throw new Error("MEDIA_PATH_TRAVERSAL");
  return url;
}
export function sniffMime(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  const head = bytes.subarray(0, 512).toString("utf8").trim().toLowerCase();
  if (head.startsWith("<svg")) throw new Error("MEDIA_SVG_DENIED");
  if (head.startsWith("<!doctype html") || head.startsWith("<html") || head.includes("<script"))
    throw new Error("MEDIA_HTML_DENIED");
  if (
    bytes.subarray(0, 2).toString("hex") === "4d5a" ||
    bytes.subarray(0, 4).toString("hex") === "7f454c46"
  )
    throw new Error("MEDIA_EXECUTABLE_DENIED");
  throw new Error("MEDIA_MIME_DENIED");
}
export function validateMediaContent(
  item,
  { bytes, contentType, contentLength, finalUrl = item.sourceUrl, maxBytes = 10485760 },
) {
  const source = assertSafeMediaUrl(item.sourceUrl),
    final = assertSafeMediaUrl(finalUrl);
  if (source.hostname !== final.hostname && privateHost(final.hostname))
    throw new Error("MEDIA_REDIRECT_PRIVATE_HOST_DENIED");
  if (!bytes) throw new Error("MEDIA_BYTES_MISSING");
  if (bytes.length > maxBytes || Number(contentLength) > maxBytes)
    throw new Error("MEDIA_OVERSIZED");
  if (Number.isFinite(Number(contentLength)) && Number(contentLength) !== bytes.length)
    throw new Error("MEDIA_SIZE_MISMATCH");
  const sniffed = sniffMime(bytes),
    header = String(contentType || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
  if (header && header !== sniffed) throw new Error("MEDIA_MIME_MISMATCH");
  const ext = source.pathname.split(".").pop().toLowerCase();
  if (!MIME_BY_EXTENSION[ext] || MIME_BY_EXTENSION[ext] !== sniffed)
    throw new Error("MEDIA_EXTENSION_MISMATCH");
  const checksum = sha256(bytes);
  if (item.contentSha256 && item.contentSha256 !== checksum)
    throw new Error("MEDIA_CHECKSUM_MISMATCH");
  return {
    ...item,
    validationStatus: "validated",
    contentSha256: checksum,
    contentMime: sniffed,
    contentBytes: bytes.length,
  };
}
export function validateMediaBatch(items, loader) {
  const hashes = new Map(),
    results = [];
  for (const item of items) {
    try {
      const validated = validateMediaContent(item, loader(item));
      const prior = hashes.get(validated.contentSha256);
      if (
        prior &&
        JSON.stringify(prior) !==
          JSON.stringify({ mime: validated.contentMime, bytes: validated.contentBytes })
      )
        throw new Error("MEDIA_DUPLICATE_HASH_CONFLICT");
      hashes.set(validated.contentSha256, {
        mime: validated.contentMime,
        bytes: validated.contentBytes,
      });
      results.push(validated);
    } catch (error) {
      results.push({ ...item, validationStatus: "failed", errorCode: error.message });
    }
  }
  return {
    contractVersion: VERSIONS.mediaEvidence,
    validated: results.filter((x) => x.validationStatus === "validated").length,
    failed: results.filter((x) => x.validationStatus === "failed").length,
    items: results,
  };
}

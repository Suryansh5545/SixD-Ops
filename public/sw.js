/**
 * SixD Ops — Service Worker (PWA)
 *
 * Responsibilities:
 *   1. Cache static assets for offline access
 *   2. Queue log sheet entries when offline (IndexedDB sync)
 *   3. Show offline banner via postMessage to client
 *
 * Offline sync strategy:
 *   - Log sheet clock-in/out are queued in IndexedDB when offline
 *   - On connectivity restore, queued requests are replayed in order
 *   - User is shown a yellow "You are offline" banner while disconnected
 */

const CACHE_NAME = "sixd-ops-v1";
const OFFLINE_QUEUE_NAME = "sixd-logsheet-queue";

// Static assets to cache for offline access
const CACHED_URLS = [
  "/",
  "/login",
  "/offline",
];

// ─── INSTALL ──────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHED_URLS).catch((err) => {
        console.warn("[SW] Cache addAll failed (some URLs may not exist yet):", err);
      });
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH ────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Intercept logsheet POST/PUT requests when offline
  if (
    url.pathname.match(/\/api\/projects\/[^/]+\/logsheet/) &&
    (event.request.method === "POST" || event.request.method === "PUT")
  ) {
    event.respondWith(handleLogsheetRequest(event.request));
    return;
  }

  // Network-first for API routes (fresh data preferred)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Cache-first for static assets (Next.js _next chunks)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Network-first for pages
  event.respondWith(networkFirst(event.request));
});

// ─── BACKGROUND SYNC ──────────────────────────────────────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-logsheet") {
    event.waitUntil(syncQueuedLogsheetEntries());
  }
});

// ─── STRATEGIES ───────────────────────────────────────────────────────────────

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return offline page for navigation requests
    if (request.mode === "navigate") {
      return caches.match("/offline") || new Response("Offline", { status: 503 });
    }
    return new Response(JSON.stringify({ success: false, error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    return new Response("Asset not available offline", { status: 503 });
  }
}

// ─── OFFLINE LOG SHEET QUEUEING ───────────────────────────────────────────────

async function handleLogsheetRequest(request) {
  try {
    return await fetch(request.clone());
  } catch {
    // Offline — queue the request for later replay
    await queueRequest(request.clone());

    // Notify the client that we're in offline mode
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage({ type: "OFFLINE_ENTRY_QUEUED" });
    }

    // Register background sync
    try {
      await self.registration.sync.register("sync-logsheet");
    } catch {
      // Background sync not supported — will rely on online event
    }

    // Return optimistic success so the UI can show the entry immediately
    return new Response(
      JSON.stringify({
        success: true,
        data: { queued: true, message: "Entry queued for sync when online" },
      }),
      {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function queueRequest(request) {
  const body = await request.text();
  const entry = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body,
    queuedAt: Date.now(),
  };

  // Store in IndexedDB
  const db = await openDB();
  const tx = db.transaction(OFFLINE_QUEUE_NAME, "readwrite");
  tx.objectStore(OFFLINE_QUEUE_NAME).add(entry);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function syncQueuedLogsheetEntries() {
  const db = await openDB();
  const tx = db.transaction(OFFLINE_QUEUE_NAME, "readwrite");
  const store = tx.objectStore(OFFLINE_QUEUE_NAME);

  const entries = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve([]);
  });

  for (const entry of entries) {
    try {
      await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
      });

      // Remove from queue on success
      const deleteTx = db.transaction(OFFLINE_QUEUE_NAME, "readwrite");
      deleteTx.objectStore(OFFLINE_QUEUE_NAME).delete(entry.id);
    } catch {
      // Keep in queue and retry next sync
    }
  }

  // Notify clients that sync is complete
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({ type: "SYNC_COMPLETE" });
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("sixd-ops-offline", 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_NAME)) {
        db.createObjectStore(OFFLINE_QUEUE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

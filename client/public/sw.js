const SHELL_CACHE = "dms-shell-v1";
const STATIC_CACHE = "dms-static-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(SHELL_CACHE)
            .then((cache) => cache.add(OFFLINE_URL))
            .then(() => self.skipWaiting())
            .catch(() => undefined),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter(
                            (key) =>
                                key.startsWith("dms-") &&
                                key !== SHELL_CACHE &&
                                key !== STATIC_CACHE,
                        )
                        .map((key) => caches.delete(key)),
                ),
            )
            .then(() => self.clients.claim())
            .catch(() => undefined),
    );
});

self.addEventListener("message", (event) => {
    if (event.data === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

function isRscOrPrefetch(request) {
    return (
        request.headers.has("RSC") ||
        request.headers.has("Next-Router-Prefetch") ||
        request.headers.has("Next-Router-State-Tree")
    );
}

function shouldBypass(request, url) {
    if (request.method !== "GET") return true;
    if (url.origin !== self.location.origin) return true;
    if (url.pathname.startsWith("/api")) return true;
    if (url.pathname.includes("socket.io")) return true;
    if (isRscOrPrefetch(request)) return true;
    return false;
}

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (shouldBypass(request, url)) return;

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches
                        .open(SHELL_CACHE)
                        .then((cache) => cache.put(request, copy))
                        .catch(() => undefined);
                    return response;
                })
                .catch(() =>
                    caches
                        .match(request)
                        .then(
                            (cached) =>
                                cached ??
                                caches
                                    .match(OFFLINE_URL)
                                    .then(
                                        (offline) =>
                                            offline ?? Response.error(),
                                    ),
                        ),
                ),
        );
        return;
    }

    if (
        url.pathname.startsWith("/_next/static/") ||
        url.pathname.startsWith("/icons/")
    ) {
        event.respondWith(
            caches.match(request).then(
                (cached) =>
                    cached ??
                    fetch(request).then((response) => {
                        const copy = response.clone();
                        caches
                            .open(STATIC_CACHE)
                            .then((cache) => cache.put(request, copy))
                            .catch(() => undefined);
                        return response;
                    }),
            ),
        );
    }
});

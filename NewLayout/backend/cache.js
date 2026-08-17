// Tiny TTL cache with in-flight de-duplication, so N callers asking for the
// same slow resource trigger exactly one fetch.
const store = new Map();
const inflight = new Map();

export function cached(key, ttlMs, producer) {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) {
    return Promise.resolve(hit.value);
  }

  const running = inflight.get(key);
  if (running) return running;

  const promise = Promise.resolve()
    .then(producer)
    .then(value => {
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

export function invalidate(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

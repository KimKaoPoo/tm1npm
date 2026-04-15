# Changelog

All notable changes to this project are documented here.

## 2.0.0 — 2026-04-16

### BREAKING CHANGES

**RestService HTTP methods now use tm1py-parity semantics**
(see [#80](https://github.com/KimKaoPoo/tm1npm/pull/95)).

- **Timeout unit is seconds, not milliseconds.** `get/post/patch/put/delete`
  now accept a `RequestOptions` object (extending `Omit<AxiosRequestConfig,
  'timeout'>`) whose `timeout` is specified in seconds to match tm1py's
  `RestService.request(timeout: float)`. The value is converted to
  milliseconds internally before reaching Axios.
  - Migration: `rest.get(url, { timeout: 30000 })` → `rest.get(url, { timeout: 30 })`.
  - TypeScript will **not** flag the change because both old and new
    values are `number`; audit call sites before upgrading.
  - Heuristic to find likely millisecond-valued call sites:
    ```
    rg -n 'rest\.(get|post|patch|put|delete).*timeout:\s*\d{4,}' src/
    ```

- **`retrieve_async_response` now returns the full `AxiosResponse`**
  instead of `response.data`. This matches tm1py's `retrieve_async_response`
  which returns `requests.Response`.
  - Migration: `(await rest.retrieve_async_response(id)).Status` →
    `(await rest.retrieve_async_response(id)).data.Status`.

- **`get_async_operation_status` was removed.** The `/_async('{id}')`
  endpoint does not expose a `Status` sub-resource, so the helper always
  returned `'Unknown'` on real servers. Use `retrieve_async_response` and
  inspect the response status instead.

- **`wait_for_async_operation` parameter order.** `cancel_at_timeout` is
  now the fourth parameter (after `poll_interval_seconds`) to preserve
  the pre-existing signature of callers passing a polling cadence.

### Added

- Central `_request()` dispatcher in `RestService` that routes to sync or
  async execution and honors new per-request options: `asyncRequestsMode`,
  `returnAsyncId`, `cancelAtTimeout`, `timeout` (seconds), `idempotent`,
  `verifyResponse`.
- `_executeAsyncRequest` sends `Prefer: respond-async[,wait=55]`, parses
  the `Location` header on `202 Accepted`, and polls `/_async('{id}')`
  via `waitTimeGenerator` (exponential backoff capped at
  `asyncPollingMaxDelay`).
- `cancel_async_operation` and `retrieve_async_response` now target the
  correct TM1 v12 endpoint `/_async('{id}')` (previously
  `/AsyncOperations('{id}')`). `AsyncOperationService` updated to match.
- `wait_for_async_operation` detects the `asyncresult` response header
  and throws `TM1RestException` on non-2xx embedded status codes to
  match tm1py's `_transform_async_response` semantics.

### Changed

- 5xx and network-level retries in the response interceptor now only
  apply when the request is marked `idempotent: true` (default `true`
  for GET, `false` for POST/PATCH/PUT/DELETE).
- `verifyResponse: false` honors a caller-supplied `validateStatus`
  instead of silently overwriting it.
- `AsyncOperationService.createAsyncOperation` now marks returned
  operations with `trackedLocally: true` so `getAsyncOperationStatus`
  reads from the in-memory cache instead of polling `/_async('{id}')`
  with a client-side UUID (which the server does not recognize).
  `ProcessService.executeWithReturnAsync` / `pollProcessExecution`
  depend on this behavior for their background-resolve pattern.
- `retrieve_async_response` no longer throws on non-2xx statuses; it
  returns the raw `AxiosResponse` so the internal poller can retry on
  transient 404s (resource not yet materialized) without aborting.

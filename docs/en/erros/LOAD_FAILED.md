# LOAD_FAILED

The remote couldn't be downloaded or run.

## Causes

- HTTP response with an error (404, 500…). The message shows the status and the URL.
- Network or CORS error. The remote's server must answer with `Access-Control-Allow-Origin`.
- The JS threw an error while being imported. The original error is in `error.cause`.

## How to fix

1. Open the message's URL in the browser.
2. Check CORS in the Network tab.
3. See `error.cause` for the original JS error.

`LOAD_FAILED` errors are retried `retries` times (default: 1) and aren't cached: the next mount tries again.

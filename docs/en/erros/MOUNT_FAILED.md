# MOUNT_FAILED

The remote loaded, but its `mount()` function threw an error. vitral removes the element it created and cancels the remote's event subscriptions.

## How to fix

The original error is in `error.cause`. Common causes:

- A required prop the host didn't send.
- The remote expects an element or global variable that doesn't exist in the host.

To show a message in place of the remote, use the host component's error state (e.g. the `error` slot in Vue) or `onStatus` in `createSlot`.

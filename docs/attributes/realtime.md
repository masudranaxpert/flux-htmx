# fx-realtime

Server-Sent Events (SSE) preset that automatically connects to an event stream and swaps incoming messages into the DOM. Zero dependencies, fully native `EventSource`.

```html
<div
  fx-realtime="/events/live"
  fx-target="#feed"
  fx-swap="afterbegin"
  fx-event="new_order"
>
  Waiting for events...
</div>
```

## Supported Attributes

| Attribute             | Description                                                                                             | Default       |
| --------------------- | ------------------------------------------------------------------------------------------------------- | ------------- |
| `fx-realtime`         | **Required**. The URL of the SSE endpoint to connect to.                                                | -             |
| `fx-target`           | The CSS selector of the element to swap into.                                                           | Element itself|
| `fx-swap`             | How to swap the incoming HTML (`innerHTML`, `outerHTML`, `afterbegin`, etc.). Fallbacks to innerHTML.   | `innerHTML`   |
| `fx-event`            | The name of the specific SSE event type to listen to.                                                   | `message`     |
| `fx-with-credentials` | If present, includes credentials (cookies) for cross-origin SSE requests.                               | `false`       |

## JavaScript Events

When an event is received, or the connection encounters an error, `fx-realtime` dispatches native CustomEvents on the element:

- `flux:realtime:message` — Fired when a message is successfully received and swapped. `event.detail` contains `{ url, data }`.
- `flux:realtime:error` — Fired when the `EventSource` connection fails. `event.detail` contains `{ url }`.

## Fallback

`fx-realtime` attempts to use `htmx.swap()` for full HTMX lifecycle support (so any HTMX attributes in the incoming HTML are automatically processed). If `htmx.swap` is unavailable, it gracefully falls back to native `innerHTML` or `outerHTML`.

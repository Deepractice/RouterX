---
"routerxjs": minor
"@routerxjs/core": minor
---

Support model name mapping and dynamic Router instance

- ModelEntry supports { name, upstreamModel } for provider-side model name mapping
- RouteResult includes upstreamModel field
- createRouterX accepts routerInstance for dynamic config (e.g. from D1)

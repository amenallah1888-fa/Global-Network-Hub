---
name: API contract codegen availability
description: The shared OpenAPI contract can be updated independently when the api-spec workspace lacks an installed Orval binary.
---

Update `lib/api-spec/openapi.yaml` whenever the API surface changes, but do not block a working client on codegen if the api-spec workspace has no installed Orval binary. The mobile app may use its established authenticated fetch client temporarily.

**Why:** The workspace has previously had package-firewall/install limitations that left `lib/api-spec/node_modules` absent while the API and mobile services remained runnable.

**How to apply:** Attempt the documented codegen command, record a clear limitation if `orval` is unavailable, and keep the OpenAPI contract authoritative for the next dependency-enabled session.
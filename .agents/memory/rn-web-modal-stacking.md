---
name: React Native Web Modal stacking order
description: Why sibling <Modal> components can render behind each other on web, and how to fix it
---

On web, `react-native-web`'s `Modal` mounts its content into `document.body` in **DOM/mount order**, not by any z-index-based "last opened wins" logic. If multiple `<Modal>` components are siblings in the same component's JSX, whichever one is declared *first* in the source mounts first in the DOM and can render *behind* a `Modal` declared later — even if the earlier one is opened later at runtime.

**Why:** Native iOS/Android modals don't have this issue (each `Modal` uses a native overlay), so the bug only appears on web and is easy to miss if only tested on device/simulator. Symptom: a secondary modal (e.g. a settings sub-panel opened from within a primary modal) appears "trapped" visually behind the primary modal instead of on top.

**How to apply:** When a screen has multiple `<Modal>` siblings that can be open concurrently or nested conceptually (e.g. a "Settings" modal that opens a "Wallet Address" or "Appearance" modal from within it), declare the sub-modals *after* the primary modal's closing tag in the JSX, so they mount later in the DOM and stack on top on web.

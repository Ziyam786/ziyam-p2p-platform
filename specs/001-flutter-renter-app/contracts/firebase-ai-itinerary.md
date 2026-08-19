# Contract: Client-side Itinerary Generation (Firebase AI Logic)

Mirrors `generateRoadTripItinerary()` in `src/frontend/lib/firebase.ts:216-242` exactly — same
Firebase project, same model, same prompt shape — so the Flutter and web clients produce
consistent output for the same destination.

## Firebase project wiring

- Run `flutterfire configure` against the **same** Firebase project as `src/frontend` (identified
  by `NEXT_PUBLIC_FIREBASE_PROJECT_ID`).
- Produces `lib/firebase_options.dart` plus `android/app/google-services.json` and
  `ios/Runner/GoogleService-Info.plist`.
- **These two platform config files are supplied directly by the project owner into the repo/build
  environment once the app skeleton exists — never pasted as text into a prompt, ticket, or commit
  message.** They are not secret in the way a service-account key is, but they are still added as
  files, not inlined.
- No Firebase App Check is enforced today (confirmed in research.md) — this app does not need to
  do anything additional to satisfy it, but enabling App Check later is a reasonable hardening step
  for both clients, tracked separately, not blocking this feature.

## Generation call

- Package: `firebase_ai` (FlutterFire's Firebase AI Logic client).
- Backend: `GoogleAIBackend` (Gemini Developer API surface via Firebase AI Logic — matches the
  web client's `getAI(app, { backend: new GoogleAIBackend() })`).
- Model: `gemini-flash-latest` — same model id as the web client, not a different tier.
- Input: destination name + the same static per-destination description strings already defined
  server-side in `ITINERARY_DESTINATIONS` (`itinerary.routes.ts:11-16`) — the Flutter client should
  fetch/derive this the same way the web client does (either duplicate the same four-destination
  constant client-side, matching the existing web app's own duplication, or fetch it if a shared
  source becomes available — out of scope to add a new endpoint for this alone).
- Output: plain-text itinerary content, 80–50,000 characters (matches the `content` length
  validation already enforced by `POST /itineraries/:id/content`).

## Failure handling

- If generation fails after payment succeeded, the app must NOT lose the paid `ItineraryUnlock` —
  it stays in `PAID` status with `generatedContent` null/placeholder, and the app offers a retry
  that calls Firebase AI Logic again without re-invoking `/itineraries/unlock` (FR-010).
- Matches the existing web behavior, which checks for the literal placeholder string
  `"couldn't generate your itinerary"` (`itinerary.routes.ts:75`) to decide whether a stored
  `generatedContent` should be treated as "not really generated yet" — the Flutter client should
  honor the same sentinel rather than inventing a new failure marker.

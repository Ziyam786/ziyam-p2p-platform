# Ziyam SelfDrive — Mobile (Flutter)

The renter/customer counterpart to `src/frontend`, talking to the same `src/backend` API. See
`specs/001-flutter-renter-app/` (spec, plan, research, data model, contracts, tasks) for the full
design record this app was built from.

## One manual step before this app can actually run: Firebase

`lib/firebase_options.dart` in this repo is a **placeholder** — every value in it is fake. Nothing
except itinerary AI generation (`lib/data/itinerary/itinerary_ai_service.dart`) depends on it being
real, so auth, fleet browsing, booking, and profile all work without touching Firebase at all. To
make itinerary generation work:

1. Run `flutterfire configure` from this directory, pointing it at the **same Firebase project**
   `src/frontend` already uses (see `src/frontend/lib/firebase.ts`'s config, or
   `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in that app's env). This regenerates
   `lib/firebase_options.dart` for real and overwrites the placeholder.
2. It will also produce (or you'll need to place manually if you already have them from the
   Firebase console):
   - `android/app/google-services.json`
   - `ios/Runner/GoogleService-Info.plist`

   These are **not secrets in the traditional sense** (same trust level as the web app's public
   `NEXT_PUBLIC_FIREBASE_*` config) — but per this project's constitution, add them as files
   directly rather than pasting their contents anywhere.
3. In the Firebase console for that project, confirm the Gemini API is enabled under Firebase AI
   Logic (Google AI Logic backend) — this is a console setting, not something this app configures.

This was left undone deliberately: `flutterfire configure` requires an interactive Firebase CLI
login, which can't be done non-interactively.

## Running

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://<your-machine-ip>:5000/api
```

`API_BASE_URL` defaults to `http://localhost:5000/api`, which only works for an iOS simulator or
a desktop-run — an Android emulator needs `10.0.2.2` instead of `localhost`, and a physical device
needs your machine's LAN IP, per the usual Flutter-against-a-local-backend setup.

## What's implemented vs. not

See `specs/001-flutter-renter-app/tasks.md` for the authoritative, task-by-task status. In short:
all four user stories (fleet browse, booking + payment, AI itinerary, profile/KYC) are implemented
end-to-end against the real backend contracts, including two required backend fixes (bearer-token
auth, a booking-creation race-condition fix). Test coverage is partial — one representative widget
test exists; most of the per-screen widget/integration tests listed in tasks.md were not written
due to scope, and are called out there as explicit follow-up rather than silently skipped.

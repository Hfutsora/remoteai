# Mobile lounge verification

The production native and mobile Web entry is Discover → Online Chat. Native uses the shared
controller with an AppState lifecycle adapter and Expo image handling. Account avatars and
received messages are saved locally; SQLite history survives restart and supports paged search. The
connection stays mounted while navigating other pages. Mobile operating systems may suspend
the app in the background; returning resumes or reconnects without downloading missed messages.
The lounge does not request notifications or send system alerts.

## Physical Android

The isolated `com.codexswitch.mobile.loungetest` application renders the production discovery,
navigation, lounge, composer, history and moderation components against a local WebSocket fixture.
It does not use the installed application's credentials or modify a real chat room.

```powershell
$env:NODE_PATH = (Resolve-Path apps/native/node_modules).Path
$env:NODE_ENV = 'production'
$env:ANDROID_SERIAL = '<physical device serial from adb devices>'
Push-Location apps/native/android
.\gradlew.bat assembleRelease -I ../e2e/lounge.init.gradle -PreactNativeArchitectures=arm64-v8a
Pop-Location
node apps/native/e2e/lounge-test.mjs
```

The runner verifies discovery unread badges, sending, search, mute actions, foreground delivery,
long-press quote replies, cancellation, locally restored quotes, moderator-only presence,
language changes and session cleanup at system font scales 1.0 and 1.3. It also restarts the app
with the ticket endpoint unavailable and searches a uniquely sent message, proving local persistence
without server replay or historical unread counts. It restores the previous
font scale and opens the installed app afterward. Inspect `.codex-tmp/lounge-android/*.png` for
complete Chinese glyphs, entry/back navigation, keyboard layout and wrapping. iOS needs separate
device verification; this Android fixture is not evidence of iOS execution or background delivery
while the operating system has suspended networking.

## Automated checks

```powershell
npm run check -w @codex-switch/native
npx vitest run --root apps/native src/lounge
npm run check:i18n
Push-Location apps/desktop
npx playwright test --config playwright.lounge.config.ts
Pop-Location
```

The browser suite uses bundled Chromium and includes 320px/390px mobile Web discovery, multiline
input, mixed messages, history, moderation and a reduced viewport for keyboard layout. It also
regresses desktop local/remote/Web chat because the controller and browser composer are shared.
Native unit tests cover image byte limits, temporary image cleanup, 48px avatar crops, picker
cancellation, lifecycle behavior without DOM globals, and SQLite restart/account isolation, literal
search, pagination beyond 200 messages and image-heavy page bounds. Server deployment remains separate and
follows `apps/admin-go/DEPLOYMENT.md`.

# VibeLink

Two Android phones, one private link. Press the pulse button on one phone and the other one vibrates — with no notification, no notification permission prompt, and no foreground service.

VibeLink pairs two devices with a short code, stores the link in Firebase Realtime Database, and relays each pulse through a small Cloud Function that sends a **data-only, high-priority FCM message**. The receiving app turns that message into a vibration in its background handler. Nothing is ever posted to the notification shade.

It also ships **seven built-in haptic rhythms** plus a custom rhythm builder with offline previews, a **full appearance system** (palette, corner shape, layout size, font style and text size) that applies instantly and persists, a **privacy mode** that turns the launcher icon into a decoy system app which opens the phone's own Settings, plus a pause switch for delivery that works from Quick Settings, and an **in-app updater** that checks Firebase once a day, verifies the download's SHA-256 and hands the APK to Android's installer.

## How it works

```
 Phone A                      Firebase                         Phone B
 ───────                      ────────                         ───────
 press pulse
     │
     └── write ──────►  pairs/{code}/triggers/{id}
                              │
                              │ onValueCreated
                              ▼
                        relayPulse function
                              │
                              │ data-only FCM { type: "buzz", pattern }
                              ▼
                        background handler ──► Vibration.vibrate()
                        (no notification payload)
                              │
                              │ write receipt
                              ▼
                        members/{myUid}/lastDeliveredTrigger
                              │
                              │ onValue
                              ▼
                      Phone A: “pulse delivered”
```

- **Pairing** — anonymous Firebase Auth gives each install a UID. One phone creates an 8-character code (the RTDB pair ID); the other joins with it. Each member must claim one of two fixed seat slots (`seats/a`, `seats/b`), so a third phone cannot join.
- **Presence** — `.info/connected` and `onDisconnect` keep an online flag per member.
- **Silent delivery** — the Cloud Function finds the *other* member, reads their private FCM token from `notificationTokens/{uid}`, and sends a high-priority **data-only** message. There is no `notification` block, so Android has nothing to display.
- **Vibration** — `index.js` registers the background FCM handler before the app; it calls a small native module that plays the received waveform with amplitudes (`VibrationEffect.createWaveform` on Android 8+) using `USAGE_NOTIFICATION`, because Android ignores React Native's default `USAGE_MEDIA` haptics from background processes. When the app is already open, `onMessage` vibrates and shows a small in-app banner instead.
- **Delivery receipt** — the relay puts the trigger's push ID in the FCM payload. Right after the waveform plays (foreground or background), the receiving phone writes `lastDeliveredTrigger` and `lastDeliveredAt` onto its own member node; the sender watches the pair, so the controller switches from “pulse sent” to “pulse delivered” when that ID matches. The write is self-only and best-effort: a paused phone, an unlinked phone, or a failed write simply leaves the sender on “sent”. It confirms the phone played the vibration, not that the user felt it through Do Not Disturb.
- **Haptics** — seven built-in rhythms (`tap`, `double`, `wave`, `heartbeat`, `ripple`, `sos`, `long`) are defined as timing/amplitude arrays in `src/lib/patterns.ts`. The custom builder composes up to eight pulses with adjustable length, gap and strength; the sender stores the sanitized arrays on the trigger and the relay forwards them as JSON strings, so the receiver replays the sender's rhythm exactly. Previews work offline, without a pair.
- **Appearance** — a theme context (`src/theme/ThemeProvider.tsx`) exposes palette, shape, spacing, font family and text scale to every component through `useThemedStyles`. Choices apply instantly, persist in AsyncStorage, and the app holds a neutral splash until they load, so there is no flash of the default theme.
- **Privacy mode** — two activity-aliases target different activities: **VibeLink** → `MainActivity`, and a **System services** decoy (neutral gear, grey-blue tile) → `DecoyActivity`, which immediately opens the phone's own Settings. Exactly one alias is enabled at a time, so the launcher always shows a single, working icon: with privacy off it is VibeLink; with privacy on, tapping the gear opens Settings and nothing reveals the app. Switching aliases never touches `MainActivity`. The app itself stays reachable through the **VibeLink app** Quick Settings tile or the secret dial code, and the **VibeLink delivery** tile pauses/resumes pulses without opening anything. Both the foreground and background FCM handlers consult the native pause flag before vibrating.
- **Background access** — a second native module reports Android's battery state (unrestricted, optimized, or restricted) and opens the system **Allow background activity** dialog. The pairing, waiting, and linked screens show a status card with an **Allow unrestricted** action, because aggressive OEM battery management is the usual reason pulses miss while the screen is off.
- **Updates** — on launch, at most once every 24 hours, the app reads `appUpdates/latest` from RTDB. If `versionCode` is higher than the installed build, it shows a dismissible banner (and an always-visible card in Settings). Tapping update downloads the APK with Android's `DownloadManager` into the app's private external files directory, checks the SHA-256 against the published value, and passes the file to the system installer through a `FileProvider`. Android requires the user to approve the install, and the first update needs the **Install unknown apps** permission for VibeLink.

### Database layout

```
pairs/{pairCode}
  meta:    { createdAt, createdBy }
  seats/{a|b}: member UID reservation
  members/{uid}: { uid, name, platform, online, joinedAt, lastSeen }
                // plus lastDeliveredTrigger, lastDeliveredAt once a pulse arrives
  triggers/{id}: { from, fromName, pattern, createdAt }   // deleted by the function
                // custom pulses add timings[], amplitudes[], patternLabel
notificationTokens/{uid}: { token, updatedAt }           // private to that device
appUpdates/latest: { versionCode, versionName, apkUrl, sha256, sizeBytes, notes, publishedAt }
                                                         // read-only to clients; written by the publish script
```

## Requirements

- Android Studio with JDK 17, Node 22+, and Android SDK platform 37 (Gradle downloads the matching platform/build-tools on first build if licenses are accepted)
- A Firebase project on the **Blaze** plan (Cloud Functions cannot deploy on Spark)
- Two Android devices with Google Play services (physical devices strongly recommended; FCM support is unreliable on plain emulator images)
- Firebase CLI (`npm install -g firebase-tools`)

## Setup

### 1. Install dependencies

```sh
npm install
cd functions && npm install && cd ..
```

### 2. Add the Android app to Firebase

1. In the Firebase console, add an Android app with package name **`com.vibelink`**.
2. Download its `google-services.json` and place it at `android/app/google-services.json`. (It is gitignored; no config file ships with this repo.)
3. Under **Build → Authentication → Sign-in method**, enable **Anonymous**.
4. Under **Build → Realtime Database**, create a database.
5. Under **Build → Storage**, click **Get started** to create the bucket. This project instead links a dedicated bucket (`comboapp-451011-app-updates`) through the Firebase Storage API (`buckets/{bucket}:addFirebase`) and registers it as the `updates` storage target in `.firebaserc`. Either arrangement works; `storage.rules` reads the same way for both. A bucket created outside the console **must** be linked, or the download endpoint answers `412`/`400`.

No SHA certificate is needed. The app never requests notification permission (`POST_NOTIFICATIONS` is explicitly removed during manifest merging); the messaging libraries contribute their usual network and wake-lock components, and the app declares `VIBRATE` for the pulse.

### 3. Point the CLI at the project

```sh
firebase login
firebase use --add     # pick your project; this writes .firebaserc
```

### 4. Deploy the rules and relay function

```sh
firebase deploy --only "database,storage,functions"
```

This deploys `database.rules.json`, `storage.rules` (to the `updates` storage target), and `relayPulse` (`functions/index.js`). The function is pinned to `us-central1`; if your database or organization requires another region, change `region` there before deploying. If you point the target at a different bucket, run `firebase target:apply storage updates <your-bucket>` first.

The function uses the Firebase Admin SDK and the FCM HTTP v1 API. Make sure the **Firebase Cloud Messaging API** is enabled for the project (it normally is). You do not need to copy any server credentials into the app.

### 5. Build and install on both phones

Start Metro, then install the debug APK on both devices:

```sh
npm start

cd android
./gradlew assembleDebug                  # Windows: gradlew.bat assembleDebug
adb devices
adb -s <serialA> reverse tcp:8081 tcp:8081
adb -s <serialB> reverse tcp:8081 tcp:8081
adb -s <serialA> install -r app/build/outputs/apk/debug/app-debug.apk
adb -s <serialB> install -r app/build/outputs/apk/debug/app-debug.apk
```

Alternatively run `npm run android` once per connected device. The `adb reverse` lines let both debug builds reach Metro over USB.

For release builds, replace the debug signing config with your own keystore and run `./gradlew assembleRelease`; the JS bundle is embedded in release builds, so Metro is not needed.

## Using VibeLink

1. On phone A, choose **Create a pair**. An 8-character code appears; share it with phone B.
2. On phone B, choose **I have a code** and enter it. Both phones switch to the linked screen.
3. Pick a rhythm — **Tap**, **Double**, **Wave**, **Heartbeat**, **Ripple**, **SOS**, **Long**, or any custom rhythm you saved — and press the large circular pulse button.
4. Phone B vibrates. If VibeLink is in the foreground, it also shows a brief in-app banner. If it is in the background or the screen is off, only the vibration happens. Phone A's status line changes from “pulse sent” to “pulse delivered” once Phone B has played the waveform.
5. Do this on **both** phones: in the **Background delivery** card, tap **Allow unrestricted** and confirm the system prompt. This removes Android's battery optimization for VibeLink so FCM pulses are not deferred. On Samsung, also exclude VibeLink from **Sleeping apps** / **Deep sleeping apps**; on Xiaomi, OPPO, vivo, and similar builds, also allow autostart. The card names the relevant menu for the detected manufacturer.
6. Use **Unlink this phone** on either phone to detach it. The other phone returns to the waiting screen and can be paired with a new device using the same code.

### Haptic lab

Open **Haptic lab** from the wave button in the header, from **Preview haptics without pairing** on the pairing screen, or from Settings.

- Every built-in rhythm has a **Play** button, so you can feel it before you pair.
- **Build your own** chooses 1–8 pulses, pulse length (40–600 ms), gap (30–800 ms) and strength (Soft/Medium/Strong), then previews or saves it. Saved rhythms appear in the linked screen's rhythm row with a `CUSTOM` tag, and the other phone feels the exact same waveform.
- Saved rhythms are capped at eight and stored locally; removing one only affects this phone.

### Appearance

Open Settings with the **•••** button in the header. Everything applies live and stays saved:

- **Palette** — Volt (lime), Ocean (cyan), Orchid (violet), Ember (amber).
- **Corners** — Sharp, Soft, Round.
- **Layout size** — Compact, Standard, Large (spacing and control scale).
- **Font style** — System, Condensed, Serif, Mono.
- **Text size** — S, M, L, XL.

**Reset appearance** returns to the defaults.

### Privacy mode

Settings → **Privacy**:

1. Turn on **Privacy mode**. The VibeLink icon is replaced by **System services** — a grey gear on a slate tile with no VibeLink branding — and tapping it opens the phone's own **Settings** app, not VibeLink. The launcher still shows exactly one icon, and delivery is unaffected. Remove any VibeLink home-screen icon first: home-screen items are launcher-owned and cannot be repointed to the new component (see Limitations).
2. Open VibeLink while disguised with either of these:
   - **Quick Settings tile "VibeLink app"** — opens the app from any screen and leaves the decoy in place. Add the tile once, before you need it.
   - **Dial `*#*#4263#*#*`** from the phone app — a stock-Android path; Samsung and other custom dialers may simply place a call, so rely on the tile there.
3. **Turn Privacy mode off** (inside the app) to bring the real VibeLink icon back.
4. **Pause delivery** drops incoming pulses silently. The **"VibeLink delivery"** tile toggles it with one tap while the app is closed; if VibeLink is open, the switch and the controller status follow the tile immediately.

For a real background test, lock the screen and trigger a pulse from the other phone. On stock Android you can also swipe VibeLink from recents first; on aggressive OEM builds, swiping may kill background delivery, so keep the app in recents and allow autostart. Never use **Force stop**.

### In-app updates

Settings → **APP** shows the installed version and build number, a **Check for updates** action, and the state of the current download.

- On launch VibeLink reads `appUpdates/latest` at most once every 24 hours. A newer `versionCode` raises a dismissible banner; **Later** hides it for that version only, and **Update** starts the download. The card in Settings always shows an available update, even after the banner is dismissed.
- Downloads go through Android's `DownloadManager` into the app's private external files folder, so no storage permission is needed and the download survives leaving the app. Progress appears in the card.
- When the download finishes, the app hashes the file and compares it with the published SHA-256. A mismatch deletes the file and reports an error; nothing unverified is ever offered to the installer.
- The first update needs **Install unknown apps** for VibeLink. The card switches to **Allow installs** and opens that system toggle; returning to VibeLink continues straight to the installer.
- Android always asks before installing. There is no silent install — that would require a device-owner or root setup.

To publish a release:

1. Raise `versionCode` (and usually `versionName`) in `android/app/build.gradle`.
2. Build a release APK with the **same signing key** as the installed app.
3. Run the publish script from `functions/`, with Admin credentials available through `GOOGLE_APPLICATION_CREDENTIALS` or `--credentials` (the Firebase CLI login is not enough for the Admin SDK):

```sh
cd functions
node publish-update.mjs \
  --apk ../android/app/build/outputs/apk/release/app-release.apk \
  --version-code 3 \
  --version-name 1.2 \
  --project comboapp-451011 \
  --database-url https://comboapp-451011-default-rtdb.firebaseio.com \
  --bucket comboapp-451011-app-updates \
  --notes "Faster pairing"
```

The script uploads `app-updates/vibelink-<versionCode>.apk`, creates a tokenised download URL, computes the SHA-256 and size, and writes `appUpdates/latest`. Re-running it for the same `versionCode` replaces the object and the metadata. `--database-url` is the `<instance>.firebaseio.com` URL shown under **Realtime Database** in the console; the script cannot discover it from Application Default Credentials. Pass a different bucket with `--bucket` or `FIREBASE_STORAGE_BUCKET`.

Clients need only read access: `appUpdates` is readable by signed-in users in `database.rules.json` and has no client write rule. `storage.rules` allows reads only under `app-updates/` because `DownloadManager` sends no Firebase credentials; listing, writes, and every other path stay denied.

## Security model

- The 8-character pair code is the link's **bearer secret**. It is generated from a CSPRNG using a 32-character alphabet (~40 bits), so it cannot be guessed in practice. Share it only with the device you are pairing.
- RTDB rules cap a pair at two members using two fixed seat slots; a seat can only be claimed or cleared by its owner. Member writes are self-only, triggers are member-only and pattern-validated, and FCM tokens live outside the pair and are readable only by their owner, so a paired peer can never read the other phone's token.
- The Cloud Function re-validates the sender's membership and the pattern before sending. Custom rhythms are only forwarded if they are finite, non-negative arrays that start at `0`, fit within 41 entries / 30 seconds, and carry a matching amplitude array (clamped to 0–255); anything else falls back to `tap`. Triggers are create-only for clients and are deleted by the function after processing.
- **Delivery receipts are self-reported.** Each phone can write only its own member node, so a paired peer cannot mark the other phone's pulse as delivered, and a receipt contains just a trigger ID and a timestamp. A modified client could still claim delivery it never played — treat the label as a courtesy signal, not proof.
- **Privacy mode is obscurity, not encryption.** Disguising replaces the launcher icon with a decoy that opens the phone's Settings, and pausing drops pulses silently — both only on that phone. The app still holds its Firebase identity and FCM token, and anyone with the APK, adb access, or the app's settings can restore the real icon. It does not hide VibeLink from Settings → Apps, and it cannot stop Android from listing the app in battery or notification settings.
- **Update integrity is checksum plus signature.** Metadata lives in `appUpdates/latest`, which only the Admin SDK can write; the app itself can only read it. The APK is fetched over HTTPS and must match the published SHA-256 before the installer sees it. Even if the metadata were tampered with, Android refuses to replace the app with an APK that is not signed by the same release key, so the release keystore remains the real trust anchor. The update path in Storage is publicly readable because `DownloadManager` carries no Firebase credentials; listing is denied, the rest of the bucket is closed, and the files contain only the app binary.
- Anonymous authentication is per-install identity, not account security. Anyone who obtains a code while a slot is free can join that pair. Unlinking removes only that member; the pair node lingers in the database, so you may manually delete old pairs in the console. Reinstalling the app or clearing app data creates a new anonymous UID and requires pairing again.
- Traffic is encrypted in transit by Firebase. This is not end-to-end encryption: the database and project administrators can see member names, presence, and pulse patterns. No vibration content or message text exists beyond the pattern name.

## Limitations

- **Android only.** The repository contains the standard RN iOS scaffold, but no iOS Firebase setup or vibration handler is implemented.
- **Force-stopped apps cannot receive FCM.** Android blocks messages to an app the user has explicitly force-stopped in Settings until it is opened again. On stock Android, swiping from recents is fine; some OEM builds treat it as a kill, so allow autostart there.
- **A reinstall creates a new identity.** Clearing app data or reinstalling VibeLink generates a new anonymous UID and FCM token. The old pair still contains the previous UID, so pulses target a dead token until you unlink on the other phone and pair again. The function now removes tokens that FCM reports as unregistered; the receiving app also re-uploads its token every time it returns to the foreground.
- **OEM battery management can delay or drop background messages.** Every phone should use the in-app **Allow unrestricted** action, and aggressive brands also need autostart, sleeping-app, or background-usage allowances. The card detects the manufacturer and shows the extra step. Doze mode can still delay data messages despite high priority.
- **“Delivered” reflects the receiving app, not the user.** The sender switches to *pulse delivered* when the other phone writes its receipt after playing the waveform. A paused phone, an unlinked phone, a missing FCM token, or a failed receipt write leaves the sender on *sent*, and nothing confirms the pulse was felt — Do Not Disturb or a vibration setting can still swallow it. Receipts also require the deployed relay to forward `triggerId`; if yours predates that, pulses still arrive but never report delivery.
- Cloud Functions requires the Blaze plan. At normal personal use, traffic is well within the free tiers, but billing must be enabled.
- Vibration may be suppressed by Do Not Disturb, silent mode, or a device-wide vibration setting. This is controlled by Android, not the app. Amplitude support also depends on the device's vibration motor; phones without one play the timings at full strength.
- **Background apps cannot read the volume keys.** Android only delivers hardware key events to the foreground, or to an AccessibilityService (which would need permanent "observe your input" access). That is why privacy mode uses Quick Settings tiles instead of a volume-button combo for starting/stopping delivery and for bringing the app back. The tiles need to be added to the Quick Settings panel once, while the icon is still visible.
- **The secret dial code is not universal.** It is handled by the system broadcast `android.provider.Telephony.SECRET_CODE`, which stock Android dialers send when the full code is entered. Samsung and some other dialers try to place a call instead. Use the "VibeLink app" Quick Settings tile as the dependable way in — add it **before** enabling privacy mode. There is no lockout risk: the decoy icon always launches the phone's Settings, and turning Privacy mode off restores the real icon.
- Disguising does not affect delivery: FCM still wakes the app, and the icon change has no bearing on the pause flag. Use the delivery tile to pause or resume while the app is closed.
- **Self-updates apply to sideloaded APK builds only.** Android replaces an app only when the new APK is signed with the same key and has a higher `versionCode`; builds installed through Google Play must be updated through Play instead. Android also requires an explicit install confirmation and, on Android 8+, the per-app **Install unknown apps** permission — nothing installs silently.
- **The update check is throttled to once a day.** A freshly published build may not prompt until the next day; use Settings → **Check for updates** to check immediately. Reinstalling or clearing app data resets the throttle, and manual checks never count against it.
- **A home-screen icon survives a disguise switch.** The decoy is a different launcher component, so a home-screen icon pinned to the real VibeLink icon is left pointing at a disabled component and opens **App info** when tapped. Apps cannot repoint or delete launcher workspace items — remove the old home-screen icon before enabling privacy mode, then pin the *System services* gear if you want one on the home screen.
- The Cloud Function region is fixed at deployment time. If your RTDB region or policy requires another location, update `functions/index.js` and redeploy.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `firebase deploy` fails with 401 / “invalid authentication credentials” | The CLI session has expired. Run `firebase login --reauth`, complete the browser sign-in, then deploy again. |
| “Cannot understand what targets to deploy” in PowerShell | PowerShell splits unquoted commas. Use `firebase deploy --only "database,functions"`. |
| “Firebase could not sign in” | Enable Anonymous sign-in, confirm `android/app/google-services.json` belongs to package `com.vibelink`, then rebuild the app. |
| “Silent delivery is blocked” / permission denied on token | Run `firebase deploy --only database` and confirm the Messaging API is enabled. |
| “The link went quiet” | Deploy the function, confirm both phones have internet, and check that RTDB rules were deployed. |
| Join fails | The code must be 8 valid characters. A pair accepts only two members; an existing pair with two members rejects the join. |
| No vibration in the foreground | Check the device's vibration/DND settings, then try sending from the other phone again. |
| No vibration in the background | Open VibeLink on the receiver and check the **Background delivery** card. If it says Optimized or Restricted, tap **Allow unrestricted** and confirm. Also confirm the app was opened once after install (to register its FCM token), was not force-stopped, and, on Samsung/Xiaomi/OPPO/vivo, is allowed in the vendor's sleeping-app/autostart menu. |
| The controller stays on “pulse sent” | The receiving phone may be paused, offline, unlinked, missing its FCM token, or its receipt write failed. Confirm the pulse actually arrived first, then redeploy `functions/index.js` so the relay forwards `triggerId` — a relay without it delivers pulses but can never confirm them. |
| Pulses arrive but the phone stays still | Check the **VibeLink delivery** Quick Settings tile — delivery may be paused. Also check Do Not Disturb, silent mode and the device vibration settings. |
| The VibeLink icon disappeared | An older build hid it. Install the current build, tap the **VibeLink app** Quick Settings tile, or dial `*#*#4263#*#*` on a stock Android dialer. The current build disguises the icon instead of removing it. |
| The VibeLink icon is now a grey gear called “System services” | Privacy mode is on: tapping it opens the phone's Settings by design. Open VibeLink with the **VibeLink app** tile or the dial code, then turn Privacy mode off to restore the real icon. |
| A VibeLink icon is still on the home screen after disguising, and tapping it opens App info | The pinned item belongs to the launcher and still points at the old component. Remove it, then pin the “System services” gear. The app drawer and search already show the disguised icon. |
| Dialing `*#*#4263#*#*` just places a call | Samsung and some custom dialers do not broadcast secret codes. Use the **VibeLink app** Quick Settings tile to open the app instead. |
| “The update check failed (database/permission-denied)” | Deploy the database rules so `appUpdates` is readable. A silent launch check hides this error; the Settings card shows it. |
| No update banner appears | The installed build's `versionCode` must be lower than the published one, and the banner is suppressed for versions dismissed with **Later**. Auto-check runs once a day; use **Check for updates** in Settings → APP. |
| The update download fails | Check the connection, confirm the Storage bucket exists, and re-run the publish script if the object or token URL is stale. |
| “The downloaded file did not match the published checksum” | The metadata and the uploaded APK disagree — republish the exact APK, or retry the download if it was truncated. |
| Tapping Update opens a settings page instead of installing | Android needs **Install unknown apps** for VibeLink. The card's **Allow installs** button opens the right toggle; return to the app afterwards. |
| The installer says “App not installed” | The APK is signed with a different key, or its `versionCode` is not higher than the installed build. Rebuild with the original release keystore and bump the version. |
| Function logs show “recipient has no FCM token” | Open VibeLink on the receiving phone and wait a moment for token registration, then retry. |
| Function logs show `messaging/registration-token-not-registered` | The receiving app was reinstalled/cleared or its token rotated. Open VibeLink on that phone. If it was reinstalled, unlink it on the other phone and pair again. The function source now deletes dead tokens automatically after redeploy. |
| Background works on one test phone but not another debug install | Debug builds load JS from Metro, so headless background handlers fail when Metro is unreachable. Install a release APK (JS bundle embedded) on phones that are not tethered to Metro. |
| Function logs show “Discarded a pulse from a non-member” | The sender is no longer a member of that pair (stale datastore state or an old build). Re-pair the devices. |

Inspect delivery server-side:

```sh
firebase functions:log --only relayPulse
```

In the RTDB console, a successful path looks like: a trigger appears under `pairs/{code}/triggers`, the function logs a “Silent pulse delivered” line, and the trigger is removed. `notificationTokens/{uid}` should contain a token for each device after its first launch.

## Local checks

```sh
npx tsc --noEmit
npm run lint
npm test
node --check functions/index.js
```

Known verification status in this workspace:

- TypeScript, ESLint, and 25 unit tests pass (the updater adds metadata-validation tests).
- `database.rules.json` compiles in the local Database emulator (run with a JDK 21+). Both `database.rules.json` (including the `appUpdates` read rule) and `storage.rules` (the `updates` target) are deployed to `comboapp-451011`; an unauthenticated RTDB read of `appUpdates/latest` returns 401.
- `firebase.json` and `database.rules.json` parse, and `functions/publish-update.mjs --help` runs against the installed Admin SDK.
- The release APK builds and installs, and the new adaptive icon renders in the launcher and app drawer.
- Background vibration was verified on a Samsung SM-S921E (Android 17): with the app backgrounded, system logs show `usage=NOTIFICATION` and `status FINISHED` for the native waveform. While the phone was in Doze with the screen off, an incoming pulse still logged `RNFirebaseMsgReceiver` and played the full waveform without waking the display.
- The relay was verified across two devices on 2026-10-28 — the SM-S921E and an Android 13 emulator. Pairing with an 8-character code completed on both, both devices showed each other's model name on the controller, and pulses were delivered in both directions (`Silent pulse delivered to FCM.` in Cloud Run logs plus matching vibration or in-app banner).
- A custom rhythm was exercised end-to-end: a 3-pulse / 180 ms / 120 ms / Medium rhythm saved as "Trio" appears on the controller with a `CUSTOM` tag and produced exactly three 180 ms vibration segments (120 ms gaps) on the receiving phone; the function logged `pattern=custom, custom=True`.
- Appearance changes apply live and survive a force-stop on the same device. The neutral splash now waits for stored settings, so the default palette no longer flashes before the saved theme.
- Icon hiding was exercised on the same device in an earlier build: the launcher alias disappeared and the app exited; the **VibeLink app** Quick Settings tile restored it. The dial code was **not** delivered by Samsung's dialer (it tried to place a call), so the tile is the documented recovery path.
- Also observed on the SM-S921E with that build: after hiding, the drawer, app list and launcher search dropped VibeLink, but a previously placed home-screen icon stayed and taps opened **App info**. Logcat showed the launcher item retargeted to `com.vibelink/android.app.AppDetailsActivity` once the alias was disabled. That is why the current build **disguises** the icon instead of removing it — the disguised alias stays enabled, so its icon always launches the app. The pinned-icon caveat still applies when switching between the two aliases.
- The pause switch in Settings and the controller's `DELIVERY PAUSED` status update live when the **VibeLink delivery** tile is toggled while VibeLink is open; the tile broadcasts the change and the app emits it to JS, so no app restart or resume is needed.
- The disguise swap was exercised on the SM-S921E: with privacy mode on, `dumpsys package` listed `LauncherAlias` as disabled and `SystemAlias` as enabled, the drawer entry launched `SystemAlias`, and the decoy opened `com.android.settings` with no VibeLink entry left in recents.
- The delivery receipt compiles and type-checks (TypeScript, ESLint, 25 tests) but has **not** been exercised on a device yet: the receiver writes `lastDeliveredTrigger` from both FCM handlers, and the controller flips to *pulse delivered* only when the peer's ID matches the trigger it just sent.
- The updater compiles and packages: the APK contains `REQUEST_INSTALL_PACKAGES`, the `com.vibelink.updates` FileProvider and `res/xml/updater_paths.xml`. Update `1.1` (version code 2) was published on 2026-10-28 as `app-updates/vibelink-2.apk` (63,719,005 bytes, SHA-256 `fce7a0e8…7fc85`) with `appUpdates/latest` pointing at it.
- The full download → checksum → install round trip ran on the SM-S921E: the installed build 1 showed the **Downloading…** progress card, then the installer replaced it, and `dumpsys package` afterwards reported `versionCode=2` / `versionName=1.1`.
- `database.rules.json`, `storage.rules` (the `updates` target) and `functions/index.js` (custom rhythms, heartbeat/ripple/SOS/long) are deployed to `comboapp-451011`; the two-device run above used the deployed version.
- Full pairing and delivery on other OEM builds cannot be exercised locally; use the in-app card and the troubleshooting table if a device still misses pulses.

## Project layout

```
App.tsx                         screen routing (main / settings / haptic lab)
index.js                        background FCM handler (registered before the app)
src/components/                 pairing, waiting, controller, haptic lab, settings, banners, issue screens
src/components/BackgroundAccessCard.tsx  battery status + Allow unrestricted action
src/hooks/useAnonymousAuth.ts   anonymous sign-in
src/hooks/useBackgroundAccess.ts  live battery/standby status, settings intents
src/hooks/useNotificationChannel.ts  FCM token registration
src/hooks/usePairing.ts         RTDB pair lifecycle, presence, restore
src/hooks/useIncomingPulse.ts   foreground FCM + in-app banner (respects pause)
src/hooks/useCustomPatterns.ts  saved custom rhythms (AsyncStorage)
src/hooks/usePrivacy.ts         privacy state + disguise/pause actions
src/hooks/useAppUpdate.ts       update check throttle, download/install state
src/theme/ThemeProvider.tsx     palettes, radii, spacing, fonts, text scale, persistence
src/ui/Text.tsx                 themed text with font family + scale
src/ui/RoundButton.tsx          header action buttons
src/lib/                        patterns, custom rhythms, pairing codes, haptics, battery state, privacy bridge, update bridge, delivery receipt
database.rules.json             RTDB security rules
storage.rules                   Storage rules (anonymous read of app-updates/**; listing and all other paths denied)
functions/index.js              silent FCM relay (RTDB onValueCreated, custom payload validation)
functions/publish-update.mjs    APK upload + appUpdates/latest metadata
android/app/src/main/java/com/vibelink/VibeLinkVibratorModule.kt
                                background-safe vibration with amplitudes
android/app/src/main/java/com/vibelink/VibeLinkBatteryModule.kt
                                battery state + unrestricted settings intent
android/app/src/main/java/com/vibelink/VibeLinkPrivacyModule.kt
                                disguise/pause state bridge
android/app/src/main/java/com/vibelink/LauncherVisibility.kt
                                activity-alias swap (VibeLink ↔ System services)
android/app/src/main/java/com/vibelink/DecoyActivity.kt
                                disguised icon opens the phone's Settings
android/app/src/main/java/com/vibelink/RevealTileService.kt
android/app/src/main/java/com/vibelink/DeliveryTileService.kt
                                Quick Settings recovery + pause tiles
android/app/src/main/java/com/vibelink/SecretCodeReceiver.kt
                                *#*#4263#*#* recovery on stock dialers
android/app/src/main/java/com/vibelink/VibeLinkUpdaterModule.kt
                                version info, DownloadManager download, SHA-256 check, installer hand-off
android/app/src/main/res/xml/updater_paths.xml
                                FileProvider paths for downloaded APKs
firebase.json                   rules + functions deployment config
```

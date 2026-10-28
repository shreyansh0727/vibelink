# VibeLink

Up to eight Android phones, one private link. Press the pulse button on one phone and every other linked phone vibrates — with no notification, no notification permission prompt, and no foreground service.

VibeLink pairs devices with a short code, stores the link in Firebase Realtime Database, and relays each pulse through a small Cloud Function that sends **data-only, high-priority FCM messages**, one per receiving phone. The receiving app turns each message into a vibration in its background handler. Nothing is ever posted to the notification shade.

It also ships **fourteen built-in haptic rhythms** plus an advanced rhythm editor (per-pulse length, gap and strength, with repeats) and offline previews, a **remote flashlight toggle** for the other linked phones with optional flash-with-pulses sync, a **full appearance system** (palette, corner shape, layout size, font style and text size) that applies instantly and persists, a **privacy mode** that turns the launcher icon into a decoy system app which opens the phone's own Settings, plus a pause switch for delivery that works from Quick Settings, an **in-app updater** that checks Firebase once a day, verifies the download's SHA-256 and hands the APK to Android's installer, and **over-the-air JS bundles** that update screens and feels without rebuilding the APK.

## How it works

```
 Phone A                      Firebase                      Phones B…H
 ───────                      ────────                      ──────────
 press pulse
     │
     └── write ──────►  pairs/{code}/triggers/{id}
                              │
                              │ onValueCreated
                              ▼
                        relayPulse function
                              │
                              │ data-only FCM, one per other phone
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
                      Phone A: “pulse delivered to 3 of 4”
```

- **Pairing** — anonymous Firebase Auth gives each install a UID. One phone creates an 8-character code (the RTDB pair ID) and becomes its first member; every other phone joins by writing its own member node under that code. The app reads the member list first and refuses a ninth phone. There are no reserved seats, and the controller lists every other phone by name.
- **Presence** — `.info/connected` and `onDisconnect` keep an online flag per member.
- **Silent delivery** — the Cloud Function finds every member except the sender, reads each phone's private FCM token from `notificationTokens/{uid}`, and sends a high-priority **data-only** message per token. There is no `notification` block, so Android has nothing to display; missing tokens are skipped and dead ones are removed.
- **Vibration** — `index.js` registers the background FCM handler before the app; it calls a small native module that plays the received waveform with amplitudes (`VibrationEffect.createWaveform` on Android 8+) using `USAGE_NOTIFICATION`, because Android ignores React Native's default `USAGE_MEDIA` haptics from background processes. When the app is already open, `onMessage` vibrates and shows a small in-app banner instead.
- **Delivery receipt** — the relay puts the trigger's push ID in the FCM payload. Right after the waveform plays (foreground or background), the receiving phone writes `lastDeliveredTrigger` and `lastDeliveredAt` onto its own member node; the sender watches the pair, so the controller counts matching receipts and switches from “pulse sent” to “pulse delivered to N of M”. The write is self-only and best-effort: a paused phone, an unlinked phone, or a failed write simply leaves that phone out of the count. It confirms the phone played the vibration, not that the user felt it through Do Not Disturb.
- **Haptics** — fourteen built-in rhythms (`tap`, `double`, `knock`, `snap`, `wave`, `heartbeat`, `pendulum`, `sonar`, `ripple`, `crescendo`, `rain`, `shiver`, `sos`, `long`) are defined as timing/amplitude arrays in `src/lib/patterns.ts`. They deliberately vary along three axes: pulse length (a 45 ms snap through a 1.2 s hum), strength (from 60/255 to 255/255, including ramps and alternating strong/soft pulses), and spacing (regular, accelerating, uneven "rain", and the fast 35 ms tremble). The rhythm editor builds a timeline from up to eight pulses, each with its own length, gap and strength, optionally repeated; the sender stores the sanitized arrays on the trigger and the relay forwards them as JSON strings, so every receiver replays the sender's rhythm exactly. Previews work offline, without a pair.
- **Flashlight** — the controller's flashlight card writes a `{ kind: 'torch', torch: true|false }` command to `pairs/{code}/controls`; the `relayControl` function checks the sender's membership and forwards `{ type: 'torch' }` to every other phone. The receiving app switches the camera torch through `CameraManager.setTorchMode` — which needs the `CAMERA` runtime permission, granted ahead of time from Settings — and turns it off automatically after five minutes. With **Flash with pulses** on, each incoming pulse also replays the vibration's on/off timing on the torch, restoring the remote-on state afterwards.
- **Pattern language** — every built-in rhythm has a default meaning (“Tap” means *Yes*, “Double” means *No*, “SOS” means *Help*, and so on), listed in `src/lib/language.ts`. Any linked phone can rewrite one from the linked screen (**Edit meaning**), which writes `pairs/{code}/legend/{pattern}` for the whole pair — so the agreement is shared, not local. The sender sees the agreed meaning under the rhythm row, and the relay forwards it on the trigger so the receiving phone's banner reads *“Yes from Alex”* instead of *“Tap from Alex”*. Custom rhythms have no meaning; instead **Share** copies their timing/amplitude arrays to `pairs/{code}/shared`, and every other phone can save the rhythm into its own haptic lab or delete the entry. A share names its sender, is validated on write, and can be removed by any member.
- **Appearance** — a theme context (`src/theme/ThemeProvider.tsx`) exposes palette, shape, spacing, font family and text scale to every component through `useThemedStyles`. Choices apply instantly, persist in AsyncStorage, and the app holds a neutral splash until they load, so there is no flash of the default theme.
- **Privacy mode** — two activity-aliases target different activities: **VibeLink** → `MainActivity`, and a **System services** decoy (neutral gear, grey-blue tile) → `DecoyActivity`, which immediately opens the phone's own Settings. Exactly one alias is enabled at a time, so the launcher always shows a single, working icon: with privacy off it is VibeLink; with privacy on, tapping the gear opens Settings and nothing reveals the app. Switching aliases never touches `MainActivity`. The app itself stays reachable through the **VibeLink app** Quick Settings tile or the secret dial code, and the **VibeLink delivery** tile pauses/resumes pulses without opening anything. Both the foreground and background FCM handlers consult the native pause flag before vibrating.
- **Background access** — a second native module reports Android's battery state (unrestricted, optimized, or restricted) and opens the system **Allow background activity** dialog. The pairing, waiting, and linked screens show a status card with an **Allow unrestricted** action, because aggressive OEM battery management is the usual reason pulses miss while the screen is off.
- **Updates** — on launch, at most once every 24 hours, the app reads `appUpdates/latest` from RTDB. If `versionCode` is higher than the installed build, it shows a dismissible banner (and an always-visible card in Settings). Tapping update downloads the APK with Android's `DownloadManager` into the app's private external files directory, checks the SHA-256 against the published value, and passes the file to the system installer through a `FileProvider`. Android requires the user to approve the install, and the first update needs the **Install unknown apps** permission for VibeLink.
- **JS bundle OTA** — `appBundles/latest` points at a Hermes bytecode bundle in Storage. Settings → **APP** can download it in-app (HTTPS, SHA-256 verified, 32 MB cap), store it under `filesDir/ota/<id>/index.android.bundle`, and activate it for the next launch. `MainApplication` asks `OtaBundleStore` for the bundle path before React starts, so a downloaded bundle replaces the APK's embedded JS without touching the native side. If a bundle never reaches the first JS statement (`confirmOtaLoaded()` clears the guard), two failed launches reject it and VibeLink falls back to the embedded bundle on the third launch. Bundles only apply to the APK `versionCode` range they were published for.

### Database layout

```
pairs/{pairCode}
  meta:    { createdAt, createdBy }
  members/{uid}: { uid, name, platform, online, joinedAt, lastSeen }   // up to eight
                // plus lastDeliveredTrigger, lastDeliveredAt once a pulse arrives
  triggers/{id}: { from, fromName, pattern, createdAt }   // deleted by the function
                // custom pulses add timings[], amplitudes[], patternLabel
                // built-in pulses add meaning (the pair's agreed text)
  controls/{id}: { from, fromName, kind: "torch", torch, createdAt }
                                                         // deleted by the function
  legend/{pattern}: "Come here"                          // pair-wide meaning, ≤32 chars
  shared/{id}: { from, fromName, label, timings[], amplitudes[], createdAt }
                                                         // rhythm shared to the pair
notificationTokens/{uid}: { token, updatedAt }           // private to that device
appUpdates/latest: { versionCode, versionName, apkUrl, sha256, sizeBytes, notes, publishedAt }
                                                         // read-only to clients; written by the publish script
appBundles/latest: { id, versionName, url, sha256, sizeBytes, minVersionCode,
                     maxVersionCode, notes, publishedAt, reactNative }
                                                         // read-only to clients; written by the bundle publisher
```

## Requirements

- Android Studio with JDK 17, Node 22+, and Android SDK platform 37 (Gradle downloads the matching platform/build-tools on first build if licenses are accepted)
- A Firebase project on the **Blaze** plan (Cloud Functions cannot deploy on Spark)
- Two or more Android devices (up to eight per code) with Google Play services (physical devices strongly recommended; FCM support is unreliable on plain emulator images)
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

### 5. Build and install on each phone

Start Metro, then install the debug APK on every phone you want to link:

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

1. On the first phone, choose **Create a pair**. An 8-character code appears; share it with the other phones.
2. On every other phone, choose **I have a code** and enter it. All joined phones switch to the linked screen. Up to eight phones can share one code.
3. Pick a rhythm — **Tap**, **Double**, **Knock**, **Snap**, **Wave**, **Heartbeat**, **Pendulum**, **Sonar**, **Ripple**, **Crescendo**, **Rain**, **Shiver**, **SOS**, **Long**, or any custom rhythm you saved — and press the large circular pulse button.
4. Every other linked phone vibrates. Phones with VibeLink in the foreground also show a brief in-app banner; backgrounded phones and phones with the screen off only vibrate. The sender's status line reports “pulse delivered to N of M” as receipts arrive.
5. Do this on **every** phone: in the **Background delivery** card, tap **Allow unrestricted** and confirm the system prompt. This removes Android's battery optimization for VibeLink so FCM pulses are not deferred. On Samsung, also exclude VibeLink from **Sleeping apps** / **Deep sleeping apps**; on Xiaomi, OPPO, vivo, and similar builds, also allow autostart. The card names the relevant menu for the detected manufacturer.
6. To use the other phones' flashlights, grant camera access once from **Settings → FLASHLIGHT → Allow flashlight access** on each phone that should be controllable. Then tap **ON** under **Their flashlight** on any controller; it switches off by itself after five minutes. Any member can control any other member's torch.
7. Use **Unlink this phone** on any phone to detach it. The rest of the link stays intact, and the freed spot can be taken by another phone using the same code.

### Haptic lab

Open **Haptic lab** from the wave button in the header, from **Preview haptics without pairing** on the pairing screen, or from Settings.

- Every built-in rhythm has a **Play** button, so you can feel it before you pair.
- **Build a custom rhythm** starts with three pulses. Add or remove pulses (up to eight), then set **length** (40–600 ms), **gap after** (30–800 ms) and **strength** (0–100%) for each one, and optionally **repeat rhythm** (1–3×). The card shows the resulting pulse count and total duration, and Preview/Save are disabled when the rhythm would exceed the 40-segment waveform limit (for example eight pulses repeated three times).
- The saved rhythm appears in the linked screen's rhythm row with a `CUSTOM` tag, and every other phone feels the exact same waveform, including the per-pulse strengths.
- Saved rhythms are capped at eight and stored locally; removing one only affects this phone.

### Pattern language

The linked screen pairs every built-in rhythm with a meaning, and the meaning lives in the pair rather than on one phone:

- Under the rhythm row, a line reads **“Knock means ‘Come here’”**. **Edit meaning** opens a small editor (up to 32 characters); saving writes `legend/{pattern}` for the pair, so the sender and every receiving phone see the same wording. Leaving the field empty deletes the override and restores the default.
- The meaning rides along with the pulse. When the receiving app is open, its banner shows the agreed meaning instead of the rhythm name — “Help from Sam”, not “SOS from Sam”. Backgrounded phones still only vibrate, so the meaning is a foreground convenience, not a replacement for the felt rhythm itself.
- Custom rhythms have no meaning. They show **Share** instead, which offers the saved rhythm to the other phones under **FROM THE LINK**. Each phone can **Save** it into its own haptic lab (it then appears in the rhythm row) or remove the entry; saved copies are local and independent, so editing or deleting one phone's copy never touches the sender's.
- Meanings and shares belong to the link, so a phone that joins later sees the current language immediately, and unlinking removes access to it.

### Flashlight

Settings → **FLASHLIGHT**:

- **Flash with pulses** (off by default) makes this phone's torch blink along with every incoming pulse. The torch follows the vibration's on/off timing; brightness is binary because the LED has no amplitude. The first time you turn it on, Android asks for camera access — VibeLink only uses it to switch the torch and captures nothing.
- **Allow flashlight access** requests the `CAMERA` permission without enabling flash sync. You need it on any phone whose torch should be controllable from the link, because a background message cannot show a permission prompt.
- **Flash with pulses** and remote control both need camera permission: one to blink this phone's torch, one to switch it. Turning flash sync off does not revoke access, so remote control keeps working.

On the controller, the **Their flashlight** card sends **ON** or **OFF** to every other linked phone. A flashlight switched on remotely turns itself off after five minutes, and any linked phone can turn it off sooner.

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

To publish a release, run one script:

```sh
npm run update:app -- --notes "Faster pairing"
```

`scripts/update-app.mjs` reads `appUpdates/latest`, raises `versionCode` and `versionName` in `android/app/build.gradle` when the published build is the same or newer, runs `./gradlew assembleRelease` (never `bundleRelease`, so no AAB), uploads `app-updates/vibelink-<versionCode>.apk`, and writes `appUpdates/latest` with the SHA-256 and size. It then re-reads the metadata and checks that the file downloads without credentials. Flags: `--bump` raises the version even when it is already ahead, `--skip-build` re-uploads the existing APK, `--dry-run` prints the plan without building or writing anything. Authentication goes through the signed-in `gcloud` CLI (`gcloud auth login`) or `GOOGLE_OAUTH_ACCESS_TOKEN`; no service account JSON is needed. The release build signs with the debug keystore configured in `build.gradle`, which matches the installed builds.

`functions/publish-update.mjs` performs the same upload and metadata write through the Firebase Admin SDK when `GOOGLE_APPLICATION_CREDENTIALS` (or `--credentials`) is available:

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

The Admin SDK variant uploads the same object and metadata; `--database-url` is the `<instance>.firebaseio.com` URL shown under **Realtime Database** in the console, and `--bucket`/`FIREBASE_STORAGE_BUCKET` override the bucket.

Clients need only read access: `appUpdates` is readable by signed-in users in `database.rules.json` and has no client write rule. `storage.rules` allows reads only under `app-updates/` because `DownloadManager` sends no Firebase credentials; listing, writes, and every other path stay denied.

#### JS bundle updates (OTA)

The second card in Settings → **APP** checks `appBundles/latest`. It shows the bundle that is running (or "Built-in bundle"), offers a download when a newer bundle applies to the installed `versionCode`, and then asks for a restart.

1. **Get `<version>`** downloads the Hermes bytecode over HTTPS into app-private storage while the card shows progress. The size is capped at 32 MB and the file must match the published SHA-256; a mismatch deletes it.
2. On success the bundle is recorded as **pending**. **Restart and apply** starts `MainActivity` in a fresh process, where `OtaBundleStore.prepareLaunch()` promotes the pending bundle and hands its path to `DefaultReactHost` via `jsBundleFilePath`. **Discard download** drops a pending bundle without applying it.
3. **Use built-in** clears the preference and restarts on the bundle embedded in the APK.

If a downloaded bundle throws before the first line of `index.js` runs, the guard in `OtaBundleStore` counts the attempt. After two failed launches the bundle is marked rejected, deleted, and the app starts on the embedded bundle; Settings explains what happened and offers **Dismiss**. OTA only changes JavaScript, so anything that needs new native code (permissions, modules, manifest entries) still needs a new APK.

To publish a JS bundle, run one script:

```sh
npm run update:ota -- --notes "Faster retries"
```

`scripts/update-ota.mjs` builds the release bundle with Metro, rejects image assets (VibeLink ships none today), compiles it with the local `hermesc` from `node_modules/hermes-compiler`, uploads `app-bundles/<id>/index.android.bundle`, and writes `appBundles/latest` with the checksum, size and APK `versionCode` range. It then verifies the download and the metadata read-back, and exits without writing anything only when the label, the `versionCode` range and the SHA-256 all match what is published. Defaults: label `<app-version>-ota-<MMddHHmm>`, range from the current `versionCode` to 2147483647. Use `--version-name`, `--min-version-code` and `--max-version-code` to override them, `--bundle <file>` to publish a prebuilt Hermes bytecode file, and `--dry-run` to print the plan. Narrow the range to the builds the bundle is safe for; a bundle built from a different React Native version can be rejected by the runtime, which the boot guard then catches.

`functions/publish-bundle.mjs` does the same through the Firebase Admin SDK (needs `GOOGLE_APPLICATION_CREDENTIALS` or `--credentials`).

`appBundles` is readable by signed-in users and has no client write rule. `storage.rules` allows anonymous reads under `app-bundles/` because the app's own downloader carries no Firebase credentials; listing, writes, and every other path stay denied.

## Security model

- The 8-character pair code is the link's **bearer secret**. It is generated from a CSPRNG using a 32-character alphabet (~40 bits), so it cannot be guessed in practice. Share it only with the phones you are linking, and remember that every member can pulse and control every other member.
- RTDB rules make member writes self-only, refuse member writes before the pair's `meta` exists, validate triggers and flashlight commands, and keep FCM tokens readable only by their owner, so a paired peer can never read another phone's token. The eight-phone cap is applied by the app when joining, because the rules language cannot count children; a modified client could exceed it. To support that pre-join count, the member list (names and models) is readable by any signed-in user who knows the pair code.
- The Cloud Function re-validates the sender's membership and the pattern before sending, and sends one message per recipient token. The control relay re-checks membership and the command shape before forwarding it. Custom rhythms are only forwarded if they are finite, non-negative arrays that start at `0`, fit within 41 entries / 30 seconds, and carry a matching amplitude array (clamped to 0–255); anything else falls back to `tap`. Triggers and control commands are create-only for clients and are deleted by the function after processing.
- **The pattern language is member-writable by design.** Any member can rewrite a built-in rhythm's meaning, so a link is only as trustworthy as its members — a peer can rename "SOS" to something else, and the sender's screen will show that wording. `legend` keys are restricted to the fourteen built-in ids and values to 32 characters, so the field cannot be used as free-form storage or to inject markup. `shared` entries must name their sender, carry a label of 1–24 characters and a timing list, and can be created only by the writing member and deleted by any member; the app additionally re-validates timings (start at `0`, at most 41 entries and 30 seconds) and amplitudes (length-matched, 0–255) before offering a Save action. A shared rhythm is inert data — nothing plays until a phone chooses to save it.
- **Delivery receipts are self-reported.** Each phone can write only its own member node, so a paired peer cannot mark another phone's pulse as delivered, and a receipt contains just a trigger ID and a timestamp. A modified client could still claim delivery it never played — treat the count as a courtesy signal, not proof.
- **The flashlight is a remote capability.** Any member can switch the torch of every other phone on or off, and a remote-on schedules a five-minute auto-off. The target must have granted the camera permission, which also allows flash-with-pulses. Unlink a phone you no longer trust, or revoke its camera permission in Android Settings to disable both.
- **Privacy mode is obscurity, not encryption.** Disguising replaces the launcher icon with a decoy that opens the phone's Settings, and pausing drops pulses silently — both only on that phone. The app still holds its Firebase identity and FCM token, and anyone with the APK, adb access, or the app's settings can restore the real icon. It does not hide VibeLink from Settings → Apps, and it cannot stop Android from listing the app in battery or notification settings.
- **Update integrity is checksum plus signature.** Metadata lives in `appUpdates/latest`, which only the Admin SDK can write; the app itself can only read it. The APK is fetched over HTTPS and must match the published SHA-256 before the installer sees it. Even if the metadata were tampered with, Android refuses to replace the app with an APK that is not signed by the same release key, so the release keystore remains the real trust anchor. The update path in Storage is publicly readable because `DownloadManager` carries no Firebase credentials; listing is denied, the rest of the bucket is closed, and the files contain only the app binary.
- **JS bundles are checksum-gated but not signed.** `appBundles/latest` is written only by the Admin SDK and requires Firebase auth to read; the download is HTTPS and must match the published SHA-256 before it is stored, and the boot guard removes bundles that cannot start. The trust anchor is the same Firebase project, not a separate code-signing key, so anyone with Admin credentials or write access to the Storage object and the database can publish JS. Treat that access like release access. Bundles are restricted to the APK `versionCode` range they declare and can never add native capabilities.
- Anonymous authentication is per-install identity, not account security. Anyone who obtains a code while the pair has fewer than eight members can join it. Unlinking removes only that member; the pair node lingers in the database, so you may manually delete old pairs in the console. Reinstalling the app or clearing app data creates a new anonymous UID and requires pairing again.
- Traffic is encrypted in transit by Firebase. This is not end-to-end encryption: the database and project administrators can see member names, presence, and pulse patterns. No vibration content or message text exists beyond the pattern name.

## Limitations

- **Android only.** The repository contains the standard RN iOS scaffold, but no iOS Firebase setup or vibration handler is implemented.
- **Force-stopped apps cannot receive FCM.** Android blocks messages to an app the user has explicitly force-stopped in Settings until it is opened again. On stock Android, swiping from recents is fine; some OEM builds treat it as a kill, so allow autostart there.
- **A reinstall creates a new identity.** Clearing app data or reinstalling VibeLink generates a new anonymous UID and FCM token. The old pair still contains the previous UID, so pulses target a dead token until you unlink on the other phone and pair again. The function now removes tokens that FCM reports as unregistered; the receiving app also re-uploads its token every time it returns to the foreground.
- **OEM battery management can delay or drop background messages.** Every phone should use the in-app **Allow unrestricted** action, and aggressive brands also need autostart, sleeping-app, or background-usage allowances. The card detects the manufacturer and shows the extra step. Doze mode can still delay data messages despite high priority.
- **“Delivered” reflects the receiving apps, not the people.** The sender counts receipts from phones that wrote them after playing the waveform. A paused phone, an unlinked phone, a missing FCM token, or a failed receipt write leaves that phone out of the count, and nothing confirms the pulse was felt — Do Not Disturb or a vibration setting can still swallow it. Receipts also require the deployed relay to forward `triggerId`; if yours predates that, pulses still arrive but never report delivery.
- **Remote flashlight needs camera access and a working LED.** A phone with no flash, a denied camera permission, or a camera app that already holds the torch ignores the command, and flash-with-pulses additionally needs its toggle enabled on that phone. ON/OFF applies to every other linked phone; there is no per-phone targeting. Remote-on schedules a five-minute auto-off; if Android kills the app process inside that window, the LED can stay on until the system or the user turns it off.
- **A meaning is a foreground label, not a hidden message.** The agreed text rides on the data push and appears only in the in-app banner; a backgrounded phone vibrates without showing it. Any member can rewrite a meaning, and everyone in the pair (plus project administrators) can read the legend and the shared inbox — it is a shared vocabulary, not a private channel.
- **A shared rhythm is copied, not linked.** **Save** writes a normal local custom rhythm, so later edits, deletions, or a new share from the sender never update the saved copy. Shares are also visible to every member until someone removes them, and the inbox shows the newest eight.
- **The eight-phone cap is enforced by the app, and member names are visible to code holders.** Realtime Database rules cannot count children, so joining reads the member list and refuses a ninth phone client-side; a modified client could add more. The same pre-join count means anyone who knows the pair code can read the member names and phone models before joining, even if the pair is full.
- Cloud Functions requires the Blaze plan. At normal personal use, traffic is well within the free tiers, but billing must be enabled.
- Vibration may be suppressed by Do Not Disturb, silent mode, or a device-wide vibration setting. This is controlled by Android, not the app. Amplitude support also depends on the device's vibration motor; phones without one play the timings at full strength.
- **Background apps cannot read the volume keys.** Android only delivers hardware key events to the foreground, or to an AccessibilityService (which would need permanent "observe your input" access). That is why privacy mode uses Quick Settings tiles instead of a volume-button combo for starting/stopping delivery and for bringing the app back. The tiles need to be added to the Quick Settings panel once, while the icon is still visible.
- **The secret dial code is not universal.** It is handled by the system broadcast `android.provider.Telephony.SECRET_CODE`, which stock Android dialers send when the full code is entered. Samsung and some other dialers try to place a call instead. Use the "VibeLink app" Quick Settings tile as the dependable way in — add it **before** enabling privacy mode. There is no lockout risk: the decoy icon always launches the phone's Settings, and turning Privacy mode off restores the real icon.
- Disguising does not affect delivery: FCM still wakes the app, and the icon change has no bearing on the pause flag. Use the delivery tile to pause or resume while the app is closed.
- **Self-updates apply to sideloaded APK builds only.** Android replaces an app only when the new APK is signed with the same key and has a higher `versionCode`; builds installed through Google Play must be updated through Play instead. Android also requires an explicit install confirmation and, on Android 8+, the per-app **Install unknown apps** permission — nothing installs silently.
- **JS OTA cannot change native behaviour.** A bundle can change screens, copy, presets, theme handling and JS logic, but not permissions, manifest entries, native modules or Gradle dependencies. It also only runs on the APK versions in its declared range, and each apply needs a cold start (VibeLink restarts itself from the card). The boot guard covers startup crashes only; a bundle that throws later in use can still be cleared with **Use built-in**.
- **The update check is throttled to once a day.** A freshly published build may not prompt until the next day; use Settings → **Check for updates** to check immediately. Reinstalling or clearing app data resets the throttle, and manual checks never count against it.
- **A home-screen icon survives a disguise switch.** The decoy is a different launcher component, so a home-screen icon pinned to the real VibeLink icon is left pointing at a disabled component and opens **App info** when tapped. Apps cannot repoint or delete launcher workspace items — remove the old home-screen icon before enabling privacy mode, then pin the *System services* gear if you want one on the home screen.
- **A custom rhythm is capped at 40 waveform segments.** The editor accepts up to eight pulses and three repeats, but combinations above 20 pulses (for example eight pulses × three repeats) are disabled; the relay also rejects timelines over 41 entries or 30 seconds.
- The Cloud Function region is fixed at deployment time. If your RTDB region or policy requires another location, update `functions/index.js` and redeploy.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `firebase deploy` fails with 401 / “invalid authentication credentials” | The CLI session has expired. Run `firebase login --reauth`, complete the browser sign-in, then deploy again. |
| “Cannot understand what targets to deploy” in PowerShell | PowerShell splits unquoted commas. Use `firebase deploy --only "database,functions"`. |
| “Firebase could not sign in” | Enable Anonymous sign-in, confirm `android/app/google-services.json` belongs to package `com.vibelink`, then rebuild the app. |
| “Silent delivery is blocked” / permission denied on token | Run `firebase deploy --only database` and confirm the Messaging API is enabled. |
| “The link went quiet” | Deploy the function, confirm every phone has internet, and check that RTDB rules were deployed. |
| Join fails | The code must be 8 valid characters. The app accepts up to eight phones per pair; a pair that already has eight rejects the join until one phone unlinks. |
| Join fails with permission denied right after updating | Deploy the new database rules — the client no longer reserves seat nodes, and the reworked member and `controls` rules are required. |
| Settings says “This phone has no flashlight to sync or switch” | The phone has no LED flash, or the native torch module is missing from that build. |
| Remote ON/OFF does nothing | On the target phone, grant **Settings → FLASHLIGHT → Allow flashlight access**, then try again. A camera app holding the torch also blocks the command. Confirm the `relayControl` function is deployed. |
| Flash with pulses does nothing | Turn on **Settings → FLASHLIGHT → Flash with pulses** and grant camera access on that phone. The torch follows the vibration timing, so silent gaps in a rhythm stay dark. |
| Editing a meaning or sharing a rhythm fails | Deploy the current `database.rules.json` — the `legend` and `shared` nodes do not exist in older rules, so writes are denied. |
| A saved meaning still shows the rhythm name on the other phone's banner | Redeploy `functions/index.js`: the relay only forwards `meaning` from the 1.2-era update onward. The sender's own row updates either way, because it reads the legend directly. |
| The flashlight turns itself off after five minutes | Remote-on has a five-minute auto-off by design; send ON again to keep it on. |
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
| The JS bundle card says the bundle metadata is invalid | `appBundles/latest` must use `https://` for `url`, a 64-character `sha256`, a safe `id`, and positive `minVersionCode`/`maxVersionCode` with min ≤ max. Re-run `publish-bundle.mjs`. |
| The JS bundle card shows no update | The installed `versionCode` must be inside the published range, and the bundle must differ from the running or pending one. Use **Check again**; metadata is read each time the card mounts. |
| The JS bundle download fails | Confirm the Storage object and token URL are current (republish), check the connection, and make sure `storage.rules` allows reads under `app-bundles/`. Downloads are capped at 32 MB. |
| “The downloaded JS bundle did not match the published checksum” | The metadata and the uploaded bytecode disagree — republish the bundle, or retry if the transfer was truncated. |
| Tapping **Restart and apply** closes VibeLink | That is the cold start the OTA needs. Open VibeLink again; Settings → APP should name the new bundle as the running one. |
| VibeLink opens on the built-in bundle after an OTA | The boot guard rejected the bundle after two failed starts, or **Use built-in** was tapped. Settings shows the rejected bundle and a **Dismiss** action; republish a bundle that matches the APK's React Native version. |
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
node --check functions/publish-bundle.mjs
node --check scripts/update-app.mjs && node --check scripts/update-ota.mjs
cd android && ./gradlew :app:compileDebugKotlin && cd ..
npx react-native bundle --platform android --dev false --entry-file index.js \
  --bundle-output android/app/build/tmp/verify/index.android.bundle \
  --assets-dest android/app/build/tmp/verify/res

# Rules load check (needs JDK 21+ on JAVA_HOME)
firebase emulators:exec --only database --project demo-vibelink "echo rules ok"
```

A JS bundle for OTA is built the same way and then compiled:

```sh
node_modules/hermes-compiler/hermesc/win64-bin/hermesc.exe -O -emit-binary -w \
  -out index.android.bundle index.android.bundle.js
```

`publish-bundle.mjs` picks the matching `hermesc` for Windows, macOS or Linux automatically.

Known verification status in this workspace:

- TypeScript, ESLint, 45 unit tests, `:app:compileDebugKotlin` and a release-mode Metro bundle pass with the multi-phone, torch, flash-sync, rhythm-editor, expanded-preset and JS-bundle-OTA code.
- `database.rules.json` loads in the local Database emulator (JDK 23) and includes the `controls` node and the receipt-friendly member validation. An earlier draft used `numChildren()`, which the rules language does not support; that is why the eight-phone cap is applied by the app. The rules are now live (see the deployment note below); `storage.rules` (the `updates` target) is deployed, and an unauthenticated RTDB read of `appUpdates/latest` returns 401.
- `firebase.json` and `database.rules.json` parse, and `functions/publish-update.mjs --help` runs against the installed Admin SDK.
- The release APK builds and installs, and the new adaptive icon renders in the launcher and app drawer.
- Background vibration was verified on a Samsung SM-S921E (Android 17): with the app backgrounded, system logs show `usage=NOTIFICATION` and `status FINISHED` for the native waveform. While the phone was in Doze with the screen off, an incoming pulse still logged `RNFirebaseMsgReceiver` and played the full waveform without waking the display.
- The relay was verified across two devices on 2026-10-28 — the SM-S921E and an Android 13 emulator. Pairing with an 8-character code completed on both, both devices showed each other's model name on the controller, and pulses were delivered in both directions (`Silent pulse delivered to FCM.` in Cloud Run logs plus matching vibration or in-app banner).
- A custom rhythm was exercised end-to-end: a 3-pulse rhythm (180 ms pulses, 120 ms gaps, 70% strength) saved as "Trio" appears on the controller with a `CUSTOM` tag and produced exactly three 180 ms vibration segments (120 ms gaps) on the receiving phone; the function logged `pattern=custom, custom=True`.
- Appearance changes apply live and survive a force-stop on the same device. The neutral splash now waits for stored settings, so the default palette no longer flashes before the saved theme.
- Icon hiding was exercised on the same device in an earlier build: the launcher alias disappeared and the app exited; the **VibeLink app** Quick Settings tile restored it. The dial code was **not** delivered by Samsung's dialer (it tried to place a call), so the tile is the documented recovery path.
- Also observed on the SM-S921E with that build: after hiding, the drawer, app list and launcher search dropped VibeLink, but a previously placed home-screen icon stayed and taps opened **App info**. Logcat showed the launcher item retargeted to `com.vibelink/android.app.AppDetailsActivity` once the alias was disabled. That is why the current build **disguises** the icon instead of removing it — the disguised alias stays enabled, so its icon always launches the app. The pinned-icon caveat still applies when switching between the two aliases.
- The pause switch in Settings and the controller's `DELIVERY PAUSED` status update live when the **VibeLink delivery** tile is toggled while VibeLink is open; the tile broadcasts the change and the app emits it to JS, so no app restart or resume is needed.
- The disguise swap was exercised on the SM-S921E: with privacy mode on, `dumpsys package` listed `LauncherAlias` as disabled and `SystemAlias` as enabled, the drawer entry launched `SystemAlias`, and the decoy opened `com.android.settings` with no VibeLink entry left in recents.
- The delivery receipt compiles and type-checks (TypeScript, ESLint, 45 tests) but has **not** been exercised on a device yet: the receiver writes `lastDeliveredTrigger` from both FCM handlers, and the controller flips to *pulse delivered* only when the peer's ID matches the trigger it just sent.
- The new built-in presets, the OTA metadata parser and the rhythm builder are covered by the unit tests (32 total), and a release bundle from this tree compiles to Hermes bytecode (`c61fbc03` magic) with the local `hermesc`; `publish-bundle.mjs --help` and both `node --check` calls pass. `database.rules.json` loads in the Database emulator with the new pattern list and `appBundles`, and the Storage emulator starts with the updated `storage.rules`.
- **The preset/OTA backend and release 1.3 are live.** On 2026-10-28 `firebase deploy --only "database,storage,functions"` released `database.rules.json` (all 14 pattern names plus `appBundles`) and `storage.rules` (anonymous read of `app-bundles/**`), and redeployed `relayPulse`/`relayControl`. Release `1.2` (versionCode 3, 63,755,325 bytes, SHA-256 `0c304b3c…2e7cad`) was built with `assembleRelease` (debug-keystore signed, JS bundle embedded) and published as `app-updates/vibelink-3.apk`; release `1.3` (versionCode 4, 63,755,325 bytes, SHA-256 `594e34f4…d1eb`) was then built and published as `app-updates/vibelink-4.apk` with `appUpdates/latest` moved to code 4. The 1.2 object has since been removed from the bucket, so installs on 1.1 update straight to 1.3; a ranged GET of `vibelink-4.apk` returns 206.
- **A JS bundle is published for codes 3–4.** `appBundles/latest` points at `app-bundles/v1.2-ota-10282301-0606c1b0/index.android.bundle` (label `1.2-ota-10282301`, 1,749,756 bytes, SHA-256 `0606c1b0…876e`, `minVersionCode` 3, `maxVersionCode` 4, React Native 0.88.0), which carries the pattern-language UI. The object answers an anonymous ranged GET with 206 and the metadata read back as written. The OTA download, activate and rollback paths are still compile-verified only — no phone has run a bundle yet. One earlier attempt, `app-bundles/v1.3-ota-10282211-ac884067/` (1.73 MB), is unreferenced and can be deleted from the bucket.
- Neither the 1.2 nor the 1.3 APK has been installed on a phone: the SM-S921E still runs versionCode 2, which will raise a banner on its next daily check or a manual **Check for updates** and move straight to 1.3. The AAB was **not** regenerated.
- The one-shot scripts `npm run update:app` and `npm run update:ota` were added on 2026-10-28 and have now both run for real: `update:app` built and published 1.3 (versionCode 4) from this tree, and `update:ota` built the Metro/Hermes bundle and published it. `update-ota.mjs` re-uploads when the label or the `versionCode` range changes, not only when the bytes change, because Metro output is not byte-identical between runs; superseded objects from a mistaken range were deleted from the bucket.
- **Pattern language and rhythm sharing are live on the backend.** `src/lib/language.ts` (default meanings, share validators), `usePairLegend`, `useSharedRhythms`, `MeaningEditor` and the linked-screen rows are compiled, covered by six new unit tests (45 total), and deployed: on 2026-10-28 `firebase deploy --only "database,functions"` released the `legend`/`shared` rules and the relay's `meaning` forwarding (both functions updated successfully; an unauthenticated `legend` read still answers 401). The JS reaches phones through the published `1.2-ota-10282301` bundle (codes 3–4) or the next APK. Neither path has been exercised on a device yet: meaning editing, the shared inbox and the meaning-carrying banner are compile-verified only.
- Multi-phone pairing and broadcast, the per-phone delivery count, remote flashlight, flash-with-pulses and the per-pulse rhythm editor are **compile-verified and backend-live, but not device-tested** — none has been exercised on a phone yet.
- **The new rules and functions are deployed.** On 2026-10-28 `firebase deploy --only "database,functions"` released the current `database.rules.json` (self-only member writes, app-level eight-phone cap, `controls`) and created `relayControl(us-central1)` while updating `relayPulse(us-central1)` with the per-phone fan-out. Multi-phone joins, the `controls` path and remote flashlight are live.
- The `versionCode 2` / `1.1` artifacts are superseded by the 1.2 release APK. `android/app/build/outputs/apk/debug/app-debug.apk` was not rebuilt and still reports code 2; it loads JS from Metro, so use it only for tethered testing, not for background-delivery checks.
- The updater compiles and packages: the APK contains `REQUEST_INSTALL_PACKAGES`, the `com.vibelink.updates` FileProvider and `res/xml/updater_paths.xml`. Update `1.1` (version code 2) was published on 2026-10-28 as `app-updates/vibelink-2.apk` (63,719,005 bytes, SHA-256 `fce7a0e8…7fc85`) with `appUpdates/latest` pointing at it.
- The full download → checksum → install round trip ran on the SM-S921E: the installed build 1 showed the **Downloading…** progress card, then the installer replaced it, and `dumpsys package` afterwards reported `versionCode=2` / `versionName=1.1`.
- `storage.rules` (the `updates` target), the current `database.rules.json` and `functions/index.js` are all deployed to `comboapp-451011` (rules and functions released 2026-10-28). The earlier two-device verification run predates the broadcast relay, so it exercised the single-partner backend.
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
src/hooks/useFlash.ts           torch state, camera access, flash-with-pulses toggle
src/hooks/useCustomPatterns.ts  saved custom rhythms (AsyncStorage)
src/hooks/usePairLegend.ts      pair-wide meaning per built-in rhythm
src/hooks/useSharedRhythms.ts   rhythms shared to the pair ("FROM THE LINK" inbox)
src/hooks/usePrivacy.ts         privacy state + disguise/pause actions
src/hooks/useAppUpdate.ts       update check throttle, download/install state
src/hooks/useOtaUpdate.ts       JS bundle check, download, activate, reset state
src/theme/ThemeProvider.tsx     palettes, radii, spacing, fonts, text scale, persistence
src/ui/Text.tsx                 themed text with font family + scale
src/ui/RoundButton.tsx          header action buttons
src/lib/                        patterns (built-ins + rhythm builder), language (meanings + share validation), pairing codes, haptics, torch bridge, battery state, privacy bridge, update bridge, bundle metadata, OTA bridge, delivery receipt
database.rules.json             RTDB security rules
storage.rules                   Storage rules (anonymous read of app-updates/** and app-bundles/**; listing and all other paths denied)
functions/index.js              silent FCM relay + torch control relay (RTDB onValueCreated)
scripts/update-app.mjs          one-shot APK release: bump, build, upload, appUpdates/latest
scripts/update-ota.mjs          one-shot JS bundle release: Metro + hermesc, upload, appBundles/latest
scripts/lib/publish.mjs         shared gcloud-token upload, RTDB and verification helpers
functions/publish-update.mjs    Admin SDK variant: APK upload + appUpdates/latest metadata
functions/publish-bundle.mjs    Admin SDK variant: Hermes JS bundle build/upload + appBundles/latest metadata
android/app/src/main/java/com/vibelink/VibeLinkVibratorModule.kt
                                background-safe vibration with amplitudes
android/app/src/main/java/com/vibelink/VibeLinkTorchModule.kt
                                camera torch, camera permission, flash-with-pulses schedule
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
android/app/src/main/java/com/vibelink/VibeLinkOtaModule.kt
                                JS bundle download, checksum, activation, restart, progress
android/app/src/main/java/com/vibelink/OtaBundleStore.kt
                                boot-path selection, attempt guard, rejected-bundle fallback
android/app/src/main/res/xml/updater_paths.xml
                                FileProvider paths for downloaded APKs
firebase.json                   rules + functions deployment config
```

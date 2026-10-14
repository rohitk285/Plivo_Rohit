# InspireWorks Plivo IVR Backend Application

A voice-based Interactive Voice Response (IVR) backend application built with **Node.js**, **Express**, and the official **Plivo Voice Node SDK** (`@plivo/plivo-node`).

This application implements an outbound voice call trigger, 4-digit OTP DTMF authentication loop, multi-language branching (English and Spanish), recorded audio playback (`<Play>`), and call forwarding to a live associate (`<Dial>`).

---

## 1. System Features & IVR Flow

```
                     [ /api/make-call ] 
                             │
                             ▼
                  [ Outbound Call Connects ]
                             │
                             ▼
                 ┌───────────────────────┐
         ┌──────►│  Level 0: OTP Prompt  │
         │       │  Enter 4 Digits (DDMM)│
         │       └───────────┬───────────┘
         │                   │
   Incorrect OTP             ▼
   (Re-prompts)  ┌───────────────────────┐
         └───────┤    /ivr/otp-verify    │
                 └───────────┬───────────┘
                             │
                        Correct OTP
                             │
                             ▼
                 ┌───────────────────────┐
                 │ Level 1: Select Lang  │
                 │ 1: English, 2: Spanish│
                 └───────────┬───────────┘
                             │
                      Valid Input (1/2)
                             │
                             ▼
                 ┌───────────────────────┐
                 │ Level 2: Select Action│
                 │ 1: Play MP3 Audio     │
                 │ 2: Call Live Associate│
                 └───────┬───────┬───────┘
                         │       │
          ┌──────────────┘       └──────────────┐
          ▼                                     ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│ /ivr/level2-process?1   │           │ /ivr/level2-process?2   │
│ Play Trumpet.mp3        │           │ Dial Associate Number   │
│ (<Play>)                │           │ 02264236412 (<Dial>)    │
└─────────────────────────┘           └─────────────────────────┘
```

---

## 2. Hardcoded Credentials & Defaults

| Key | Value | Purpose |
| :--- | :--- | :--- |
| **Plivo Auth ID** | `MAMTAWMGIOMZCTNTYZZS` | Account Identifier |
| **Plivo Auth Token** | `NDc4YTBIMTQtM2E1MS00ZDBILWI3YjgtNjQ3NDUW` | Authentication Token |
| **Plivo Caller ID** | `+918035454161` | Outbound Call Source |
| **Live Associate Number** | `02264236412` | Call Transfer Target |
| **Auth OTP** | `1503` | Format: `DDMM` (March 15) |
| **Audio File URL** | `https://s3.amazonaws.com/plivocloud/Trumpet.mp3` | MP3 audio stream |

---

## 3. Directory Layout

```
plivo/backend/
├── .env                  # Live environment configuration
├── .env.example          # Environment template
├── index.js              # Express entrypoint
├── server.js             # Entrypoint alias
├── cli.js                # Command-line call initiator
├── package.json          # Node dependencies and scripts
├── src/
│   ├── config.js         # Configuration and URL resolver
│   ├── plivoClient.js    # Plivo SDK initialization
│   ├── routes/
│   │   ├── callRoutes.js # /api/make-call, /api/call-status, /api/calls
│   │   └── ivrRoutes.js  # /ivr/* XML webhook endpoints
│   └── services/
│       ├── callTracker.js# In-memory call log and status manager
│       └── xmlTemplates.js # Official Plivo XML response generator
├── public/               # Phase 4 Web Dashboard
│   ├── index.html        # Interactive UI with call trigger & log viewer
│   ├── style.css         # Modern, responsive dark-mode styling
│   └── app.js           # Real-time polling & XML inspector
└── tests/
    └── ivr.test.js       # Complete unit test suite (13 passing tests)
```

---

## 4. Getting Started

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Run Tests
Validate all 13 IVR branches, DTMF handling, error recoveries, and XML outputs:
```bash
npm test
```

### Step 3: Start the Backend Server
```bash
npm start
```
The server will boot on `http://localhost:3000`. Open your browser to view the **InspireWorks IVR Console**.

---

## 5. Webhook Setup for Live Calls (Ngrok)

When making live phone calls, Plivo's cloud servers need to reach your local server.

1. In a separate terminal, expose port 3000 via ngrok:
   ```bash
   ngrok http 3000
   ```
2. Copy the public forwarding HTTPS URL (e.g., `https://abc-123.ngrok-free.app`).
3. Update `BASE_URL` in `.env`:
   ```env
   BASE_URL=https://abc-123.ngrok-free.app
   ```
4. Restart your backend (`npm start`).

*(Note: The server also includes an auto-detection fallback so requests routed via `ngrok` automatically resolve the public tunnel URL).*

---

## 6. How to Trigger an Outbound Call

### Option A: Via the Web Dashboard
1. Open `http://localhost:3000` in your browser.
2. Enter your phone number with country code (e.g., `+919876543210`).
3. Click **Initiate Call via Plivo**.
4. Watch the real-time event logs update as the call progresses.

### Option B: Via the CLI Tool
```bash
node cli.js +919876543210
# or
npm run call -- +919876543210
```

### Option C: Via cURL
```bash
curl -X POST http://localhost:3000/api/make-call \
  -H "Content-Type: application/json" \
  -d '{"toNumber": "+919876543210"}'
```

---

## 7. API & IVR Route Specification

| Endpoint | Method | Input Parameters | Description / Return |
| :--- | :--- | :--- | :--- |
| `/api/make-call` | `POST` | `toNumber`: Target phone string | Triggers Plivo outbound call via SDK. |
| `/api/call-status` | `POST/GET` | `CallUUID`, `CallStatus` | Webhook for Plivo call lifecycle status updates. |
| `/api/calls` | `GET` | None | Returns all call records and timeline events. |
| `/api/config` | `GET` | None | Returns non-sensitive system configuration. |
| `/ivr/otp-prompt` | `POST/GET` | None | Returns Plivo XML `<GetDigits>` for 4-digit OTP. |
| `/ivr/otp-verify` | `POST/GET` | `Digits`: entered 4 digits | If `1503`, redirects to Level 1. Otherwise re-prompts. |
| `/ivr/level1-lang` | `POST/GET` | None | Returns Plivo XML for language selection (1=EN, 2=ES). |
| `/ivr/level1-process` | `POST/GET` | `Digits`: 1 or 2 | Processes language; returns Level 2 Action Menu. |
| `/ivr/level2-process` | `POST/GET` | `Digits`: 1 or 2, `lang`: `en`/`es` | Option 1: `<Play>` MP3. Option 2: `<Dial>` Associate. |

---

## 8. Verification Scenarios & Test Checklist

- [x] **Outbound Call Triggering**: Successfully initiates call via `@plivo/plivo-node` `calls.create()`.
- [x] **Invalid OTP Recovery**: Entering `0000` plays *"Invalid OTP. Please try again."* and re-prompts for input without hanging up.
- [x] **Valid OTP (`1503`)**: Advances smoothly to Level 1 Language Menu.
- [x] **Level 1 Selection (1 = English)**: Renders English voice synthesizer (`language="en-US"`).
- [x] **Level 1 Selection (2 = Spanish)**: Renders Spanish voice synthesizer (`language="es-ES"`).
- [x] **Level 2 Action 1 (Audio)**: Plays hosted Trumpet MP3 via `<Play>`.
- [x] **Level 2 Action 2 (Transfer)**: Executes `<Dial>` forwarding to `02264236412`.
- [x] **Invalid Inputs**: Both Level 1 and Level 2 handle unexpected digits with polite re-prompts.

# InspireWorks Plivo IVR Application

A full-stack, voice-based Interactive Voice Response (IVR) application built with **Node.js**, **Express**, and the official **Plivo Voice Node SDK** (`@plivo/plivo-node`).

This application implements an outbound voice call trigger, 4-digit OTP DTMF authentication loop, multi-language branching (English and Spanish), recorded audio playback (`<Play>`), and call forwarding to a live associate (`<Dial>`).

---

## 1. System Architecture & IVR Flow

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

## 2. Configuration & Default Parameters

| Parameter | Default / Configured Value | Purpose |
| :--- | :--- | :--- |
| **Plivo Auth ID** | `MAMTAWMGI0MZCTNTYZZS` | Plivo Account Identifier |
| **Plivo Auth Token** | `NDc4YTBiMTQtM2E1MS00ZDBlLWI3YjgtNjQ3NDUw` | Plivo Authentication Secret |
| **Caller ID (Plivo Number)** | `+918035454161` | Outbound Source Phone Number |
| **Live Associate Number** | `02264236412` | Call Transfer Target |
| **Auth OTP** | `1503` | Hardcoded Birthdate (`DDMM` format) |
| **Audio File URL** | `https://s3.amazonaws.com/plivocloud/Trumpet.mp3` | MP3 audio stream for Action 1 |

---

## 3. Directory Layout

```
plivo/
├── client/                     # Web Dashboard (Frontend)
│   ├── index.html              # UI dashboard with call trigger & log stream
│   ├── style.css               # Modern dark-mode styling
│   └── app.js                  # Real-time event polling & XML simulator
├── backend/                    # Express & Plivo Voice Server
│   ├── .env                    # Private environment configuration
│   ├── .env.example            # Environment template
│   ├── index.js                # Express entrypoint (serves API & static frontend)
│   ├── server.js               # Entrypoint alias
│   ├── cli.js                  # Command-line outbound call trigger
│   ├── package.json            # Node dependencies and scripts
│   ├── src/
│   │   ├── config.js           # Configuration loader & base URL resolver
│   │   ├── plivoClient.js      # Plivo Node SDK wrapper
│   │   ├── routes/
│   │   │   ├── callRoutes.js   # /api/make-call, /api/call-status, /api/calls
│   │   │   └── ivrRoutes.js    # /ivr/* Plivo XML webhook handlers
│   │   └── services/
│   │       ├── callTracker.js  # In-memory call log and status tracker
│   │       └── xmlTemplates.js # Official Plivo XML response generator
│   └── tests/
│       └── ivr.test.js         # Complete automated test suite (13 passing tests)
├── package.json                # Root proxy scripts
└── .gitignore                  # Git ignore rules (.env, node_modules, etc.)
```

---

## 4. Step-by-Step Setup Instructions

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* **A Public Tunneling Tool**: `ngrok` (recommended) or `pinggy` (for receiving live phone webhooks from Plivo's cloud)

---

### Step 1: Clone & Navigate to Repository
```bash
git clone <repository-url>
cd plivo
```

---

### Step 2: Install Dependencies
Install all backend dependencies:
```bash
# From root directory:
npm --prefix backend install

# Or navigate into backend/:
cd backend
npm install
cd ..
```

---

### Step 3: Configure Environment Variables
Copy the example environment template into `backend/.env`:

```bash
cp backend/.env.example backend/.env
```
```

---

### Step 4: Run Automated Tests (Offline Verification)
Before making live calls, run the built-in test suite to verify that all routes, DTMF branches, and XML outputs are working correctly:

```bash
npm test
```
*(All 13 test cases will execute and validate OTP validation, language branching, and actions offline without phone charges).*

---

### Step 5: Expose Local Server for Live Phone Calls (Ngrok)

Plivo's cloud voice servers need a public HTTPS URL to fetch your IVR XML webhooks when a call connects.

1. In a separate terminal, start an `ngrok` tunnel on port 3000:
   ```bash
   ngrok http 3000
   ```
   *(Or using zero-install pinggy: `ssh -p 443 -R0:localhost:3000 a.pinggy.io`)*

2. Copy the public forwarding HTTPS URL (e.g., `https://abc-123.ngrok-free.app`).

3. In `backend/.env`, set `BASE_URL` to your public URL:
   ```env
   BASE_URL=https://abc-123.ngrok-free.app
   ```

---

### Step 6: Start the Application

You can run the application in two ways:

#### Option A: Integrated Server (Recommended)
The backend automatically serves both the API endpoints and the frontend dashboard:
```bash
npm start
```
* **Dashboard URL**: [http://localhost:3000](http://localhost:3000)
* **API Health Check**: [http://localhost:3000/api/health](http://localhost:3000/api/health)

#### Option B: Standalone Frontend
If you want to host the frontend separately on another port:
1. Start backend: `npm start` (runs on port 3000)
2. In another terminal, run: `npx -y serve client` (runs on port 5000)
3. Open `http://localhost:5000` *(API calls automatically adapt to `http://localhost:3000`)*.

#### Option C: Running with Docker & Docker Compose
To run the fully containerized application in an isolated environment:

1. **Build and start the container**:
   ```bash
   docker compose up -d --build
   # or
   npm run docker:up
   ```

2. **Check container status and health**:
   ```bash
   docker compose ps
   ```

3. **Stream live application logs**:
   ```bash
   docker compose logs -f
   # or
   npm run docker:logs
   ```

4. **Stop the container**:
   ```bash
   docker compose down
   # or
   npm run docker:down
   ```

The dashboard will be available at [http://localhost:3000](http://localhost:3000).

---

## 5. How to Trigger and Test Outbound Calls

### Method 1: Using the Web Dashboard
1. Open [http://localhost:3000](http://localhost:3000) in your browser.
2. Enter your phone number with country code (e.g., `+919876543210`).
3. Click **Initiate Call via Plivo**.
4. The dashboard will show live status updates (`ringing`, `in-progress`, `completed`) and IVR events.
5. *(Optional)* Use the **Quick Endpoint Tester** drawer in the bottom right to preview live Plivo XML responses without making phone calls.

### Method 2: Using the CLI Tool
Trigger a call directly from your terminal:
```bash
npm run call -- +919876543210
# or
node backend/cli.js +919876543210
```

### Method 3: Using cURL
```bash
curl -X POST http://localhost:3000/api/make-call \
  -H "Content-Type: application/json" \
  -d '{"toNumber": "+919876543210"}'
```

---

## 6. Live Call IVR Testing Flow

When your phone rings from `+918035454161`, test the scenarios below:

1. **Answer the Call**: You will hear the greeting prompting you to enter a 4-digit OTP.
2. **Test Incorrect OTP**:
   * Enter `0000` on your phone keypad.
   * Hear: *"Invalid OTP. Please try again."*
   * The call remains connected and prompts you again.
3. **Test Valid OTP**:
   * Enter `1503` on your keypad.
   * Hear: *"OTP verified successfully."*
4. **Level 1 (Language Selection)**:
   * Hear: *"For English, press 1. Para español, presione 2."*
   * Press `1` for English (or `2` for Spanish).
5. **Level 2 (Action Selection)**:
   * **Press 1**: The system plays the Trumpet MP3 audio file (`<Play>`).
   * **Press 2**: The system transfers/dials (`<Dial>`) the live associate number `02264236412`.

---

## 7. API & Webhook Endpoints Reference

| Endpoint | Method | Input Parameters | Description / Return |
| :--- | :--- | :--- | :--- |
| `/api/make-call` | `POST` | `toNumber`: Target phone string | Initiates outbound call via Plivo Voice SDK. |
| `/api/call-status` | `POST/GET` | `CallUUID`, `CallStatus` | Webhook callback for Plivo call lifecycle updates. |
| `/api/calls` | `GET` | None | Returns active and recent call timeline logs. |
| `/api/config` | `GET` | None | Returns public safe server configuration. |
| `/api/health` | `GET` | None | Server health check endpoint. |
| `/ivr/otp-prompt` | `POST/GET` | None | Returns Plivo XML `<GetDigits>` for 4-digit OTP. |
| `/ivr/otp-verify` | `POST/GET` | `Digits`: entered OTP | Validates `1503`. Matches $\rightarrow$ Level 1; Mismatch $\rightarrow$ re-prompts. |
| `/ivr/level1-lang` | `POST/GET` | None | Returns Plivo XML for language selection (1=EN, 2=ES). |
| `/ivr/level1-process` | `POST/GET` | `Digits`: 1 or 2 | Processes language; presents Level 2 Action Menu. |
| `/ivr/level2-process` | `POST/GET` | `Digits`: 1 or 2, `lang`: `en`/`es` | **Option 1**: `<Play>` MP3.<br>**Option 2**: `<Dial>` Associate (`02264236412`). |

---

## 8. Troubleshooting & FAQ

* **Error: `status: 401 Unauthorized`**:
  Check `PLIVO_AUTH_ID` and `PLIVO_AUTH_TOKEN` in `backend/.env`. Ensure there are no leading/trailing spaces.
* **Error: `callback_url parameter is not a valid url`**:
  Plivo requires a public HTTPS URL. Do not use `localhost` in `BASE_URL` when placing live calls. Set up `ngrok` and update `BASE_URL` in `backend/.env`.
* **Tests pass but call does not reach phone**:
  Ensure the phone number includes the international country code (e.g., `+91` for India, `+1` for US) and that your Plivo account has outbound voice permissions enabled for that destination.

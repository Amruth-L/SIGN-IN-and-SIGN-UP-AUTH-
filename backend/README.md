# CampusMesh Backend

A complete Node.js backend for CampusMesh. 

## OTP email on Render Free

The campus preview can use `EMAIL_PROVIDER=lambda`, `AWS_REGION=us-east-1` and `EMAIL_LAMBDA_FUNCTION=campusmesh-otp-mailer`. Render invokes the private AWS Lambda synchronously over HTTPS; the function sends with the existing Gmail account over TLS. Grant only `lambda:InvokeFunction` on that exact function ARN to the application's IAM user. Set the Gmail sender and app password on the Lambda environment, not in its deployment ZIP or API payload. The app accepts success only after the function confirms SMTP acceptance. See [the mail function deployment instructions](lambda/otp-mailer/README.md). `npm run email:check` tests invocation permission without sending mail. Gmail sending quotas still apply; use an approved transactional provider and a verified sending domain for larger production use.

Signup remains restricted to `@dbit.co.in`. Failed initial sends preserve an unverified account; retrying signup returns the user to verification without overwriting its password. Codes expire after ten minutes, have five attempts, are single-use, and have separate verification/reset purposes. Resending is limited to once per minute. Profile edits cannot replace the verified sign-in email.

### Amazon SES option

Set `EMAIL_PROVIDER=ses`, `EMAIL_FROM` to a verified sender email, and `AWS_REGION` to the region where that identity is verified. Supply `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` privately in the server environment (plus `AWS_SESSION_TOKEN` for temporary credentials). The SDK also supports standard AWS credential profiles and IAM roles. S3-only permissions do not authorize SES: the application identity needs `ses:SendEmail` for the chosen SES sender identity. Use a dedicated application IAM identity, not root access keys.

SES uses HTTPS on port 443. The adapter sends one request with a 12-second deadline and no automatic retry or SMTP fallback. It returns success only after SES supplies a message ID; that means accepted by the provider, not confirmed inbox delivery. Provider failures roll back the new OTP and return an error to the user. Logs contain a provider/error code without email addresses, OTP values or credentials.

Run `npm run email:check` with SES configured to inspect sending status, sender verification and production access without sending an email. This diagnostic additionally requires `ses:GetAccount` and `ses:GetEmailIdentity`. SES sandbox accounts can send only to verified recipients (or the AWS mailbox simulator). Production access is required for general student signups. Sender verification, permissions and sandbox status apply in the selected AWS region. A real test to an authorized recipient and confirmation of receipt are still required before claiming delivery works.

The existing Gmail path remains available with `EMAIL_PROVIDER=smtp`, `EMAIL_USER` and `EMAIL_PASS`; it requires a host permitting outbound SMTP. Switching the code to SES alone does not configure AWS or activate sending. Keep AWS keys on the backend only. AWS email usage is billed separately from Render hosting.

References: [SES API](https://docs.aws.amazon.com/ses/latest/dg/send-email-api.html), [SES sandbox and production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).

## Campus intelligence, support and reminder calls

Run `npm run db:migrate` before starting the API. Migrations 004 and 005 add private support/call records and delivery estimate metadata; 006 adds one-time welcome calls. The Express API uses the server database connection; these private tables have RLS enabled with no browser-access policies.

The frontend exposes `/insights`, `/support` and `/reminders`. The API starts its reminder worker once per minute with the server. **Default mode is preview: no provider account, SMS or telephone call is required.** `/api/calls/preview` generates text for current eligible rentals and welcome calls, with clearly labelled examples. Browser speech playback does not dial a phone.

### One-time welcome call

Signup requires `phone_number` (an E.164 number or a 10-digit Indian mobile number), plus optional `welcome_enabled: true`. The checkbox starts unchecked. Signup saves the number and this separate consent; it does not send phone SMS or dial. Email verification is unchanged. The first successful password login atomically records `users.first_signed_in_at`; invalid credentials and unverified email do not count. If welcome consent is enabled and phone ownership is not verified, that first login opens `/reminders?welcome=1` with the saved number and a skip link.

After phone verification, the worker can queue one `WELCOME` job per account (`welcome:<user-id>`). Repeated logins, worker ticks and concurrent workers cannot place a second welcome attempt. A job cancelled before its first attempt can resume after consent is restored; an attempted, failed or uncertain call is never automatically redialled. Consent, verified number and first-login age are rechecked before dispatch. Welcome eligibility expires seven days after the first successful login to avoid stale onboarding calls when a provider is connected later. Existing call windows and daily limits apply, so this is not a promise of an immediate call.

The generic welcome plays immediately after answer, in the same soft female English voice, without a press-1 step. It introduces CampusMesh and thanks the user for joining. Press 9 disables all automated call categories. Reminder and recommendation opt-ins remain separate. A welcome-script browser preview is available without a provider.

### Matching and predictions

- Delivery offers match directed campus routes, detour limits and available time. The student still accepts before assignment; one active task is allowed. Wish Box highlights campus destinations on the student's route, but outside-shop travel is not mapped and is not given a fabricated ETA.
- Pickup-to-handover ETA starts with a walking-route baseline. With at least 20 valid completed non-demo trips, a distance/time regression is trained on the older 80% and checked on the newest 20%. It is used only if it beats the baseline; distances outside the observed range retain the baseline. Ranges are planning estimates, not arrival guarantees. The model is refreshed from records, with a five-minute cache.
- Demand uses 28 days of paid rental activity, with more weight on recent weeks. Forecasts need at least 10 rentals spread across five days. Demo/test rentals are excluded. This is campus demand, not a live external-market feed.
- Recommendations combine unique views, saves, paid rentals, momentum and category interests, with a category-diversity cap and visible reasons. Demo items never count as evidence of real demand.
- Return reliability uses completed paid rentals and agreed return dates, with smoothing and an uncertainty range. It appears only after five completed non-demo rentals. New users remain “Building history”; it never automatically rejects a customer. Only the borrower and the owner of an associated rental can request that borrower's estimate.

### Optional generative support

The English help assistant works immediately from curated CampusMesh answers and the signed-in user's own rental/Wish Box records. It can save support tickets, but does not contact an external support team or promise a response time.

To enable model-generated answers, privately configure `OPENAI_API_KEY` and `OPENAI_MODEL` in `backend/.env` with a Responses API model that supports structured outputs. Restart the API. Requests use `store: false`, a strict response schema and a 12-second timeout. Missing credentials, provider failures or invalid outputs fall back to the help library. Obvious email/phone/OTP strings are redacted from questions; minimal authenticated account facts and relevant help text are sent to the configured model. No tools capable of issuing refunds, payments or account changes are exposed. The model can still make mistakes: the UI links the underlying help and offers a support request.

See [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

### Listing photos on Amazon S3

New listing photos are decoded and checked by the API, resized to at most 1600 pixels per side, stripped of embedded metadata, and saved as WebP in a private S3 bucket. Supabase stores only stable app photo URLs in `listings.image_url` and `image_urls`. Existing listings retain their original images. The browser keeps local previews (and optional drafts) until publishing; it never receives AWS credentials.

Configure `S3_PHOTO_BUCKET`, `S3_REGION` (or `AWS_REGION`), and `PUBLIC_API_URL` on the API. The existing server-side AWS credential chain is used. Allow only `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on `arn:aws:s3:::YOUR_BUCKET/listings/*`. Keep S3 Block Public Access enabled, ACLs disabled, and SSE-S3 encryption. No bucket CORS, public-read policy, KMS key or CDN is required.

The API accepts up to five JPG/PNG/WebP photos, at most 5 MB and 40 megapixels each. New external URL submissions and animated images are rejected. `/api/photos/:owner/:file` checks that a photo is still attached to a listing, then redirects to a five-minute signed S3 URL. Listing photos are publicly viewable through the marketplace. Replacing/deleting a listing removes its unreferenced S3 photos; failed cleanup is logged for retry. A crash between an S3 upload and database save can leave an orphan object, so retain logs and reconcile storage periodically; no automatic broad bucket deletion is enabled.

Run `PHOTO_STORAGE_E2E=1 PHOTO_TEST_BASE_URL=https://your-api.example node --test test/photo-storage.contract.test.js` from `backend/` for a real storage check. This opt-in test needs the API and local environment to use the same database, JWT secret and S3 bucket. It creates disposable accounts/listing, checks uploads, private storage, gallery, ownership, replacement and deletion, then removes its fixtures. It sends no email or phone calls. S3 usage is billed under your AWS account/free-tier eligibility.

### Connecting calling later

The prepared adapter uses Twilio Voice plus Twilio Verify for phone ownership. Keep `CALLS_MODE=preview` and `CALLS_SCHEDULER_ENABLED=false` while reviewing previews. When a provider account and an HTTPS deployment are ready, configure these values privately:

```dotenv
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TWILIO_VERIFY_SERVICE_SID=
PUBLIC_API_URL=https://your-api.example
CALLS_MODE=live
CALLS_SCHEDULER_ENABLED=false
```

`PUBLIC_API_URL` must be the externally reachable backend origin, with the same URL used for signature verification. Voice/status callback URLs are supplied on each call under `/api/calls/webhooks/:id/{voice,answer,status}`. Only valid provider-signed requests are accepted. Users must save an E.164 number, verify it by SMS and separately opt in to welcome calls, reminders and/or recommendations. Phone verification sends a real SMS only when the configured user explicitly requests it. Changing the phone clears verification.

Set `CALLS_SCHEDULER_ENABLED=true` only when ready to place calls, then restart the API. Both live mode and scheduler enablement are required for outbound calls. The worker needs a running server; it is not suitable for a serverless process that sleeps between requests. Provider account/geographic restrictions and number availability must be checked with the chosen provider before launch.

Calls run 09:00–19:00 Asia/Kolkata, at most three times per rolling 24 hours per user, spaced at least 30 minutes apart; one due reminder per rolling day; recommendation calls are limited to once per seven days. Rental reminders take priority and are eligible four days before, the day before, on the date, and one day after the agreed return date. Every attempt rechecks consent, verification and rental state. Returned rentals or changed due dates invalidate stale reminders. A unique job key prevents repeated scheduler ticks from duplicating reminders. Ambiguous provider failures are marked `UNKNOWN` and require manual reconciliation; they are never automatically redialled.

Voice delivery uses female Indian English (`Polly.Aditi`). Full accounts use SSML at 90% speed and soft volume; trial accounts put text directly inside `Say` so trial sanitization cannot discard nested speech. Browser previews prefer an installed female English voice, at 0.9 speed and 0.85 volume; the exact preview sound depends on the device. See [Twilio speech controls](https://www.twilio.com/docs/voice/twiml/say/text-speech).

Calls disclose that they are automated. Rental details require the recipient to press 1; the generic welcome plays immediately. Press 9 (or say “stop” during a speech prompt) to turn off all call categories. Follow-up English questions use the same support assistant, limited to three turns and a two-minute call. No audio recording is requested. Calls do not book items, collect payment information, approve extensions or change rental state. Recommendation calls refer to rentals because CampusMesh currently has no purchase checkout.

Provider references: [Voice calls](https://www.twilio.com/docs/voice/api/call-resource), [webhook signatures](https://www.twilio.com/docs/usage/security), [speech/DTMF Gather](https://www.twilio.com/docs/voice/twiml/gather), [phone verification](https://www.twilio.com/docs/verify/api/verification).

### Verification

`WELCOME_E2E=1 node --test test/welcome-calls.contract.test.js` starts a temporary local API, creates a disposable signup, mocks email/SMS/Voice providers, checks concurrent first-login detection, phone verification, consent withdrawal and exactly one welcome attempt, then removes its records. Worker queries are scoped to the fixture. No real email, SMS or phone call is sent.

`npm test` runs local unit tests. Against an idle development API on port 3003, `INTELLIGENCE_E2E=1 node --test test/calls-support.contract.test.js` creates disposable records, injects a fake phone provider, tests consent/call limits/webhook signatures/cancellation and authenticated data isolation, then cleans up. No real calls or SMS are made. The contract test expects preview configuration and no other enabled call users or queued jobs. Existing delivery and Wish Box contracts are opt-in via `DELIVERY_OFFERS_E2E=1` and `WISH_E2E=1` respectively; run them separately against an idle development environment.

## Features
- **Custom Authentication**: JWT based auth built from scratch using `bcrypt` and `jsonwebtoken`.
- **Restricted Signup**: Only students with an `@dbit.co.in` email can register.
- **Protected Routes**: Secure endpoints requiring a valid JSON Web Token.
- **Marketplace Listings CRUD**: Users can create, view, update, and delete listings. Only the listing owner can update or delete it.
- **PostgreSQL Database**: Built on top of Supabase's Postgres with raw SQL queries using the `pg` package.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (Supabase)
- **Database Driver**: `pg`
- **Security**: `bcrypt` for hashing, `jsonwebtoken` for stateless authentication

## Folder Structure
```
backend/
├── server.js               # Main Express app and server startup
├── package.json            # Project metadata and dependencies
├── .env                    # Environment variables (Database URL, JWT Secret)
├── config/
│   └── db.js               # PostgreSQL pool connection setup
├── middleware/
│   └── authMiddleware.js   # JWT validation middleware
├── controllers/
│   ├── authController.js   # Logic for signup, login, profile, logout
│   └── listingController.js# Logic for listing CRUD operations
├── routes/
│   ├── authRoutes.js       # Express routes for authentication
│   └── listingRoutes.js    # Express routes for listings
├── seed.js                 # Script to create tables and insert dummy users
└── README.md               # Documentation
```

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Setup Environment Variables:
   Open the `.env` file and populate `DATABASE_URL` with your Supabase Postgres connection string.
   ```env
   DATABASE_URL=postgres://[user]:[password]@[host]:[port]/[database]
   JWT_SECRET=your_jwt_secret
   PORT=3003
   ```

## Database Setup & Seeding

This project requires a `users` table and a `listings` table. The `seed.js` script handles both the SQL table creation (migrations) and seeding of dummy users.

Run the seed script:
```bash
npm run seed
```

This will:
- Create the `users` and `listings` tables if they don't exist.
- Insert 10 dummy students (all with password `Password@123`).
- Skip any users that already exist.

## Running the Server

Start the application in development mode (auto-reload on changes):
```bash
npm run dev
```

Or run standard:
```bash
npm start
```

The server will start on `http://localhost:3003`.

## API Endpoints

### Authentication
- `POST /signup`: Register a new user (Requires `@dbit.co.in` email).
- `POST /login`: Authenticate and receive a JWT.
- `GET /profile`: Get the logged-in user's profile (Requires JWT).
- `POST /logout`: Logout (Client removes the token).

### Listings
- `GET /listings`: Retrieve all listings.
- `GET /listings/:id`: Retrieve a specific listing.
- `POST /listings`: Create a listing (Requires JWT).
- `PUT /listings/:id`: Update a listing (Requires JWT & Owner privileges).
- `DELETE /listings/:id`: Delete a listing (Requires JWT & Owner privileges).

## Testing with Postman
You can find the comprehensive Postman Collection `Postman_Collection.json` in this directory. Import it into your Postman workspace to easily test all endpoints, including authentication flows and listing modifications.

Booking calls: opt in using `booking_enabled` (signup rental-call consent also enables reminders). Only newly fully paid real rentals qualify, once per rental and within 24 hours of confirmation. Historical, unpaid, cancelled and demo bookings are excluded. Payment confirmation and its timestamp commit together; scheduler retries deduplicate. Signup shows an in-app welcome after email verification; it does not send SMS. Provider credentials alone do not prove voice readiness: check the correct Voice sending number (trials may use shared numbers), recipient verification, geographic permissions, and a live test before enabling calls.

`BOOKING_CALLS_E2E=1 node --test test/booking-calls.contract.test.js` scopes worker queries to disposable records and tests booking deduplication, cancellation, expiry, unchanged preferences, and four-day reminders. `DELIVERY_E2E=1 node --test test/delivery-flow.contract.test.js` starts its own local API and uses a fake Razorpay provider with valid fixture signatures and captured-payment responses. It tests booking through both delivery handovers, notification emission, concurrent route saves and payment replay without charging money. All records are removed afterward. Never run delivery contracts while real couriers are online.

### Supabase call scheduler and Twilio trials

The private `POST /api/call-scheduler/tick` endpoint requires `Authorization: Bearer CALLS_SCHEDULER_SECRET` (a random secret of at least 32 characters; never expose it to the frontend). It invokes the same deduplicated worker as the server timer. Configure the same secret on the API and locally, then run `CALLS_SCHEDULER_API_URL=https://your-api.example node scripts/install-call-scheduler.js`. This explicitly enables pg_cron/pg_net, stores the secret and URL in Supabase Vault, and schedules a job every 15 minutes. The SQL function is executable only by its owner and sends requests only in 09:00–19:00 India time when a verified opted-in user exists. Its HTTP timeout allows Render cold starts. Monitor `cron.job_run_details` and `net._http_response`; scheduler success alone is not proof of phone delivery. Disable just this job with `SELECT cron.unschedule('campusmesh-automated-calls')`. Free-provider outages and trial limits still apply.

Set `TWILIO_TRIAL_MODE=true` for the new trial API. Calls use URL-hosted TwiML and omit unsupported advanced parameters; inline TwiML is rejected by the trial API. Trial recipients must be verified in Twilio. An administrator may link an explicitly confirmed recipient to the same verified CampusMesh account after checking provider evidence, recording consent and phone verification; never automatically mark every signup number verified. Other users still need phone verification before automated calls. Trial minutes, recipient limits and expiry are enforced by Twilio.

The trial custom-TwiML fetcher was observed omitting `X-Twilio-Signature`, which previously caused HTTP 403 and an audible application error. Trial speech URLs now carry a 15-minute HMAC token bound to the exact call and endpoint. Missing, altered, expired and cross-call tokens fail closed; signed requests still use normal Twilio validation, and status callbacks always require it. Treat these URLs as temporary secrets: never log their query strings or expose them to the frontend. Trial fetches without a CallSid resolve only the accepted provider SID stored on that call job. The signed provider probe can test speech without fabricating a rental or first sign-in. A real trial call to the owner's explicitly approved recipient played the CampusMesh female-voice greeting successfully on 2026-10-15; the recipient confirmed hearing it. Live booking/reminder delivery still depends on qualifying events, consent, phone verification, calling hours and provider availability.

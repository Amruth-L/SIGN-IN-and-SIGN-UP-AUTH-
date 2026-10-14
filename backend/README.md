# CampusMesh Backend

A complete Node.js backend for CampusMesh. 

## Campus intelligence, support and reminder calls

Run `npm run db:migrate` before starting the API. Migrations 004 and 005 add private support/call records and delivery estimate metadata. The Express API uses the server database connection; these private tables have RLS enabled with no browser-access policies.

The frontend exposes `/insights`, `/support` and `/reminders`. The API starts its reminder worker once per minute with the server. **Default mode is preview: no provider account, SMS or telephone call is required.** `/api/calls/preview` generates text for current eligible rentals, or a clearly labelled example. Browser speech playback does not dial a phone.

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

`PUBLIC_API_URL` must be the externally reachable backend origin, with the same URL used for signature verification. Voice/status callback URLs are supplied on each call under `/api/calls/webhooks/:id/{voice,answer,status}`. Only valid provider-signed requests are accepted. Users must save an E.164 number, verify it by SMS and separately opt in to reminders and/or recommendations. Phone verification sends a real SMS only when the configured user explicitly requests it. Changing the phone clears verification.

Set `CALLS_SCHEDULER_ENABLED=true` only when ready to place calls, then restart the API. Both live mode and scheduler enablement are required for outbound calls. The worker needs a running server; it is not suitable for a serverless process that sleeps between requests. Provider account/geographic restrictions and number availability must be checked with the chosen provider before launch.

Calls run 09:00–19:00 Asia/Kolkata, at most once per rolling 24 hours per user; recommendation calls are limited to once per seven days. Rental reminders take priority and are eligible the day before, on the date, and one day after the agreed return date. Every attempt rechecks consent, verification and rental state. Returned rentals or changed due dates invalidate stale reminders. A unique job key prevents repeated scheduler ticks from duplicating reminders. Ambiguous provider failures are marked `UNKNOWN` and require manual reconciliation; they are never automatically redialled.

Voice delivery uses female Indian English (`Polly.Aditi`) with SSML at 90% speed and soft volume for every spoken prompt. Browser previews prefer an installed female English voice, at 0.9 speed and 0.85 volume; the exact preview sound depends on the device. See [Twilio speech controls](https://www.twilio.com/docs/voice/twiml/say/text-speech).

Calls first disclose that they are automated and ask the recipient to press 1 before speaking rental details; press 9 or say “stop” to turn off both call categories. Follow-up English questions use the same support assistant, limited to three turns and a two-minute call. No audio recording is requested. Calls do not book items, collect payment information, approve extensions or change rental state. Recommendation calls refer to rentals because CampusMesh currently has no purchase checkout.

Provider references: [Voice calls](https://www.twilio.com/docs/voice/api/call-resource), [webhook signatures](https://www.twilio.com/docs/usage/security), [speech/DTMF Gather](https://www.twilio.com/docs/voice/twiml/gather), [phone verification](https://www.twilio.com/docs/verify/api/verification).

### Verification

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

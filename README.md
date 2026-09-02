# CampusMesh

CampusMesh is a campus-only rental, route-matched courier, and private Xerox delivery platform. Lender, borrower, and courier are actions available to every verified student account.

## Features

- Student authentication with signup, email verification, login, logout, and password reset
- JWT-protected user profiles and listing management
- Marketplace listing CRUD with owner-only edit and delete access
- Item rental workflow with booking requests, owner responses, rental status, and returns
- Shopping cart and checkout support
- Saved items / wishlist
- Dynamic rental pricing calculation
- Razorpay rental, security-deposit, and checkout payments
- Payment verification, history, and deposit refunds
- Email notifications through Nodemailer
- Postman collection for backend API testing
- Dijkstra campus routing with declared courier routes and transparent 100-point matching
- Atomic, expiring courier offers delivered through authenticated Socket.IO user rooms
- Single-use, hashed QR/OTP credentials for outbound, return, and Xerox handovers
- Private PDF validation, ₹3/page pricing, Xerox Desk queue, and courier delivery
- Trending and personalized marketplace recommendations from first-party interactions

## Project structure

```text
.
├── backend/
│   ├── server.js                 # Express application entry point
│   ├── config/                   # PostgreSQL and Razorpay configuration
│   ├── controllers/              # Request handlers and business logic
│   ├── middleware/               # Authentication and payment verification
│   ├── routes/                   # API route definitions
│   ├── services/                 # Payment services
│   ├── utils/                    # Pricing and email utilities
│   ├── seed.js                   # Database schema and sample-data setup
│   └── Postman_Collection.json   # API requests for Postman
└── frontend/
    ├── src/pages/                # Application screens
    ├── src/components/           # Shared UI components
    ├── src/context/              # Authentication state
    └── src/utils/                # Frontend service helpers
```

## Tech stack

- Frontend: React 19, React Router, Vite, Axios
- Backend: Node.js, Express, JWT, bcrypt
- Database: PostgreSQL, accessed through `pg` and Supabase
- Payments: Razorpay
- Email: Nodemailer

## Prerequisites

- Node.js and npm
- A PostgreSQL database (the project is configured for Supabase PostgreSQL)
- Razorpay credentials for real payments; the backend can fall back to simulation mode when credentials are not configured

## Configuration

Create `backend/.env` with the following values:

```env
PORT=3003
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=replace_with_a_long_random_secret

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=server_only_service_role_key
SUPABASE_XEROX_BUCKET=xerox-private
XEROX_RETENTION_DAYS=7

EMAIL_USER=your_email_address
EMAIL_PASS=your_email_app_password

RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

Do not commit `.env` or real credentials. For frontend payment configuration, optionally create `frontend/.env`:

```env
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
```

The frontend currently expects the backend at `http://localhost:3003`.

## Installation and setup

Install dependencies in both applications:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Apply idempotent migrations, then seed the presentation accounts and activity:

```bash
cd backend
npm run migrate
npm run seed
```

## Running locally

Start the backend in one terminal:

```bash
cd backend
npm run dev
```

The API runs on [http://localhost:3003](http://localhost:3003). Use `npm start` to run without watch mode.

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Vite will print the local frontend URL, normally [http://localhost:5173](http://localhost:5173).

## Backend API overview

| Area | Base path | Examples |
| --- | --- | --- |
| Authentication | `/` | `/signup`, `/verify-email`, `/login`, `/logout` |
| Listings | `/listings` | `GET`, `POST`, `PUT`, `DELETE` |
| Profile | `/api/profile` | Read and update profile |
| Rentals | `/api/rentals` | Bookings, requests, status, returns |
| Payments | `/api/payment` | Orders, verification, history, refunds |
| Cart | `/api/cart` | Add, update, remove, and view cart items |
| Pricing | `/api/pricing` | Calculate rental pricing |
| Wishlist | `/api/wishlist` | View, toggle, and remove saved items |
| Courier routes/offers | `/api/courier` | Availability routes and scored offers |
| Delivery tracking/handover | `/api/delivery` | Assignment, live checkpoints, QR/OTP verification |
| Campus graph | `/api/campus` | Locations and computed shortest paths |
| Xerox | `/api/xerox` | PDF preview, requests, desk queue, and private documents |

Demo accounts are `studenta@dbit.co.in` through `studentl@dbit.co.in`, plus `xerox@dbit.co.in`. The presentation-only password is `CampusMesh@123`.

Most user, rental, cart, wishlist, and payment endpoints require a JWT in the request authorization header.

## Testing the API

Import `backend/Postman_Collection.json` into Postman. Set the backend URL to `http://localhost:3003`, then test signup/login before calling protected endpoints.

## Useful commands

```bash
# Backend
cd backend && npm run dev
cd backend && npm start
cd backend && npm run seed
cd backend && npm test

# Frontend
cd frontend && npm run dev
cd frontend && npm run build
cd frontend && npm run lint
cd frontend && npm run preview
```

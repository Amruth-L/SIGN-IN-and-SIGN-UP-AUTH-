# CampusMesh Backend

A complete Node.js backend for CampusMesh. 

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

# CampusMesh local setup

Requirements: Node.js 20.19+ or 22.12+, npm, and a Supabase PostgreSQL database.

## 1. Configure the backend

```bash
cd backend
cp .env.example .env
```

Set these values in `backend/.env`:

```env
PORT=3003
DATABASE_URL=your-supabase-postgres-url
DATABASE_SSL=true
JWT_SECRET=any-long-random-secret
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
FRONTEND_ORIGIN=http://localhost:5173
```

Keep the existing Supabase service-role, email, Razorpay, and Xerox values if those features are needed.

## 2. Install and seed

From the project root:

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../backend && npm run seed
```

`npm run seed` also runs the database migrations.

## 3. Start the app

Terminal 1:

```bash
cd backend && npm run dev
```

Terminal 2:

```bash
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The backend must be running at `http://localhost:3003`.

## Demo login

Users: `studenta@dbit.co.in` through `studentl@dbit.co.in` or `xerox@dbit.co.in`  
Password: `CampusMesh@123`

To wipe and recreate a disposable database:

```bash
cd backend && npm run db:reset && npm run seed
```

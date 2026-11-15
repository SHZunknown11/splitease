# SplitEase

A MERN stack app for splitting shared expenses in a group (flat, trip, team) and settling
up with a short list of payments. Built by Mohammad Taha (24BCS12733, section NTPP_719_A)
during the A2IT InternEdge internship "Full Stack Web Development With MERN"
(20 May 2026 to 02 Jul 2026).

## Features
- Register, log in (JWT, bcrypt-hashed passwords), change your display name
- Groups with several members; add people already in the app or type new names
- Expenses split equally, by exact amounts or by percentages (the form blocks splits that do not add up)
- Live balances and a settle-up graph: the tangle of "who owes whom" is reduced to at most one payment fewer than the number of people
- Record payments, delete expenses, download a group's expenses as CSV
- Live updates between browsers (Socket.io), overview charts, light and dark theme, phone-friendly layout

## Stack
| Part | Technology |
|---|---|
| Front end | React 18, Vite, React Router, Framer Motion |
| Back end | Node.js, Express, JSON Web Tokens, bcryptjs |
| Database | MongoDB with Mongoose |
| Live updates | Socket.io |
| Tests | Node's built-in test runner, Supertest |

## Run it (Windows, macOS, Linux)
You need Node.js 20 or newer and MongoDB running on `mongodb://127.0.0.1:27017`.

    cd server
    npm install
    npm run seed      # loads the sample groups (optional; the server also does it on an empty database)
    npm start         # API on http://localhost:5000

    cd ../client
    npm install
    npm run dev       # app on http://localhost:5173

On Windows you can double-click `run.bat` after the two `npm install` steps.
Open http://localhost:5173 and choose "Open the sample account", or log in as
`taha@example.com` with the password `sample`. The sample people (Taha, Aarav, Meher, Kabir, Zoya, Dev)
and their groups are made-up demo data.

## Tests
    cd server
    npm test

Runs 40 tests: unit tests for the money and settle-up logic, and API tests against a real MongoDB
database named `splitease_test` (wiped before each run, dropped after). Set `TEST_MONGODB_URI` to use another database.

## Configuration (environment variables, all optional)
| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 5000 | API port |
| `MONGODB_URI` | mongodb://127.0.0.1:27017/splitease | Database |
| `JWT_SECRET` | a fixed development value | **Set a real secret in production** |
| `ALLOW_RESET` | on | Set to `false` to disable the "Restore sample data" endpoint |

## Deploy (MongoDB Atlas + Render)
One Render web service runs everything: Express serves the built React app from `client/dist`
and the API and Socket.io on the same origin, so no CORS or URL settings are needed.

1. **Atlas:** create a free M0 cluster, add a database user, allow access from anywhere
   (`0.0.0.0/0`), and copy the connection string (put a database name such as `/splitease` before the `?`).
2. **Render:** New > Blueprint, pick this repo. `render.yaml` sets the build and start commands,
   generates `JWT_SECRET`, and turns `ALLOW_RESET` off. Paste the Atlas string into `MONGODB_URI` when asked.
3. Open the Render URL. The first start on an empty database loads the sample data.

The free Render service sleeps when idle, so the first request after a pause takes about a minute.

Live URL: _add it here after the first deploy_

## Project layout
    server/src/app.js          Express routes and validation
    server/src/models/         Mongoose models (User, Group, Expense, Settlement)
    server/src/lib/settle.js   Money maths and the settle-up algorithm
    server/src/lib/realtime.js Socket.io rooms, one per group
    server/test/               Unit and API tests
    client/src/pages/          Landing, Overview, Group, Settings
    client/src/components/     Shell, DebtGraph, dialogs
    client/src/api/client.js   All calls to the API

All money is stored as whole paise, so sums never drift by a fraction.

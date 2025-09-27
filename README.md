# PIOSPARES POS Backend - Auth Module

## Setup
1. Clone repo.
2. Run `npm install`.
3. Create `.env` with MONGO_URI and JWT_SECRET.
4. Run `npm start` or `npm dev` for development.

## Endpoints
- POST /auth/register: Register org + owner.
- POST /auth/login: Login and get JWT.

## Swagger Docs
Available at http://localhost:5000/api-docs

## Next Steps
Extend with other modules (e.g., organizations, branches) by adding routes/controllers/models. Ensure authMiddleware is used for protected routes in other modules.
PIOSPARES POS Backend
Setup

Clone repo.
Run npm install.
Create .env with MONGO_URI and JWT_SECRET.
Run npm start or npm dev for development.

Endpoints

Auth:

POST /auth/register: Register org + owner.
POST /auth/login: Login and get JWT.


Organizations (Owner only):

GET /organizations: Get org details.
PUT /organizations: Update org details.


Branches (Owner/Manager):

POST /branches: Create branch.
GET /branches: List branches.


Users (Owner/Manager):

POST /users/invite: Invite user (provide password; in prod, email it).
GET /users: List users.



Swagger Docs
Available at http://localhost:5000/api-docs
Notes

All protected endpoints require Bearer JWT in Authorization header.
Multi-tenancy enforced via orgId from JWT.
For invites, password is provided in request; enhance with email/reset later.

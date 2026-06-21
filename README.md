# AI-Powered Multi-Workspace Expense Tracker - Backend

A state-of-the-art backend application powered by **NestJS**, **TypeScript**, **Prisma ORM (v6)**, and **PostgreSQL**, designed to support multi-tenant expense tracking with AI capabilities, structured logging, and robust security.

---

## 🚀 Key Features

### 1. Robust Authentication & User Management
* **Secure Registration:** Registers new users with hashed passwords (`bcrypt`) and generates unique verification tokens.
* **Email Verification Flow:** Validating email auto-generates:
  * A default `PERSONAL` Workspace.
  * Links the user as the `OWNER` of that workspace.
  * 10 default expense/income categories (e.g., Food & Beverage, Shopping, Salary, Investment).
* **JWT & Refresh Token Rotation:** Features secure login issuing short-lived access tokens (24h) and long-lived refresh tokens (7d). Incorporates **Token Rotation** where refresh tokens are hashed and stored in the database, and older tokens are revoked upon rotation.
* **Forgot & Reset Password:** Implements password reset flows via temporary tokens.
* **Change Password:** Secure endpoint tracking a `PASSWORD_CHANGED` audit log event.
* **Secure Logout:** Revokes and removes refresh tokens from the active database.

### 2. Enterprise-Grade Global Infrastructure
* **Strict Validation:** Input schemas are validated at the controller level using `nestjs-zod` and custom Zod schemas.
* **Global HttpException Filter:** Intercepts all incoming exceptions, formats API errors consistently, and translates Zod validation details (`issues`) into readable error arrays.
* **Structured Logging:** Utilizes **Winston Logger** to print machine-readable JSON logs for production observability.
* **Interactive Swagger Documentation:** Self-generating OpenAPI documentation decorated with security schemes (Bearer JWT token).

---

## 🛠️ Technology Stack

* **Core Framework:** NestJS (v11.x) & TypeScript
* **Database & ORM:** PostgreSQL & Prisma ORM (v6.x)
* **Authentication:** Passport, JWT (`@nestjs/jwt`), and bcrypt
* **Validation:** Zod (`nestjs-zod`)
* **Documentation:** Swagger UI (`@nestjs/swagger`)
* **Logging:** Winston (`nest-winston`)

---

## 📋 Getting Started

### Prerequisites
* **Node.js:** v24.16.x or newer
* **Database:** PostgreSQL instance running and accessible

### Installation
1. Clone the repository and navigate to the backend folder:
   ```bash
   npm install
   ```

2. Copy the environment template to configure your local variables:
   ```bash
   cp .env.example .env
   ```
   *Modify the `.env` file to supply your PostgreSQL database credentials (`DATABASE_URL`), JWT secret keys, and SMTP server details.*

### Database Initialization
Apply Prisma migrations to initialize your PostgreSQL database schema:
```bash
npx prisma migrate dev --name init
```
Generate the Prisma Client:
```bash
npx prisma generate
```

### Running the Application

* **Development (Watch Mode):**
  ```bash
  npm run start:dev
  ```

* **Production Build:**
  ```bash
  npm run build
  npm run start:prod
  ```

Once running, the application serves endpoints at:
* **API Base Path:** `http://localhost:3000/api`
* **Swagger API Docs:** `http://localhost:3000/api/docs`

---

## 🧪 Testing & Verification

* **Unit Tests:**
  ```bash
  npm run test
  ```

* **Authentication E2E Integration Test Script:**
  We provide a pre-configured integration verification script to test the complete register-verify-login-refresh-logout flow:
  ```bash
  node ../C:/Users/Lenovo/.gemini/antigravity-ide/brain/291d6514-e330-47d3-9562-e7027b578a51/scratch/test-auth.js
  ```
  *(Make sure the backend server is running locally on port 3000 before executing this script.)*

---

## 📖 API Endpoints Summary (Auth Module)

| Endpoint | Method | Description | Auth Required | Rate Limit |
|---|---|---|---|---|
| `/api/auth/register` | `POST` | Registers a new user (generates verification email/token) | None | 10 req/min |
| `/api/auth/verify-email` | `POST` | Verifies email and auto-creates default workspace & categories | None | 10 req/min |
| `/api/auth/resend-verification`| `POST` | Resends verification token email | None | 3 req/hour |
| `/api/auth/login` | `POST` | Auths credentials, returning access & refresh tokens | None | 10 req/min |
| `/api/auth/refresh` | `POST` | Refreshes access tokens via refresh token rotation | None | 10 req/min |
| `/api/auth/logout` | `POST` | Revokes the active refresh token and logs out the user | JWT Bearer | 10 req/min |
| `/api/auth/forgot-password` | `POST` | Triggers a password reset token to user's email | None | 5 req/min |
| `/api/auth/reset-password` | `POST` | Resets password with a valid reset token | None | 5 req/min |
| `/api/auth/change-password` | `PATCH`| Changes password for currently authenticated user | JWT Bearer | 5 req/min |

---

## 📝 License
This project is licensed under the MIT License.

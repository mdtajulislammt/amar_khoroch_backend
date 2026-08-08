# Amar Khoroch (Frost Flow Ledger) - Frontend API Integration Guide

This document contains the complete API specifications, authentication rules, standard response envelopes, and real payload examples for seamless frontend integration with **Amar Khoroch Backend**.

---

## 1. General API Configuration

* **Base URL:** `http://localhost:3000/api/v1` (or `http://localhost:9898/api/v1` depending on PORT configured in `.env`)
* **Interactive Swagger UI Documentation:** `http://localhost:3000/api/docs`
* **Content-Type Header:** `application/json`
* **Authentication Header:** `Authorization: Bearer <JWT_TOKEN>`

---

## 2. Standard API Response Envelope

All API endpoints strictly wrap success and error responses in a uniform JSON envelope structure:

### Success Response Format (HTTP 200 / 201)
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "pagination": { "page": 1, "limit": 20, "total": 150 },
  "errors": null
}
```

### Error Response Format (HTTP 400 / 401 / 404 / 409 / 500)
```json
{
  "success": false,
  "message": "Validation failed or error description",
  "data": null,
  "errors": "Detailed error object or validation array"
}
```

---

## 3. Comprehensive API Endpoints Summary Table

| Category | Endpoint | Method | Auth Required | Description |
|---|---|---|---|---|
| **Auth** | `/api/v1/auth/register` | `POST` | No | Register new user account |
| **Auth** | `/api/v1/auth/login` | `POST` | No | Login & obtain JWT token |
| **Profile** | `/api/v1/users/profile` | `GET` | Yes | Get authenticated user profile |
| **Profile** | `/api/v1/users/profile` | `PUT` | Yes | Update user profile details |
| **Profile** | `/api/v1/users/change-password` | `PUT` | Yes | Change account password |
| **Settings** | `/api/v1/settings` | `GET` | Yes | Get app settings |
| **Settings** | `/api/v1/settings` | `PUT` | Yes | Update app settings |
| **Settings** | `/api/v1/settings/pin/set` | `POST` | Yes | Set 4-digit security PIN |
| **Settings** | `/api/v1/settings/pin/verify` | `POST` | Yes | Verify security PIN code |
| **Wallets** | `/api/v1/wallets` | `GET` | Yes | Get all accounts/wallets |
| **Wallets** | `/api/v1/wallets` | `POST` | Yes | Create new wallet |
| **Wallets** | `/api/v1/wallets/:id` | `PUT` | Yes | Update wallet details |
| **Wallets** | `/api/v1/wallets/:id` | `DELETE` | Yes | Delete wallet |
| **Categories** | `/api/v1/categories` | `GET` | Yes | Get all categories |
| **Categories** | `/api/v1/categories` | `POST` | Yes | Create custom category |
| **Categories** | `/api/v1/categories/:id` | `PUT` | Yes | Update category details |
| **Categories** | `/api/v1/categories/:id` | `DELETE` | Yes | Delete category |
| **Transactions**| `/api/v1/transactions` | `GET` | Yes | Get transactions list (filtered & paginated) |
| **Transactions**| `/api/v1/transactions/:id` | `GET` | Yes | Get single transaction detail |
| **Transactions**| `/api/v1/transactions` | `POST` | Yes | Add transaction & update wallet balance |
| **Transactions**| `/api/v1/transactions/:id` | `DELETE` | Yes | Delete transaction & revert wallet balance |
| **Budgets** | `/api/v1/budgets` | `GET` | Yes | Get budget overview & spent amounts |
| **Budgets** | `/api/v1/budgets` | `POST` | Yes | Create/set category budget limit |
| **Budgets** | `/api/v1/budgets/:id` | `DELETE` | Yes | Delete budget limit |
| **Savings** | `/api/v1/savings` | `GET` | Yes | Get savings goals list |
| **Savings** | `/api/v1/savings` | `POST` | Yes | Create savings goal target |
| **Savings** | `/api/v1/savings/:id` | `PUT` | Yes | Update savings goal target |
| **Savings** | `/api/v1/savings/:id/deposit` | `POST` | Yes | Deposit into savings (deducts from wallet) |
| **Savings** | `/api/v1/savings/history` | `GET` | Yes | Get savings deposit history |
| **Savings** | `/api/v1/savings/history/:historyId` | `DELETE` | Yes | Delete deposit history & refund to wallet |
| **Debts** | `/api/v1/debts` | `GET` | Yes | Get receivables/payables list |
| **Debts** | `/api/v1/debts` | `POST` | Yes | Add new debt record |
| **Debts** | `/api/v1/debts/:id` | `PUT` | Yes | Update debt details |
| **Debts** | `/api/v1/debts/:id/toggle` | `PATCH` | Yes | Toggle debt cleared status |
| **Debts** | `/api/v1/debts/:id` | `DELETE` | Yes | Delete debt record |
| **Notes** | `/api/v1/notes` | `GET` | Yes | Get notes/tasks list |
| **Notes** | `/api/v1/notes` | `POST` | Yes | Add new note/task |
| **Notes** | `/api/v1/notes/:id` | `PUT` | Yes | Update note title/content |
| **Notes** | `/api/v1/notes/:id/toggle` | `PATCH` | Yes | Toggle task completion |
| **Notes** | `/api/v1/notes/:id` | `DELETE` | Yes | Delete note |
| **Reports** | `/api/v1/reports/summary` | `GET` | Yes | Get dashboard summary metrics (Redis cached) |
| **Reports** | `/api/v1/reports/cashflow` | `GET` | Yes | Get cashflow chart data |
| **Reports** | `/api/v1/reports/category-breakdown` | `GET` | Yes | Get category breakdown chart data |
| **Reports** | `/api/v1/reports/export` | `GET` | Yes | Export complete user backup JSON |

---

## 4. Module-by-Module Integration Details & Payloads

---

### Module 1: Auth & User Profile

#### 1.1 User Registration
* **Endpoint:** `POST /api/v1/auth/register`
* **Request Body:**
  ```json
  {
    "name": "MD Tajul Islam",
    "email": "tajul@example.com",
    "password": "SecretPassword123",
    "phone": "+8801712345678",
    "currency": "BDT (৳)"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Registration successful",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "u1a2b3c4-d5e6-7f8g-9h0i",
        "name": "MD Tajul Islam",
        "email": "tajul@example.com",
        "phone": "+8801712345678",
        "role": "Pro Member",
        "avatar": null,
        "currency": "BDT (৳)",
        "joinedDate": "2026-08-08"
      }
    },
    "errors": null
  }
  ```

#### 1.2 User Login
* **Endpoint:** `POST /api/v1/auth/login`
* **Request Body:**
  ```json
  {
    "email": "tajul@example.com",
    "password": "SecretPassword123"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "u1a2b3c4-d5e6-7f8g-9h0i",
        "name": "MD Tajul Islam",
        "email": "tajul@example.com",
        "phone": "+8801712345678",
        "role": "Pro Member",
        "avatar": "https://example.com/avatar.jpg",
        "currency": "BDT (৳)",
        "joinedDate": "2026-08-08"
      }
    },
    "errors": null
  }
  ```

#### 1.3 Get Current User Profile
* **Endpoint:** `GET /api/v1/users/profile`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Profile retrieved successfully",
    "data": {
      "id": "u1a2b3c4-d5e6-7f8g-9h0i",
      "name": "MD Tajul Islam",
      "email": "tajul@example.com",
      "phone": "+8801712345678",
      "role": "Pro Member",
      "avatar": "https://example.com/avatar.jpg",
      "currency": "BDT (৳)",
      "bio": "Personal finance tracker user",
      "joinedDate": "2026-08-08"
    },
    "errors": null
  }
  ```

#### 1.4 Update User Profile
* **Endpoint:** `PUT /api/v1/users/profile`
* **Headers:** `Authorization: Bearer <JWT_TOKEN>`
* **Request Body:**
  ```json
  {
    "name": "Tajul Islam",
    "phone": "+8801812345678",
    "currency": "BDT (৳)",
    "bio": "Managing budget efficiently"
  }
  ```

---

### Module 2: Settings & Security

#### 2.1 Get App Settings
* **Endpoint:** `GET /api/v1/settings`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Settings retrieved successfully",
    "data": {
      "isPinEnabled": true,
      "activeWalletId": "w1a2b3c4-d5e6",
      "language": "en"
    },
    "errors": null
  }
  ```

#### 2.2 Set Security PIN
* **Endpoint:** `POST /api/v1/settings/pin/set`
* **Request Body:**
  ```json
  {
    "pinCode": "1234"
  }
  ```

#### 2.3 Verify Security PIN
* **Endpoint:** `POST /api/v1/settings/pin/verify`
* **Request Body:**
  ```json
  {
    "pinCode": "1234"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "PIN verified successfully",
    "data": {
      "verified": true
    },
    "errors": null
  }
  ```

---

### Module 3: Wallets & Accounts

#### 3.1 Get All Wallets
* **Endpoint:** `GET /api/v1/wallets`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Wallets retrieved successfully",
    "data": [
      {
        "id": "w1",
        "name": "Cash Wallet",
        "type": "CASH",
        "balance": 8500.00,
        "icon": "Wallet"
      },
      {
        "id": "w2",
        "name": "Bank Account",
        "type": "BANK",
        "balance": 62000.00,
        "icon": "Landmark"
      },
      {
        "id": "w3",
        "name": "bKash Account",
        "type": "MOBILE_BANKING",
        "balance": 4300.00,
        "icon": "Smartphone"
      }
    ],
    "errors": null
  }
  ```

#### 3.2 Create New Wallet
* **Endpoint:** `POST /api/v1/wallets`
* **Request Body:**
  ```json
  {
    "name": "Nagad Wallet",
    "type": "MOBILE_BANKING",
    "balance": 3500.00,
    "icon": "Smartphone"
  }
  ```

---

### Module 4: Categories

#### 4.1 Get All Categories
* **Endpoint:** `GET /api/v1/categories`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Categories retrieved successfully",
    "data": [
      {
        "id": "c1",
        "name": "Food & Dining",
        "type": "EXPENSE",
        "icon": "UtensilsCrossed",
        "color": "#38bdf8"
      },
      {
        "id": "c2",
        "name": "Salary & Income",
        "type": "INCOME",
        "icon": "Briefcase",
        "color": "#22c55e"
      }
    ],
    "errors": null
  }
  ```

#### 4.2 Create Category
* **Endpoint:** `POST /api/v1/categories`
* **Request Body:**
  ```json
  {
    "name": "Healthcare",
    "type": "EXPENSE",
    "icon": "Stethoscope",
    "color": "#ef4444"
  }
  ```

---

### Module 5: Transactions & Quick Entry

#### 5.1 Get Transactions (With Search, Filtering & Pagination)
* **Endpoint:** `GET /api/v1/transactions`
* **Query Parameters:**
  - `type`: `INCOME` | `EXPENSE` | `TRANSFER`
  - `walletId`: string
  - `categoryId`: string
  - `search`: string
  - `startDate`: `YYYY-MM-DD`
  - `endDate`: `YYYY-MM-DD`
  - `page`: number (default: 1)
  - `limit`: number (default: 20)
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Transactions retrieved successfully",
    "data": [
      {
        "id": "t1",
        "type": "EXPENSE",
        "amount": 850.00,
        "categoryId": "c1",
        "walletId": "w1",
        "toWalletId": null,
        "date": "2026-08-08",
        "note": "Grocery store purchase",
        "isRecurring": false,
        "frequency": null,
        "nextExecutionDate": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150
    },
    "errors": null
  }
  ```

#### 5.2 Add Transaction (Income / Expense / Transfer)
* **Endpoint:** `POST /api/v1/transactions`
* **Request Body (Expense Example):**
  ```json
  {
    "type": "EXPENSE",
    "amount": 1200,
    "walletId": "w1",
    "categoryId": "c1",
    "date": "2026-08-08",
    "note": "Weekly market shopping",
    "isRecurring": false
  }
  ```
* **Request Body (Transfer Example):**
  ```json
  {
    "type": "TRANSFER",
    "amount": 2000,
    "walletId": "w1",
    "toWalletId": "w2",
    "date": "2026-08-08",
    "note": "Cash deposit to bank",
    "isRecurring": false
  }
  ```

#### 5.3 Delete Transaction (Auto Reverts Wallet Balance)
* **Endpoint:** `DELETE /api/v1/transactions/:id`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Transaction deleted and wallet balance reverted successfully",
    "data": null,
    "errors": null
  }
  ```

---

### Module 6: Budgets

#### 6.1 Get Budgets Overview (Real-time Spent Calculation)
* **Endpoint:** `GET /api/v1/budgets`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Budgets retrieved successfully",
    "data": [
      {
        "id": "b1",
        "categoryId": "c1",
        "categoryName": "Food & Dining",
        "limitAmount": 6000.00,
        "spentAmount": 4250.00,
        "period": "MONTHLY"
      }
    ],
    "errors": null
  }
  ```

#### 6.2 Set Category Budget Limit
* **Endpoint:** `POST /api/v1/budgets`
* **Request Body:**
  ```json
  {
    "categoryId": "c1",
    "limitAmount": 6000.00,
    "period": "MONTHLY"
  }
  ```

---

### Module 7: Savings Goals & History

#### 7.1 Get Saving Goals
* **Endpoint:** `GET /api/v1/savings`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Saving goals retrieved successfully",
    "data": [
      {
        "id": "s1",
        "goalName": "New Laptop Fund",
        "targetAmount": 90000.00,
        "currentAmount": 34000.00,
        "targetDate": "2026-12-31"
      }
    ],
    "errors": null
  }
  ```

#### 7.2 Deposit Money into Savings Goal
* **Endpoint:** `POST /api/v1/savings/:id/deposit`
* **Request Body:**
  ```json
  {
    "amount": 2000,
    "walletId": "w2"
  }
  ```
* **Business Logic:** Automatically deducts `2000` from wallet `w2`, adds `2000` to savings goal `currentAmount`, and logs a deposit history record.

---

### Module 8: Debts & Loans

#### 8.1 Get All Debts
* **Endpoint:** `GET /api/v1/debts`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Debts retrieved successfully",
    "data": [
      {
        "id": "d1",
        "personName": "Rafiq Bhai",
        "type": "GIVEN",
        "amount": 5000.00,
        "dueDate": "2026-08-25",
        "isCleared": false
      }
    ],
    "errors": null
  }
  ```

#### 8.2 Toggle Debt Status (Clear / Unclear)
* **Endpoint:** `PATCH /api/v1/debts/:id/toggle`

---

### Module 9: Notes & Tasks

#### 9.1 Get Notes List
* **Endpoint:** `GET /api/v1/notes`

#### 9.2 Add Note
* **Endpoint:** `POST /api/v1/notes`
* **Request Body:**
  ```json
  {
    "title": "Buy monthly groceries",
    "content": "Rice, oil, spices, and cleaning supplies"
  }
  ```

---

### Module 10: Reports & Analytics

#### 10.1 Get Dashboard Summary Metrics
* **Endpoint:** `GET /api/v1/reports/summary`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Dashboard summary metrics retrieved successfully",
    "data": {
      "totalBalance": 74800.00,
      "totalIncome": 60000.00,
      "totalExpense": 17310.00,
      "netSavings": 42690.00,
      "activeWalletsCount": 3
    },
    "errors": null
  }
  ```

#### 10.2 Get Cashflow Chart Analytics
* **Endpoint:** `GET /api/v1/reports/cashflow?period=monthly`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Cashflow data retrieved successfully",
    "data": [
      {
        "label": "2026-07",
        "income": 55000.00,
        "expense": 18200.00
      },
      {
        "label": "2026-08",
        "income": 60000.00,
        "expense": 17310.00
      }
    ],
    "errors": null
  }
  ```

#### 10.3 Get Category Breakdown Analytics
* **Endpoint:** `GET /api/v1/reports/category-breakdown?type=EXPENSE`
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Category breakdown retrieved successfully",
    "data": [
      {
        "categoryId": "c1",
        "categoryName": "Food & Dining",
        "color": "#38bdf8",
        "amount": 8500.00,
        "percentage": 49.10
      },
      {
        "categoryId": "c3",
        "categoryName": "Transportation",
        "color": "#f59e0b",
        "amount": 3200.00,
        "percentage": 18.49
      }
    ],
    "errors": null
  }
  ```

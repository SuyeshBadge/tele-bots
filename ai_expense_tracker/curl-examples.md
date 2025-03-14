# AI Expense Tracker API - Documentation

This document provides instructions for interacting with the AI Expense Tracker API.

## Interactive API Documentation (Swagger)

The API comes with fully interactive documentation built with Swagger. You can:
- Browse all available endpoints
- See request and response schemas
- Test the APIs directly from your browser
- Authenticate with JWT tokens
- Download OpenAPI specifications

Access the Swagger UI at:
```
http://localhost:3000/api/docs
```

## Mobile OTP Authentication API Endpoints

These endpoints allow users to authenticate using their mobile number and a one-time password (OTP).

### 1. Send OTP to Mobile Number

```bash
curl -X POST http://localhost:3000/api/auth/mobile/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "mobileNumber": "1234567890"
  }'
```

**Expected Response:**
```json
{
  "data": {
    "message": "OTP sent successfully",
    "expiresIn": 10,
    "otp": "123456"  // Only present in development mode
  },
  "meta": {
    "timestamp": "2023-03-14T10:20:30.123Z",
    "status": 200,
    "path": "/api/auth/mobile/send-otp"
  }
}
```

### 2. Verify OTP

```bash
curl -X POST http://localhost:3000/api/auth/mobile/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "mobileNumber": "1234567890",
    "otpCode": "123456"
  }'
```

**Expected Response:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "60c72b2f8e1b9a001c8e8c01",
      "telegramId": "m_1623456789123",
      "mobileNumber": "1234567890",
      "firstName": null,
      "lastName": null,
      "isOnboarded": false
    }
  },
  "meta": {
    "timestamp": "2023-03-14T10:25:30.123Z",
    "status": 200,
    "path": "/api/auth/mobile/verify-otp"
  }
}
```

### 3. Logout (Requires Authentication)

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Expected Response:**
```json
{
  "data": {
    "message": "Successfully logged out"
  },
  "meta": {
    "timestamp": "2023-03-14T10:30:30.123Z",
    "status": 200,
    "path": "/api/auth/logout"
  }
}
```

## Using the APIs with Swagger UI

1. Navigate to `http://localhost:3000/api/docs` in your browser
2. Find the "auth" section and expand it
3. For OTP authentication:
   - First use the `/api/auth/mobile/send-otp` endpoint to request an OTP
   - Then use the `/api/auth/mobile/verify-otp` endpoint with the received OTP
   - The response will include a JWT token
4. Click the "Authorize" button at the top of the Swagger UI
5. Enter your JWT token (with the 'Bearer ' prefix) to authenticate
6. Now you can test authenticated endpoints
7. Use the `/api/auth/logout` endpoint when done

## Authentication Flow

1. Send OTP to user's mobile number
2. User receives OTP (in development, check response or console logs)
3. Submit the OTP for verification
4. Save the returned JWT access token
5. Include the token in the Authorization header for all subsequent API calls
6. Use the logout endpoint when done to invalidate the token

## Security Information

- All timestamps are in ISO 8601 format
- OTP expires after the time specified in the `expiresIn` field (10 minutes by default)
- After too many failed verification attempts, further attempts will be rate-limited
- JWTs are configured to expire after 1 hour
- For security reasons, always use HTTPS in production environments 
# Backend reCAPTCHA Setup Guide

## Overview
The backend now includes reCAPTCHA v2 verification for user registration to prevent bot submissions.

## Required Environment Variables

Add the following environment variable to your `.env` file in the backend directory:

```
RECAPTCHA_SECRET_KEY=your_secret_key_here
```

## How to Get reCAPTCHA Secret Key

1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Find your existing site or create a new one
3. In the site settings, you'll see both:
   - **Site Key** (used in frontend - `NEXT_PUBLIC_SITE_KEY`)
   - **Secret Key** (used in backend - `RECAPTCHA_SECRET_KEY`)
4. Copy the **Secret Key** and add it to your backend `.env` file

## Backend Implementation

The backend now includes:

### 1. reCAPTCHA Verification Function
```javascript
const verifyCaptcha = async (token) => {
  if (!token) {
    return false;
  }

  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      console.error('RECAPTCHA_SECRET_KEY not found in environment variables');
      return false;
    }

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    return false;
  }
};
```

### 2. Updated Registration Endpoint
The `/api/auth/register` endpoint now:
- Extracts the `captcha` token from the request body
- Verifies the token with Google's reCAPTCHA API
- Returns an error if verification fails
- Continues with normal registration if verification succeeds

## API Response

### Success Response
```json
{
  "message": "User registered successfully, Login Now"
}
```

### reCAPTCHA Failure Response
```json
{
  "message": "reCAPTCHA verification failed. Please try again."
}
```

## Security Features

- ✅ Server-side reCAPTCHA verification
- ✅ Environment variable protection for secret key
- ✅ Proper error handling and logging
- ✅ Prevents bot registrations
- ✅ Validates token before processing registration

## Testing

1. Set up your environment variables
2. Start your backend server
3. Test registration with a valid reCAPTCHA token
4. Test registration with an invalid/missing token (should fail)
5. Verify that the frontend receives appropriate error messages

## Error Handling

The backend includes comprehensive error handling:
- Missing secret key in environment variables
- Network errors during reCAPTCHA verification
- Invalid or expired tokens
- Missing captcha token in request

## Notes

- The secret key should never be exposed to the frontend
- Keep your secret key secure and never commit it to version control
- The verification happens before any user data is processed
- Failed reCAPTCHA verification prevents user registration completely

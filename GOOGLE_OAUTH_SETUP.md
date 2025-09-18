# Google OAuth2 Setup for GlowWorm

This document explains how to configure Google OAuth2 authentication for GlowWorm.

## Prerequisites

1. A Google Cloud Platform account
2. Access to Google Cloud Console

## Step 1: Create Google OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth2 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:8001/api/auth/google/callback` (for development)
     - `https://yourdomain.com/api/auth/google/callback` (for production)
5. Copy the Client ID and Client Secret

## Step 2: Configure GlowWorm

1. Open `backend/.env` file
2. Replace the placeholder values:
   ```
   google_client_id=your_actual_client_id_here
   google_client_secret=your_actual_client_secret_here
   ```
3. Restart the backend server

## Step 3: Configure Admin Users

1. Open `backend/services/google_oauth_service.py`
2. In the `__init__` method, update the `admin_emails` list:
   ```python
   self.admin_emails = [
       "admin@glowworm.local",  # Default admin email
       "your-email@gmail.com",  # Add your Google account email
       # Add more admin emails as needed
   ]
   ```

## Step 4: Test the Integration

1. Start the backend server: `cd backend && source venv/bin/activate && uvicorn main:app --reload --host 0.0.0.0 --port 8001`
2. Start the frontend: `cd frontend && npm start`
3. Navigate to `http://localhost:3003/login`
4. Click "Continue with Google"
5. Complete the OAuth flow
6. You should be redirected to the admin dashboard

## Security Notes

- The OAuth2 flow uses PKCE (Proof Key for Code Exchange) for enhanced security
- All tokens are handled server-side and never exposed to the frontend
- Session cookies are HttpOnly, Secure, and SameSite for CSRF protection
- Only emails in the `admin_emails` list can access admin features

## Troubleshooting

- **"Email not authorized for admin access"**: Add your email to the `admin_emails` list
- **"Invalid redirect URI"**: Ensure the redirect URI in Google Console matches exactly
- **"Client ID not found"**: Verify the client ID and secret are correctly set in `.env`

## Production Deployment

For production deployment:
1. Update the redirect URI in Google Console to use your production domain
2. Update the `redirect_uri` in `GoogleOAuthService` to use HTTPS
3. Ensure your production server uses HTTPS for secure cookie transmission

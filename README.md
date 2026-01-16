# Habbit Tracker Tools

A premium Habit Tracker built with Next.js, Google OAuth, and Google Sheets integration.

## Features
- 🔐 Secure Google OAuth Login
- 📊 Real-time sync with Google Sheets
- ✨ Premium UI with Framer Motion
- 🌓 Dark/Light Mode support
- 🚀 Ready for Netlify deployment

## Setup Instructions

### 1. Google Cloud Console Setup
To enable Google login and Sheets sync, you need to create a project in the [Google Cloud Console](https://console.cloud.google.com/):

1. **Create a New Project**.
2. **Enable APIs**:
   - Google Sheets API
   - Google Drive API (optional, for finding sheets)
3. **Configure OAuth Consent Screen**:
   - Set it to "External".
   - Add the scope: `https://www.googleapis.com/auth/spreadsheets`.
4. **Create Credentials**:
   - Create an **OAuth 2.0 Client ID**.
   - Application Type: "Web Application".
   - Authorized Javascript Origins: `http://localhost:3000` (and your Netlify URL).
   - Authorized Redirect URIs: `http://localhost:3000/api/auth/callback/google` (and your Netlify URL equivalent).
5. **Get Credentials**: Copy your **Client ID** and **Client Secret**.

### 2. Environment Variables
Create a `.env.local` file in the root directory:

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_secret_string
```

### 3. Local Development
```bash
npm install
npm run dev
```

### 4. Deployment to Netlify
1. Connect your GitHub repository to Netlify.
2. Add the environment variables from `.env.local` to Netlify's "Site settings > Environment variables".
3. Netlify will automatically detect the Next.js project and deploy it.

## How it works
- When you log in, the app requests permission to manage your spreadsheets.
- Every time you toggle a habit, it appends a row to a sheet named "Habbit Tracker Data" in your Google Drive.
- If the sheet doesn't exist, it creates one for you.

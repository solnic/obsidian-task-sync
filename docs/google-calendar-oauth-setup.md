# Google Calendar OAuth Setup Guide

This guide will help you set up OAuth 2.0 authentication for Google Calendar integration in the Obsidian Task Sync plugin.

## Prerequisites

- A Google account with Google Calendar
- Access to the Google Cloud Console

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click on "Select a project" dropdown at the top
3. Click "New Project"
4. Enter a project name (e.g., "Obsidian Task Sync")
5. Click "Create"

## Step 2: Enable Google Calendar API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Calendar API"
3. Click on "Google Calendar API"
4. Click "Enable"

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type (unless you have a Google Workspace)
3. Click "Create"
4. Fill in the required information:
   - **App name**: Obsidian Task Sync (or your preferred name)
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
5. Click "Save and Continue"
6. On the "Scopes" page, click "Add or Remove Scopes"
7. Search for and add these scopes:
   - `https://www.googleapis.com/auth/calendar.readonly` - Read calendar events
   - `https://www.googleapis.com/auth/calendar.events` - Manage calendar events
8. Click "Update" and then "Save and Continue"
9. On "Test users", add your Google account email
10. Click "Save and Continue"
11. Review and click "Back to Dashboard"

## Step 4: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select "Desktop app" as application type
4. Enter a name (e.g., "Obsidian Task Sync Desktop")
5. Click "Create"
6. You'll see a dialog with your **Client ID** and **Client Secret**
7. **Important**: Copy both values - you'll need them for the plugin

## Step 5: Configure the Plugin

1. Open Obsidian
2. Go to Settings → Task Sync → Integrations
3. Scroll to the "Google Calendar" section
4. Enable "Google Calendar Integration"
5. Paste your **OAuth Client ID** into the "OAuth Client ID" field
6. Paste your **OAuth Client Secret** into the "OAuth Client Secret" field

## Step 6: Authenticate

1. Click the "Authenticate" button
2. Your default browser will open with Google's login page
3. Sign in with your Google account
4. Review the permissions requested:
   - Read and manage your calendar events
5. Click "Allow"
6. You'll be redirected to a success page
7. Return to Obsidian - authentication is complete!

## Troubleshooting

### "OAuth flow not yet implemented" message

Make sure you're using the latest version of the plugin that includes OAuth support.

### Authentication window doesn't open

- Check if your default browser is set correctly
- Try manually copying the authorization URL and pasting it into your browser
- Check if port 42813 is available (the plugin uses this for OAuth callback)

### "Invalid client" error

- Verify that your Client ID and Client Secret are correct
- Make sure you selected "Desktop app" as the application type
- Try creating new credentials

### Token expired

The plugin automatically refreshes expired tokens. If you see authentication errors:
1. Go to Settings → Task Sync → Integrations → Google Calendar
2. Click "Revoke Authentication"
3. Click "Authenticate" again to re-authorize

### Permission denied

Make sure you've:
1. Enabled the Google Calendar API in your Google Cloud project
2. Added the required scopes in the OAuth consent screen
3. Added your Google account as a test user (if app is in "Testing" mode)

## Security Notes

- **Never share your Client Secret** - treat it like a password
- The plugin stores your access token locally in Obsidian's plugin data
- Tokens are automatically refreshed and expire after 1 hour by default
- You can revoke access at any time using the "Revoke Authentication" button
- You can also revoke access from [Google Account Permissions](https://myaccount.google.com/permissions)

## Privacy

- The plugin only requests the minimum required permissions for calendar access
- Your credentials are stored locally and never sent to third-party servers
- The plugin communicates directly with Google's Calendar API
- No calendar data is stored on external servers

## Next Steps

Once authenticated, you can:
- View Google Calendar events in the Day View
- Import calendar events into daily notes
- Schedule tasks as calendar events
- Sync tasks with Google Calendar

See the main documentation for more details on using Google Calendar integration.

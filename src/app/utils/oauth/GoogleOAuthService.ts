/**
 * Google OAuth Service
 * Handles OAuth 2.0 authentication flow for Google APIs
 */

import { requestUrl, Notice } from "obsidian";
import type { TaskSyncSettings } from "../../types/settings";
import http from "http";
import url from "url";
import { shell } from "electron";

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  tokenType: string;
  scope: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export class GoogleOAuthService {
  private static readonly AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
  private static readonly TOKEN_URL = "https://oauth2.googleapis.com/token";
  private static readonly DEFAULT_SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events"
  ];

  private config: OAuthConfig;
  private settings: TaskSyncSettings;
  private saveSettings: () => Promise<void>;

  // Local server for OAuth callback
  private server?: http.Server;
  private serverPort: number = 42813; // Random high port

  constructor(
    settings: TaskSyncSettings,
    saveSettings: () => Promise<void>
  ) {
    this.settings = settings;
    this.saveSettings = saveSettings;
    this.config = {
      clientId: settings.integrations.googleCalendar.clientId,
      clientSecret: settings.integrations.googleCalendar.clientSecret,
      redirectUri: `http://localhost:${this.serverPort}/callback`,
      scopes: GoogleOAuthService.DEFAULT_SCOPES
    };
  }

  /**
   * Update configuration from settings
   */
  updateConfig(): void {
    this.config = {
      clientId: this.settings.integrations.googleCalendar.clientId,
      clientSecret: this.settings.integrations.googleCalendar.clientSecret,
      redirectUri: `http://localhost:${this.serverPort}/callback`,
      scopes: GoogleOAuthService.DEFAULT_SCOPES
    };
  }

  /**
   * Generate authorization URL
   */
  private generateAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: this.config.scopes.join(" "),
      access_type: "offline", // Request refresh token
      prompt: "consent", // Force consent screen to get refresh token
      state: state
    });

    return `${GoogleOAuthService.AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    try {
      const response = await requestUrl({
        url: GoogleOAuthService.TOKEN_URL,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          code: code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
          grant_type: "authorization_code"
        }).toString()
      });

      if (response.status !== 200) {
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      const data = response.json;
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope
      };
    } catch (error: any) {
      console.error("Token exchange error:", error);
      throw new Error(`Failed to exchange authorization code: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<OAuthTokens> {
    const refreshToken = this.settings.integrations.googleCalendar.refreshToken;

    if (!refreshToken) {
      throw new Error("No refresh token available. Please re-authenticate.");
    }

    try {
      const response = await requestUrl({
        url: GoogleOAuthService.TOKEN_URL,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: "refresh_token"
        }).toString()
      });

      if (response.status !== 200) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = response.json;
      return {
        accessToken: data.access_token,
        refreshToken: refreshToken, // Keep existing refresh token
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope || this.config.scopes.join(" ")
      };
    } catch (error: any) {
      console.error("Token refresh error:", error);
      throw new Error(`Failed to refresh access token: ${error.message}`);
    }
  }

  /**
   * Start the OAuth flow
   * This will open a browser window and start a local server to handle the callback
   */
  async startAuthFlow(): Promise<boolean> {
    // Validate configuration
    if (!this.config.clientId || !this.config.clientSecret) {
      new Notice("Please configure OAuth Client ID and Secret first");
      return false;
    }

    try {
      // Generate a random state for CSRF protection
      const state = this.generateRandomState();

      // Start local server to handle callback
      const authCode = await this.startCallbackServer(state);

      if (!authCode) {
        new Notice("OAuth authentication cancelled");
        return false;
      }

      // Exchange authorization code for tokens
      const tokens = await this.exchangeCodeForTokens(authCode);

      // Save tokens to settings
      await this.saveTokens(tokens);

      new Notice("Successfully authenticated with Google Calendar!");
      return true;
    } catch (error: any) {
      console.error("OAuth flow error:", error);
      new Notice(`OAuth authentication failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Start a local HTTP server to handle OAuth callback
   */
  private async startCallbackServer(state: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.stopServer();
          reject(new Error("OAuth flow timed out after 5 minutes"));
        }
      }, 5 * 60 * 1000); // 5 minute timeout

      this.server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
        const queryObject = url.parse(req.url, true).query;

        // Success callback
        if (req.url?.startsWith("/callback")) {
          // Verify state for CSRF protection
          if (queryObject.state !== state) {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end("<html><body><h1>Invalid state parameter</h1></body></html>");
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              this.stopServer();
              reject(new Error("Invalid state parameter"));
            }
            return;
          }

          if (queryObject.code) {
            // Send success response to browser
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 2rem; text-align: center;">
                  <h1 style="color: #4CAF50;">✓ Authorization Successful!</h1>
                  <p>You can close this window and return to Obsidian.</p>
                  <script>window.close();</script>
                </body>
              </html>
            `);

            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              this.stopServer();
              resolve(queryObject.code as string);
            }
          } else if (queryObject.error) {
            // Handle error - sanitize the error message to prevent XSS
            const sanitizedError = String(queryObject.error)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#x27;');

            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 2rem; text-align: center;">
                  <h1 style="color: #f44336;">✗ Authorization Failed</h1>
                  <p>Error: ${sanitizedError}</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);

            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              this.stopServer();
              reject(new Error(`OAuth error: ${queryObject.error}`));
            }
          }
        } else {
          // Unknown path
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
        }
      });

      this.server.on("error", (error: Error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.stopServer();
          reject(new Error(`Server error: ${error.message}`));
        }
      });

      this.server.listen(this.serverPort, "127.0.0.1", () => {
        console.log(`OAuth callback server listening on port ${this.serverPort}`);

        // Open authorization URL in browser
        const authUrl = this.generateAuthUrl(state);
        this.openUrl(authUrl);
      });
    });
  }

  /**
   * Stop the callback server
   */
  private stopServer(): void {
    if (this.server && !this.server.listening) {
      // Server already closed
      this.server = undefined;
      return;
    }

    if (this.server) {
      this.server.close();
      this.server = undefined;
    }
  }

  /**
   * Open URL in system browser
   */
  private openUrl(url: string): void {
    shell.openExternal(url);
  }

  /**
   * Generate a random state parameter for CSRF protection
   */
  private generateRandomState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Save OAuth tokens to settings
   */
  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const expiryTime = Date.now() + (tokens.expiresIn * 1000);

    this.settings.integrations.googleCalendar.accessToken = tokens.accessToken;
    this.settings.integrations.googleCalendar.refreshToken = tokens.refreshToken;
    this.settings.integrations.googleCalendar.tokenExpiry = expiryTime;

    console.log(`[GoogleOAuth] Saved tokens, expiry: ${new Date(expiryTime).toISOString()}`);
    await this.saveSettings();
  }

    /**
   * Check if current access token is expired
   */
  isTokenExpired(): boolean {
    const tokenExpiry = this.settings.integrations.googleCalendar.tokenExpiry;
    if (!tokenExpiry) {
      console.log("[GoogleOAuth] No token expiry set, considering token expired");
      return true;
    }
    // Add 5 minute buffer before actual expiry
    const isExpired = Date.now() >= (tokenExpiry - 5 * 60 * 1000);
    const expiryDate = new Date(tokenExpiry);
    const timeUntilExpiry = tokenExpiry - Date.now();

    if (isExpired) {
      console.log(`[GoogleOAuth] Token expired (expiry: ${expiryDate.toISOString()})`);
    } else {
      console.log(`[GoogleOAuth] Token valid (expires in ${Math.round(timeUntilExpiry / 1000)}s at ${expiryDate.toISOString()})`);
    }

    return isExpired;
  }

  /**
   * Revoke OAuth tokens
   */
  async revokeTokens(): Promise<void> {
    const accessToken = this.settings.integrations.googleCalendar.accessToken;

    if (accessToken) {
      try {
        await requestUrl({
          url: `https://oauth2.googleapis.com/revoke?token=${accessToken}`,
          method: "POST"
        });
      } catch (error) {
        console.error("Failed to revoke token:", error);
        // Continue anyway to clear local tokens
      }
    }

    // Clear tokens from settings
    this.settings.integrations.googleCalendar.accessToken = "";
    this.settings.integrations.googleCalendar.refreshToken = "";
    this.settings.integrations.googleCalendar.tokenExpiry = 0;

    await this.saveSettings();
    new Notice("Google Calendar authentication cleared");
  }
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClientError {
  type: string;
}

interface GoogleTokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient(options: {
          client_id: string;
          scope: string;
          callback: (response: GoogleTokenResponse) => void;
          error_callback?: (error: GoogleTokenClientError) => void;
        }): GoogleTokenClient;
      };
    };
  };
}

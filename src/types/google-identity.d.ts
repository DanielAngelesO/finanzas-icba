interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
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
        }): GoogleTokenClient;
      };
    };
  };
}

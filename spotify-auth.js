class SpotifyAuth {
  constructor() {
    this.clientId = 'd5a7b3f85edc436d80e3ee703756cbd0';
    this.redirectUri = 'https://n8nlink.bieda.it/rest/oauth2-credential/callback';
    this.accessToken = null;
    this.expiresAt = null;
    
    // Sprawdź czy mamy token zapisany w localStorage (sprawdź oba klucze dla zgodności)
    this.loadTokenFromStorage();
    
    // Sprawdź czy właśnie wracamy z procesu autoryzacji
    this.checkUrlForToken();
  }
  
  loadTokenFromStorage() {
    // Próbuje odczytać token z obu możliwych kluczy
    let tokenData = localStorage.getItem('spotify_auth_data');
    const legacyToken = localStorage.getItem('spotify_token');
    
    // Jeśli mamy stary format tokenu, konwertuj go
    if (!tokenData && legacyToken) {
      tokenData = JSON.stringify({
        access_token: legacyToken,
        expires_at: new Date().getTime() + (3600 * 1000) // Zakładamy 1 godzinę
      });
      localStorage.setItem('spotify_auth_data', tokenData);
    }
    
    if (tokenData) {
      try {
        const parsed = JSON.parse(tokenData);
        this.accessToken = parsed.access_token;
        this.expiresAt = parsed.expires_at;
        
        // Dla zgodności z app.js, zapisz token również pod starym kluczem
        localStorage.setItem('spotify_token', this.accessToken);
        
        // Sprawdź czy token jest wciąż ważny
        if (this.expiresAt && new Date().getTime() > this.expiresAt) {
          this.clearToken();
        } else {
          console.log('Załadowano zapisany token Spotify');
          document.dispatchEvent(new CustomEvent('spotify-authenticated'));
        }
      } catch (e) {
        console.error('Błąd podczas wczytywania tokenu:', e);
        this.clearToken();
      }
    }
  }
  
  checkUrlForToken() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      console.log('Wykryto token w URL');
      // Usuń parametr token z adresu URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      // Zapisz token
      this.accessToken = token;
      this.expiresAt = new Date().getTime() + (3600 * 1000); // 1 godzina
      this.saveTokenToStorage();
      
      // Powiadom aplikację o zalogowaniu
      document.dispatchEvent(new CustomEvent('spotify-authenticated'));
    }
  }
  
  saveTokenToStorage() {
    const tokenData = {
      access_token: this.accessToken,
      expires_at: this.expiresAt
    };
    localStorage.setItem('spotify_auth_data', JSON.stringify(tokenData));
  }
  
  clearToken() {
    this.accessToken = null;
    this.expiresAt = null;
    localStorage.removeItem('spotify_auth_data');
    localStorage.removeItem('spotify_token'); // Usuń również stary klucz
  }
  
  login() {
    // Zapisz aktualny URL jako returnUrl
    const returnUrl = window.location.href;
    
    // Używamy tej samej metody kodowania co w Node.js
    // Zamiast btoa() używamy prostego kodowania URI
    window.location.href = `/login?state=${encodeURIComponent(returnUrl)}`;
  }
  
  getAccessToken() {
    return this.accessToken;
  }
  
  isAuthenticated() {
    return this.accessToken !== null && this.expiresAt > new Date().getTime();
  }
}

// Inicjalizacja przy załadowaniu
const spotifyAuth = new SpotifyAuth();

// Eksport do globalnego użycia
window.spotifyAuth = spotifyAuth;
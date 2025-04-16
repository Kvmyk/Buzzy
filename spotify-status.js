class SpotifyStatus {
  constructor() {
    this.container = document.getElementById('spotify-status-container');
    this.user = null;
    
    // Nasłuchuj na zdarzenia uwierzytelnienia
    document.addEventListener('spotify-authenticated', () => this.onAuthenticated());
    
    // Aktualizuj status przy ładowaniu
    this.updateStatus();
  }
  
  async onAuthenticated() {
    try {
      // Pobierz dane użytkownika z API Spotify
      await this.fetchUserProfile();
      // Zaktualizuj UI
      this.updateStatus();
    } catch (error) {
      console.error('Błąd podczas ładowania profilu:', error);
    }
  }
  
  async fetchUserProfile() {
    if (!window.spotifyAuth.isAuthenticated()) {
      this.user = null;
      return;
    }
    
    const token = window.spotifyAuth.getAccessToken();
    
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      this.user = await response.json();
    } else if (response.status === 401) {
      // Token wygasł
      window.spotifyAuth.clearToken();
      this.user = null;
    }
  }
  
  updateStatus() {
    if (!this.container) return;
    
    if (window.spotifyAuth && window.spotifyAuth.isAuthenticated()) {
      // Stan zalogowania
      if (this.user) {
        this.container.innerHTML = `
          <div class="card spotify-status-card">
            <div class="spotify-status-header">
              <i class="fab fa-spotify"></i> Połączono ze Spotify
            </div>
            <div class="spotify-profile">
              ${this.user.images && this.user.images.length > 0 ? 
                `<img src="${this.user.images[0].url}" alt="Profilowe" class="profile-image">` :
                `<div class="profile-placeholder"><i class="fas fa-user"></i></div>`
              }
              <div class="profile-info">
                <div class="profile-name">${this.user.display_name || 'Użytkownik Spotify'}</div>
                <div class="profile-email">${this.user.email || ''}</div>
              </div>
            </div>
            <div class="spotify-info">
              Aplikacja ma dostęp do tworzenia playlist w Twoim koncie Spotify.
            </div>
            <button class="btn-spotify btn-disconnect" onclick="window.spotifyAuth.clearToken(); window.location.reload();">
              <i class="fas fa-sign-out-alt"></i> Wyloguj
            </button>
          </div>
        `;
      } else {
        this.container.innerHTML = `
          <div class="card spotify-status-card">
            <div class="spotify-status-header">
              <i class="fab fa-spotify"></i> Połączono ze Spotify
            </div>
            <div class="spotify-info">
              Ładowanie danych profilu...
            </div>
          </div>
        `;
        
        // Spróbuj pobrać dane użytkownika
        this.fetchUserProfile().then(() => this.updateStatus());
      }
    } else {
      // Stan wylogowania
      this.container.innerHTML = `
        <div class="card spotify-status-card">
          <div class="spotify-status-header">
            <i class="fab fa-spotify"></i> Spotify
          </div>
          <div class="spotify-info">
            Połącz swoje konto Spotify, aby móc tworzyć playlisty z nagrań.
          </div>
          <button class="btn-spotify" onclick="window.spotifyAuth.login()">
            <i class="fab fa-spotify"></i> Połącz ze Spotify
          </button>
        </div>
      `;
    }
  }
}

// Inicjalizacja przy załadowaniu
document.addEventListener('DOMContentLoaded', () => {
  new SpotifyStatus();
});
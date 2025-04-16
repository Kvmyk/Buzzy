/**
 * Komponent do wyświetlania statusu połączenia ze Spotify
 */
class SpotifyStatusComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.authManager = new SpotifyAuthManager();
    this.init();
  }
  
  async init() {
    try {
      if (!this.container) return;
      
      const isAuthenticated = await this.authManager.isAuthenticated();
      this.updateUI(isAuthenticated);
    } catch (error) {
      console.error('Błąd podczas inicjalizacji statusu Spotify:', error);
      this.showError('Nie udało się sprawdzić połączenia ze Spotify');
    }
  }
  
  async updateUI(isAuthenticated) {
    // Wyczyść kontener
    this.container.innerHTML = '';
    
    const statusCard = document.createElement('div');
    statusCard.className = 'card spotify-status-card';
    
    if (isAuthenticated) {
      // Pobierz podstawowe dane profilu
      try {
        const profile = await this.fetchSpotifyProfile();
        statusCard.innerHTML = `
          <div class="spotify-status-header">
            <i class="fab fa-spotify"></i> Połączono ze Spotify
          </div>
          <div class="spotify-profile">
            ${profile.images && profile.images[0] ? 
              `<img src="${profile.images[0].url}" alt="Zdjęcie profilowe" class="profile-image">` : 
              `<span class="profile-placeholder"><i class="fas fa-user"></i></span>`
            }
            <div class="profile-info">
              <div class="profile-name">${profile.display_name || 'Użytkownik Spotify'}</div>
              <div class="profile-email">${profile.email || ''}</div>
            </div>
          </div>
          <button id="spotify-disconnect" class="btn-spotify btn-disconnect">
            <i class="fas fa-sign-out-alt"></i> Wyloguj
          </button>
        `;
        
        // Dodaj obsługę przycisku wylogowania
        statusCard.querySelector('#spotify-disconnect').addEventListener('click', 
          () => this.authManager.logout());
          
      } catch (error) {
        console.error('Błąd podczas pobierania profilu:', error);
        statusCard.innerHTML = `
          <div class="spotify-status-header">
            <i class="fab fa-spotify"></i> Połączono ze Spotify
          </div>
          <button id="spotify-disconnect" class="btn-spotify btn-disconnect">
            <i class="fas fa-sign-out-alt"></i> Wyloguj
          </button>
        `;
      }
    } else {
      statusCard.innerHTML = `
        <div class="spotify-status-header">
          <i class="fab fa-spotify"></i> Spotify nie połączono
        </div>
        <p class="spotify-info">Połącz się z kontem Spotify, aby korzystać z wszystkich funkcji.</p>
        <button id="spotify-connect" class="btn-spotify">
          <i class="fab fa-spotify"></i> Połącz ze Spotify
        </button>
      `;
      
      // Dodaj obsługę przycisku logowania
      statusCard.querySelector('#spotify-connect').addEventListener('click', 
        () => this.authManager.authenticate());
    }
    
    this.container.appendChild(statusCard);
  }
  
  async fetchSpotifyProfile() {
    try {
      const response = await fetch('/api/spotify/profile', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Błąd podczas pobierania profilu Spotify:', error);
      return {};
    }
  }
  
  showError(message) {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-circle"></i>
        ${message}
      </div>
    `;
  }
}

// Inicjalizuj komponent po załadowaniu strony
document.addEventListener('DOMContentLoaded', () => {
  // Możesz umieścić ten element w swoim HTML
  new SpotifyStatusComponent('spotify-status-container');
});
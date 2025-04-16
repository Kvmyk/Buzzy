/**
 * Spotify Authentication Helper
 * Bezpieczna implementacja uwierzytelniania przez Spotify
 */
class SpotifyAuthManager {
    constructor() {
        this.clientId = 'd5a7b3f85edc436d80e3ee703756cbd0';
        this.redirectUri = encodeURIComponent('https://n8nlink.bieda.it/rest/oauth2-credential/callback');
        this.scope = 'user-read-private user-read-email'; // Wymagane uprawnienia
        this.apiBase = '/api'; // Adres naszego API backendowego
    }

    /**
     * Sprawdza czy użytkownik jest zalogowany
     */
    async isAuthenticated() {
        try {
            // Wykorzystujemy endpoint API do sprawdzenia sesji
            const response = await fetch(`${this.apiBase}/spotify/check-auth`, {
                method: 'GET',
                credentials: 'include' // Ważne: wysyłamy ciasteczka
            });
            
            if (response.ok) {
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Błąd sprawdzania autoryzacji:', error);
            return false;
        }
    }

    /**
     * Rozpoczyna proces uwierzytelniania
     */
    authenticate() {
        // Zapisujemy URL do przekierowania po uwierzytelnieniu
        localStorage.setItem('spotify_auth_redirect', window.location.href);
        
        // Przekierowanie do strony logowania Spotify
        const authUrl = `https://accounts.spotify.com/authorize?client_id=${this.clientId}&response_type=code&redirect_uri=${this.redirectUri}&scope=${this.scope}&show_dialog=true`;
        window.location.href = authUrl;
    }

    /**
     * Obsługuje powrót z autoryzacji Spotify
     */
    async handleCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        
        if (error) {
            console.error('Błąd autoryzacji Spotify:', error);
            return false;
        }
        
        if (code) {
            try {
                // Wysyłamy kod autoryzacyjny do naszego backendu
                const response = await fetch(`${this.apiBase}/spotify/callback`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ code }),
                    credentials: 'include' // Ważne: akceptujemy ciasteczka zwrotne
                });
                
                if (!response.ok) {
                    throw new Error(`Błąd serwera: ${response.status}`);
                }
                
                // Przekierowanie z powrotem na oryginalną stronę
                const redirectUrl = localStorage.getItem('spotify_auth_redirect') || '/';
                window.location.href = redirectUrl;
                return true;
            } catch (error) {
                console.error('Błąd podczas wymiany kodu autoryzacji:', error);
                return false;
            }
        }
        
        return false;
    }

    /**
     * Wylogowuje użytkownika
     */
    async logout() {
        try {
            await fetch(`${this.apiBase}/spotify/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            
            // Przekierowanie na stronę główną
            window.location.href = '/';
        } catch (error) {
            console.error('Błąd podczas wylogowywania:', error);
        }
    }
}

// Inicjalizacja przy załadowaniu strony
document.addEventListener('DOMContentLoaded', async () => {
    const spotifyAuth = new SpotifyAuthManager();
    
    // Sprawdzamy czy jesteśmy na stronie callback
    if (window.location.href.includes('oauth2-credential/callback')) {
        await spotifyAuth.handleCallback();
    } 
    // W przeciwnym razie sprawdzamy czy użytkownik jest uwierzytelniony
    else if (!await spotifyAuth.isAuthenticated()) {
        spotifyAuth.authenticate();
    }
    
    // Jeśli dodasz przycisk wylogowywania, możesz go obsłużyć tak:
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => spotifyAuth.logout());
    }
});
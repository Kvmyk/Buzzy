class RecorderApp {
    constructor() {
        this.recordButton = document.getElementById('record-button');
        this.statusLabel = document.getElementById('status-label');
        this.recordingIcon = document.getElementById('recording-icon');
        this.timerLabel = document.getElementById('timer-label');
        this.levelBar = document.getElementById('level-bar');
        this.lastRecordingInfo = document.getElementById('last-recording-info');
        
        this.recording = false;
        this.recordingStartTime = null;
        this.timerInterval = null;
        this.levelInterval = null;
        this.audioChunks = [];
        this.mediaRecorder = null;
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        
        this.setupEventListeners();
        this.checkAuthentication();
    }
    
    checkAuthentication() {
        // Check if we have a token in URL params (from redirect)
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (token) {
            // We have a token in URL, which means the server has set cookies
            // Clean up the URL without reloading the page
            window.history.replaceState({}, document.title, window.location.pathname);
            this.enableRecording();
        } else {
            // Check if we can access the cookies via endpoint
            fetch('/check-auth')
                .then(response => response.json())
                .then(data => {
                    if (data.authenticated) {
                        this.enableRecording();
                    } else {
                        this.showLoginRequired();
                    }
                })
                .catch(error => {
                    console.error('Auth check failed:', error);
                    this.showLoginRequired();
                });
        }
    }
    
    enableRecording() {
        this.recordButton.disabled = false;
        this.updateRecordingStatus('ready');
    }
    
    showLoginRequired() {
        this.recordButton.disabled = true;
        this.statusLabel.textContent = 'Wymagane logowanie Spotify';
        
        // Update recording icon
        this.recordingIcon.textContent = '🔒';
        this.recordingIcon.classList.add('locked');
    }
    
    setupEventListeners() {
        this.recordButton.addEventListener('click', () => this.toggleRecording());
    }
    
    toggleRecording() {
        if (!this.recording) {
            this.startRecording();
        } else {
            this.stopRecording();
        }
    }
    
    async startRecording() {
        try {
            this.audioChunks = [];
            
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Create MediaRecorder
            this.mediaRecorder = new MediaRecorder(stream);
            
            // Set up Web Audio API for level visualization
            this.setupAudioAnalyser(stream);
            
            // Start updating level visualization
            this.levelInterval = setInterval(() => this.updateAudioLevel(), 50);
            
            // Handle recorded data
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            // Start recording
            this.mediaRecorder.start();
            
            // Update UI
            this.recording = true;
            this.recordButton.textContent = 'ZATRZYMAJ';
            this.recordButton.classList.add('recording');
            this.updateRecordingStatus('recording');
            
            // Set up blinking animation
            this.recordingIcon.textContent = '🔴';
            this.recordingIcon.classList.add('blink');
            
            // Start timer
            this.recordingStartTime = Date.now();
            this.timerInterval = setInterval(() => this.updateTimer(), 100);
            
        } catch (error) {
            console.error('Błąd podczas uruchamiania nagrywania:', error);
            this.statusLabel.textContent = `Błąd: ${error.message}`;
        }
    }
    
    setupAudioAnalyser(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        
        source.connect(this.analyser);
        // Not connecting to destination to avoid feedback
        
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }
    
    updateAudioLevel() {
        if (!this.analyser) return;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (const value of this.dataArray) {
            sum += value;
        }
        
        // Calculate average level and scale (0-100)
        const average = sum / this.dataArray.length;
        const scaledLevel = Math.min(100, average * 100 / 256);
        
        // Update level bar
        this.levelBar.style.width = `${scaledLevel}%`;
    }
    
    updateTimer() {
        if (!this.recordingStartTime) return;
        
        const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        
        this.timerLabel.textContent = `${minutes}:${seconds}`;
    }
    
    async stopRecording() {
        if (!this.recording || !this.mediaRecorder) return;
        
        // Stop recording
        this.mediaRecorder.stop();
        
        // Update UI
        this.recording = false;
        this.recordButton.textContent = 'NAGRYWAJ';
        this.recordButton.classList.remove('recording');
        this.statusLabel.textContent = 'Przetwarzanie...';
        
        // Stop animations and timers
        this.recordingIcon.textContent = '⚪';
        this.recordingIcon.classList.remove('blink');
        
        clearInterval(this.timerInterval);
        clearInterval(this.levelInterval);
        
        // Reset level bar
        this.levelBar.style.width = '0%';
        
        // Calculate recording duration
        const recordingDuration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        
        // Wait for the final data
        await new Promise(resolve => {
            this.mediaRecorder.onstop = resolve;
        });
        
        // Process recorded audio
        this.processAudio(recordingDuration);
        
        // Stop all tracks
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        
        // Clean up audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }
    
    async processAudio(duration) {
        try {
            if (this.audioChunks.length === 0) {
                this.statusLabel.textContent = 'Brak danych audio do zapisania';
                return;
            }
            
            // Create audio blob
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
            const filename = `nagranie_${timestamp}.wav`;
            
            // Get file size in KB
            const fileSize = audioBlob.size / 1024;
            
            // Update status
            this.statusLabel.textContent = `Zapisano: ${filename} (${fileSize.toFixed(1)} KB)`;
            
            // Update last recording info
            const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
            const seconds = (duration % 60).toString().padStart(2, '0');
            this.lastRecordingInfo.textContent = `Ostatnie nagranie: ${filename}
Czas: ${minutes}:${seconds}, Rozmiar: ${fileSize.toFixed(1)} KB`;
            
            // Send the file
            await this.sendAudioFile(audioBlob, filename);
            
        } catch (error) {
            console.error('Błąd podczas przetwarzania audio:', error);
            this.statusLabel.textContent = `Błąd: ${error.message}`;
        }
    }
    
    async sendAudioFile(audioBlob, filename) {
        const url = "https://n8nlink.bieda.it/webhook-test/c4fa58af-d8d4-4930-9003-4c10711064e2";
        
        try {
            this.statusLabel.textContent = 'Wysyłanie pliku...';
            
            // Create form data for file upload
            const formData = new FormData();
            formData.append('file', audioBlob, filename);
            
            // Pobierz tokeny z endpointu API zamiast z cookies
            try {
                const tokenResponse = await fetch('/get-tokens');
                if (tokenResponse.ok) {
                    const tokenData = await tokenResponse.json();
                    
                    // Dodaj tokeny do formularza
                    if (tokenData.access_token) {
                        formData.append('access_token', tokenData.access_token);
                    }
                    if (tokenData.refresh_token) {
                        formData.append('refresh_token', tokenData.refresh_token);
                    }
                    
                    console.log('Pobrano tokeny do wysyłki'); // Pomocniczy log
                } else {
                    console.warn('Nie udało się pobrać tokenów:', tokenResponse.status);
                }
            } catch (tokenError) {
                console.warn('Błąd podczas pobierania tokenów:', tokenError);
            }
            
            // Send the file
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                this.updateRecordingStatus('success');
            } else {
                const errorText = await response.text();
                throw new Error(`${response.status} - ${errorText}`);
            }
            
        } catch (error) {
            console.error('Błąd podczas wysyłania pliku:', error);
            this.statusLabel.textContent = `Błąd: ${error.message}`;
            this.updateRecordingStatus('ready');
        }
    }
    
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }
    
    updateRecordingStatus(status) {
        this.recordingIcon.classList.remove('recording-icon-ready', 'recording-icon-active', 'recording-icon-success');
        
        switch(status) {
            case 'ready':
                this.recordingIcon.classList.add('recording-icon-ready');
                this.statusLabel.textContent = 'Gotowy do nagrywania';
                break;
            case 'recording':
                this.recordingIcon.classList.add('recording-icon-active');
                this.statusLabel.textContent = 'Nagrywanie w toku...';
                break;
            case 'success':
                this.recordingIcon.classList.add('recording-icon-success');
                this.statusLabel.textContent = 'Nagranie wysłane pomyślnie';
                setTimeout(() => this.updateRecordingStatus('ready'), 3000);
                break;
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new RecorderApp();
});

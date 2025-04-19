// recorder.js

class RecorderApp {
    constructor() {
        // Spotify auth params
        const params = new URLSearchParams(window.location.search);
        this.accessToken  = params.get('access_token');
        this.refreshToken = params.get('refresh_token');
        this.expiresIn    = parseInt(params.get('expires_in'), 10);
        // Clear URL so tokens aren’t visible
        if (this.accessToken) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // UI elements
        this.recordButton = document.getElementById('record-button');
        this.statusLabel = document.getElementById('status-label');
        this.recordingIcon = document.getElementById('recording-icon');
        this.timerLabel = document.getElementById('timer-label');
        this.levelBar = document.getElementById('level-bar');
        this.lastRecordingInfo = document.getElementById('last-recording-info');

        // Recording state
        this.recording = false;
        this.recordingStartTime = null;
        this.timerInterval = null;
        this.levelInterval = null;
        this.audioChunks = [];
        this.mediaRecorder = null;
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;

        // If we have an expiry, schedule a refresh 1 minute before
        if (this.refreshToken && this.expiresIn) {
            setTimeout(() => this.refreshAccessToken(), (this.expiresIn - 60) * 1000);
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.recordButton.addEventListener('click', () => this.toggleRecording());
    }

    toggleRecording() {
        this.recording ? this.stopRecording() : this.startRecording();
    }

    async startRecording() {
        try {
            this.audioChunks = [];
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.setupAudioAnalyser(stream);
            this.levelInterval = setInterval(() => this.updateAudioLevel(), 50);

            this.mediaRecorder.ondataavailable = e => {
                if (e.data.size) this.audioChunks.push(e.data);
            };
            this.mediaRecorder.start();

            // UI updates
            this.recording = true;
            this.recordButton.textContent = 'ZATRZYMAJ';
            this.recordButton.classList.add('recording');
            this.updateRecordingStatus('recording');
            this.recordingIcon.textContent = '🔴';
            this.recordingIcon.classList.add('blink');

            this.recordingStartTime = Date.now();
            this.timerInterval = setInterval(() => this.updateTimer(), 100);
        } catch (err) {
            console.error('Start recording error:', err);
            this.statusLabel.textContent = `Błąd: ${err.message}`;
        }
    }

    setupAudioAnalyser(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    updateAudioLevel() {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (let v of this.dataArray) sum += v;
        const avg = sum / this.dataArray.length;
        const level = Math.min(100, avg * 100 / 256);
        this.levelBar.style.width = `${level}%`;
    }

    updateTimer() {
        const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        this.timerLabel.textContent = `${m}:${s}`;
    }

    async stopRecording() {
        if (!this.mediaRecorder) return;
        this.mediaRecorder.stop();

        this.recording = false;
        this.recordButton.textContent = 'NAGRYWAJ';
        this.recordButton.classList.remove('recording');
        this.statusLabel.textContent = 'Przetwarzanie...';
        this.recordingIcon.textContent = '⚪';
        this.recordingIcon.classList.remove('blink');
        clearInterval(this.timerInterval);
        clearInterval(this.levelInterval);
        this.levelBar.style.width = '0%';

        const duration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        await new Promise(r => this.mediaRecorder.onstop = r);

        this.processAudio(duration);
        this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
        if (this.audioContext && this.audioContext.state !== 'closed') this.audioContext.close();
    }

    async processAudio(duration) {
        if (!this.audioChunks.length) {
            this.statusLabel.textContent = 'Brak danych audio';
            return;
        }
        const blob = new Blob(this.audioChunks, { type: 'audio/wav' });
        const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0,15);
        const filename = `nagranie_${ts}.wav`;
        const sizeKB = (blob.size/1024).toFixed(1);

        this.statusLabel.textContent = `Zapisano: ${filename} (${sizeKB} KB)`;
        this.lastRecordingInfo.textContent = `Ostatnie: ${filename}, czas ${String(Math.floor(duration/60)).padStart(2,'0')}:${String(duration%60).padStart(2,'0')}, rozmiar ${sizeKB} KB`;

        await this.sendAudioFile(blob, filename);
    }

    async sendAudioFile(blob, filename) {
        this.statusLabel.textContent = 'Wysyłanie pliku...';
        const form = new FormData();
        form.append('file', blob, filename);
        // dołącz token Spotify do nagłówka, jeśli jest
        const headers = this.accessToken ? { 'Authorization': `Bearer ${this.accessToken}` } : {};
        try {
            const res = await fetch('https://n8nlink.bieda.it/webhook/c4fa58af-d8d4-4930-9003-4c10711064e2', {
                method: 'POST', body: form, headers
            });
            if (!res.ok) throw new Error(res.statusText);
            this.updateRecordingStatus('success');
        } catch (err) {
            console.error('Send file error:', err);
            this.statusLabel.textContent = `Błąd: ${err.message}`;
            this.updateRecordingStatus('ready');
        }
    }

    async refreshAccessToken() {
        try {
            const res = await fetch(`/refresh_token?refresh_token=${this.refreshToken}`);
            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();
            this.accessToken = data.access_token;
            this.expiresIn = data.expires_in;
            setTimeout(() => this.refreshAccessToken(), (this.expiresIn - 60) * 1000);
            console.log('Token odświeżony');
        } catch (err) {
            console.error('Refresh failed:', err);
        }
    }

    updateRecordingStatus(status) {
        this.recordingIcon.classList.remove('recording-icon-ready','recording-icon-active','recording-icon-success');
        switch(status) {
            case 'ready': this.recordingIcon.classList.add('recording-icon-ready'); this.statusLabel.textContent='Gotowy'; break;
            case 'recording': this.recordingIcon.classList.add('recording-icon-active'); this.statusLabel.textContent='Nagrywanie…'; break;
            case 'success': this.recordingIcon.classList.add('recording-icon-success'); this.statusLabel.textContent='Wysłano pomyślnie'; setTimeout(()=>this.updateRecordingStatus('ready'),3000); break;
        }
    }
}

document.addEventListener('DOMContentLoaded', ()=> new RecorderApp());

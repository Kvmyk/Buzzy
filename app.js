class RecorderApp {
    constructor() {
        // Retrieve token from URL or localStorage
        const urlParams = new URLSearchParams(window.location.search);
        this.token = urlParams.get('token') || localStorage.getItem('spotify_token');
        if (urlParams.get('token')) {
            localStorage.setItem('spotify_token', this.token);
            // Remove token from URL to clean up
            window.history.replaceState({}, document.title, window.location.pathname);
        }

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
        
        this.initializeUI();
        this.setupEventListeners();
    }
    
    initializeUI() {
        if (!this.token) {
            this.recordButton.disabled = true;
            this.statusLabel.textContent = 'Proszę najpierw autoryzować się w Spotify.';
        } else {
            this.recordButton.disabled = false;
            this.statusLabel.textContent = 'Gotowy do nagrywania';
        }
    }
    
    setupEventListeners() {
        this.recordButton.addEventListener('click', () => this.toggleRecording());
    }
    
    toggleRecording() {
        if (!this.recording) this.startRecording();
        else this.stopRecording();
    }
    
    async startRecording() {
        try {
            this.audioChunks = [];
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.setupAudioAnalyser(stream);
            this.levelInterval = setInterval(() => this.updateAudioLevel(), 50);
            this.mediaRecorder.ondataavailable = e => { if (e.data.size) this.audioChunks.push(e.data); };
            this.mediaRecorder.start();
            this.recording = true;
            this.recordButton.textContent = 'ZATRZYMAJ';
            this.recordButton.classList.add('recording');
            this.updateRecordingStatus('recording');
            this.recordingIcon.textContent = '🔴';
            this.recordingIcon.classList.add('blink');
            this.recordingStartTime = Date.now();
            this.timerInterval = setInterval(() => this.updateTimer(), 100);
        } catch (error) {
            console.error('Błąd podczas nagrywania:', error);
            this.statusLabel.textContent = `Błąd: ${error.message}`;
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
        const avg = this.dataArray.reduce((sum, v) => sum + v, 0) / this.dataArray.length;
        const level = Math.min(100, avg * 100 / 256);
        this.levelBar.style.width = `${level}%`;
    }
    
    updateTimer() {
        if (!this.recordingStartTime) return;
        const sec = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        const mm = Math.floor(sec / 60).toString().padStart(2, '0');
        const ss = (sec % 60).toString().padStart(2, '0');
        this.timerLabel.textContent = `${mm}:${ss}`;
    }
    
    async stopRecording() {
        if (!this.recording || !this.mediaRecorder) return;
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
            this.statusLabel.textContent = 'Brak danych do wysłania';
            return;
        }
        const blob = new Blob(this.audioChunks, { type: 'audio/wav' });
        const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0,15);
        const filename = `nagranie_${ts}.wav`;
        const sizeKB = (blob.size/1024).toFixed(1);
        this.statusLabel.textContent = `Zapisano: ${filename} (${sizeKB} KB)`;
        const mm = Math.floor(duration/60).toString().padStart(2,'0');
        const ss = (duration%60).toString().padStart(2,'0');
        this.lastRecordingInfo.textContent = `Ostatnie: ${filename} - ${mm}:${ss}, ${sizeKB} KB`;
        await this.sendAudioFile(blob, filename);
    }
    
    async sendAudioFile(blob, filename) {
        const url = 'https://n8nlink.bieda.it/webhook-test/c4fa58af-d8d4-4930-9003-4c10711064e2';
        try {
            this.statusLabel.textContent = 'Wysyłanie pliku...';
            const formData = new FormData();
            formData.append('file', blob, filename);
            formData.append('token', this.token);
            const resp = await fetch(url, { method: 'POST', body: formData });
            if (!resp.ok) throw new Error(`${resp.status} - ${await resp.text()}`);
            this.updateRecordingStatus('success');
        } catch (err) {
            console.error('Błąd podczas wysyłania:', err);
            this.statusLabel.textContent = `Błąd: ${err.message}`;
            this.updateRecordingStatus('ready');
        }
    }
    
    updateRecordingStatus(status) {
        this.recordingIcon.classList.remove('recording-icon-ready','recording-icon-active','recording-icon-success');
        if (status === 'ready') {
            this.recordingIcon.classList.add('recording-icon-ready');
            this.statusLabel.textContent = 'Gotowy do nagrywania';
        } else if (status === 'recording') {
            this.recordingIcon.classList.add('recording-icon-active');
            this.statusLabel.textContent = 'Nagrywanie...';
        } else if (status === 'success') {
            this.recordingIcon.classList.add('recording-icon-success');
            this.statusLabel.textContent = 'Wysłano pomyślnie';
            setTimeout(() => this.updateRecordingStatus('ready'), 3000);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new RecorderApp());

class AudioVisualizer {
    constructor() {
        this.canvas = document.getElementById('visualizer-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.particleCount = 100;
        this.isRecording = false;
        
        this.setupCanvas();
        this.createParticles();
        this.animate();
        
        // Nasłuchuj zmiany stanu nagrywania
        document.getElementById('record-button').addEventListener('click', () => {
            this.isRecording = !this.isRecording;
        });
        
        window.addEventListener('resize', () => this.setupCanvas());
    }
    
    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 5 + 1,
                speedX: Math.random() * 1 - 0.5,
                speedY: Math.random() * 1 - 0.5,
                color: `rgba(255, 204, 0, ${Math.random() * 0.5})`
            });
        }
    }
    
    updateParticles() {
        for (const p of this.particles) {
            // Aktualizuj pozycję
            p.x += p.speedX;
            p.y += p.speedY;
            
            // Efekt pulsacji w trybie nagrywania
            if (this.isRecording) {
                p.size = p.size + Math.sin(Date.now() / 200) * 0.2;
            }
            
            // Zawróć na granicy ekranu
            if (p.x < 0 || p.x > this.canvas.width) p.speedX *= -1;
            if (p.y < 0 || p.y > this.canvas.height) p.speedY *= -1;
        }
    }
    
    drawParticles() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Rysuj połączenia między blisko położonymi cząstkami
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 100) {
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = `rgba(255, 204, 0, ${0.1 - distance/1000})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                }
            }
        }
        
        // Rysuj cząstki
        for (const p of this.particles) {
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Dodaj efekt świecący podczas nagrywania
        if (this.isRecording) {
            const gradient = this.ctx.createRadialGradient(
                this.canvas.width/2, this.canvas.height/2, 0,
                this.canvas.width/2, this.canvas.height/2, this.canvas.width/3
            );
            gradient.addColorStop(0, 'rgba(255, 0, 0, 0.1)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    animate() {
        this.updateParticles();
        this.drawParticles();
        requestAnimationFrame(() => this.animate());
    }
}

// Inicjalizuj wizualizator po załadowaniu strony
document.addEventListener('DOMContentLoaded', () => {
    new AudioVisualizer();
});
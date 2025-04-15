from kivy.app import App
from kivy.uix.button import Button
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.progressbar import ProgressBar
from kivy.clock import Clock
from kivy.graphics import Color, Rectangle
from kivy.core.window import Window
from kivy.uix.image import Image
from kivy.animation import Animation
import sounddevice as sd
import soundfile as sf
import numpy as np
import requests
import os
from datetime import datetime
from threading import Thread
import queue
import time

class RecorderApp(App):
    def build(self):
        # Ustawienie koloru tła okna
        Window.clearcolor = (0.2, 0.2, 0.2, 1)
        
        # Główny layout
        main_layout = BoxLayout(orientation='vertical', padding=20, spacing=15)
        
        # Nagłówek aplikacji
        header = Label(
            text='REJESTRATOR DŹWIĘKU',
            size_hint=(1, 0.1),
            font_size='24sp',
            bold=True,
            color=(0.9, 0.9, 0.9, 1)
        )
        main_layout.add_widget(header)
        
        # Status nagrywania z animowaną ikoną
        status_box = BoxLayout(orientation='horizontal', size_hint=(1, 0.15))
        
        self.recording_icon = Label(
            text='⚪',
            size_hint=(0.1, 1),
            font_size='32sp',
            color=(1, 0.3, 0.3, 1)
        )
        status_box.add_widget(self.recording_icon)
        
        self.status_label = Label(
            text='Gotowy do nagrywania',
            size_hint=(0.9, 1),
            font_size='18sp',
            halign='left',
            valign='middle',
            color=(0.9, 0.9, 0.9, 1)
        )
        self.status_label.bind(size=self.status_label.setter('text_size'))
        status_box.add_widget(self.status_label)
        
        main_layout.add_widget(status_box)
        
        # Timer nagrywania
        self.timer_label = Label(
            text='00:00',
            size_hint=(1, 0.15),
            font_size='40sp',
            bold=True,
            color=(0.9, 0.9, 0.9, 1)
        )
        main_layout.add_widget(self.timer_label)
        
        # Pasek postępu poziomu dźwięku
        level_box = BoxLayout(orientation='vertical', size_hint=(1, 0.15), spacing=5)
        level_label = Label(
            text='Poziom dźwięku:',
            size_hint=(1, 0.3),
            font_size='14sp',
            color=(0.7, 0.7, 0.7, 1)
        )
        level_box.add_widget(level_label)
        
        self.level_bar = ProgressBar(
            max=100,
            value=0,
            size_hint=(1, 0.7)
        )
        level_box.add_widget(self.level_bar)
        
        main_layout.add_widget(level_box)
        
        # Przycisk nagrywania
        self.record_button = Button(
            text='NAGRYWAJ',
            size_hint=(1, 0.3),
            background_color=(0.9, 0.3, 0.3, 1),
            background_normal='',
            font_size='22sp',
            bold=True,
            on_press=self.toggle_recording
        )
        main_layout.add_widget(self.record_button)
        
        # Informacja o ostatnim nagraniu
        self.last_recording_label = Label(
            text='',
            size_hint=(1, 0.15),
            font_size='14sp',
            color=(0.7, 0.7, 0.7, 1)
        )
        main_layout.add_widget(self.last_recording_label)
        
        # Inicjalizacja zmiennych
        self.recording = False
        self.audio_queue = queue.Queue()
        self.sample_rate = 44100
        self.channels = 1
        self.recording_start_time = None
        self.timer_event = None
        self.level_update_event = None
        self.blink_animation = None
        
        return main_layout
    
    def toggle_recording(self, instance):
        if not self.recording:
            self.start_recording()
        else:
            self.stop_recording()
    
    def start_recording(self):
        self.recording = True
        self.record_button.text = 'ZATRZYMAJ'
        self.record_button.background_color = (0.2, 0.6, 0.2, 1)
        self.status_label.text = 'Nagrywanie...'
        
        # Animacja migającego wskaźnika
        self.recording_icon.text = '🔴'
        self.blink_animation = Animation(opacity=0.3, duration=0.5) + Animation(opacity=1, duration=0.5)
        self.blink_animation.repeat = True
        self.blink_animation.start(self.recording_icon)
        
        # Rozpocznij timer
        self.recording_start_time = time.time()
        self.timer_event = Clock.schedule_interval(self.update_timer, 0.1)
        
        # Rozpocznij aktualizację poziomu dźwięku
        self.level_update_event = Clock.schedule_interval(self.update_level, 0.05)
        
        # Callback dla strumienia audio
        def callback(indata, frames, time, status):
            if status:
                print(status)
            self.audio_queue.put(indata.copy())
            
            # Aktualizacja poziomu dźwięku (używane do wizualizacji)
            if indata.size > 0:
                level = np.abs(indata).mean() * 100
                self.current_level = min(100, level * 5)  # Skalowanie do zakresu 0-100
        
        self.current_level = 0
        self.stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=self.channels,
            callback=callback
        )
        self.stream.start()
    
    def stop_recording(self):
        if not self.recording:
            return
            
        self.recording = False
        self.record_button.text = 'NAGRYWAJ'
        self.record_button.background_color = (0.9, 0.3, 0.3, 1)
        self.status_label.text = 'Przetwarzanie...'
        
        # Zatrzymaj animację i timer
        if self.blink_animation:
            self.blink_animation.cancel(self.recording_icon)
        self.recording_icon.text = '⚪'
        self.recording_icon.opacity = 1
        
        if self.timer_event:
            self.timer_event.cancel()
            
        if self.level_update_event:
            self.level_update_event.cancel()
            self.level_bar.value = 0
        
        # Zatrzymaj strumień audio
        self.stream.stop()
        self.stream.close()
        
        # Przetwarzanie w osobnym wątku, aby nie blokować UI
        processing_thread = Thread(target=self.process_audio)
        processing_thread.daemon = True
        processing_thread.start()
    
    def process_audio(self):
        # Zbierz wszystkie próbki
        audio_data = []
        while not self.audio_queue.empty():
            audio_data.append(self.audio_queue.get())
        
        if not audio_data:
            Clock.schedule_once(lambda dt: self.update_status('Brak danych audio do zapisania'), 0)
            return
            
        try:
            audio_data = np.concatenate(audio_data, axis=0)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = os.path.join(os.getcwd(), f"nagranie_{timestamp}.wav")
            
            # Zapisz plik w formacie WAV
            sf.write(filename, audio_data, self.sample_rate)
            
            # Sprawdź czy plik istnieje
            if os.path.exists(filename):
                file_size = os.path.getsize(filename) / 1024  # Rozmiar w KB
                
                # Aktualizuj UI w głównym wątku
                Clock.schedule_once(
                    lambda dt: self.update_status(f'Zapisano: {os.path.basename(filename)} ({file_size:.1f} KB)'), 
                    0
                )
                
                # Zapisz informację o ostatnim nagraniu
                duration = time.time() - self.recording_start_time
                Clock.schedule_once(
                    lambda dt: self.update_last_recording(os.path.basename(filename), duration, file_size),
                    0
                )
                
                # Wyślij plik
                self.send_audio_file(filename)
            else:
                Clock.schedule_once(lambda dt: self.update_status('Błąd: Plik nie został zapisany!'), 0)
                
        except Exception as e:
            print(f"Błąd podczas zapisywania pliku: {str(e)}")
            Clock.schedule_once(lambda dt: self.update_status(f'Błąd: {str(e)}'), 0)
    
    def send_audio_file(self, filename):
        url = "https://n8nlink.bieda.it/webhook/c4fa58af-d8d4-4930-9003-4c10711064e2"
        
        try:
            print(f"Próba wysłania pliku: {filename}")
            if not os.path.exists(filename):
                print(f"Błąd: Plik {filename} nie istnieje!")
                Clock.schedule_once(lambda dt: self.update_status('Błąd: Plik nie istnieje!'), 0)
                return
                
            # Wysyłanie pliku
            with open(filename, 'rb') as f:
                files = {'file': (os.path.basename(filename), f, 'audio/wav')}
                
                # Aktualizuj status
                Clock.schedule_once(lambda dt: self.update_status('Wysyłanie pliku...'), 0)
                
                # Wysyłanie
                response = requests.post(url, files=files)
                
            if response.status_code == 200:
                Clock.schedule_once(lambda dt: self.update_status('Plik wysłany pomyślnie!'), 0)
                # Usuń plik tylko po pomyślnym wysłaniu
                os.remove(filename)
            else:
                error_msg = f'Błąd: {response.status_code} - {response.text}'
                print(error_msg)
                Clock.schedule_once(lambda dt: self.update_status(error_msg), 0)
                
        except Exception as e:
            error_msg = f'Błąd: {str(e)}'
            print(error_msg)
            Clock.schedule_once(lambda dt: self.update_status(error_msg), 0)
    
    def update_status(self, text):
        self.status_label.text = text
    
    def update_timer(self, dt):
        if self.recording_start_time:
            elapsed = time.time() - self.recording_start_time
            minutes = int(elapsed // 60)
            seconds = int(elapsed % 60)
            self.timer_label.text = f'{minutes:02d}:{seconds:02d}'
    
    def update_level(self, dt):
        # Płynna animacja poziomu dźwięku
        target = getattr(self, 'current_level', 0)
        current = self.level_bar.value
        # Płynna animacja (interpolacja)
        self.level_bar.value = current + (target - current) * 0.3
    
    def update_last_recording(self, filename, duration, size):
        minutes = int(duration // 60)
        seconds = int(duration % 60)
        self.last_recording_label.text = f'Ostatnie nagranie: {filename}\nCzas: {minutes:02d}:{seconds:02d}, Rozmiar: {size:.1f} KB'

if __name__ == '__main__':
    RecorderApp().run() 
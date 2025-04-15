from kivy.app import App
from kivy.uix.button import Button
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
import sounddevice as sd
import soundfile as sf
import numpy as np
import requests
import os
from datetime import datetime
from threading import Thread
import queue

class RecorderApp(App):
    def build(self):
        layout = BoxLayout(orientation='vertical', padding=10, spacing=10)
        
        self.status_label = Label(text='Gotowy do nagrywania', size_hint=(1, 0.2))
        layout.add_widget(self.status_label)
        
        self.record_button = Button(
            text='Nagrywaj',
            size_hint=(1, 0.5),
            on_press=self.toggle_recording
        )
        layout.add_widget(self.record_button)
        
        self.recording = False
        self.audio_queue = queue.Queue()
        self.sample_rate = 44100
        self.channels = 1
        
        return layout
    
    def toggle_recording(self, instance):
        if not self.recording:
            self.start_recording()
        else:
            self.stop_recording()
    
    def start_recording(self):
        self.recording = True
        self.record_button.text = 'Zatrzymaj'
        self.status_label.text = 'Nagrywanie...'
        
        def callback(indata, frames, time, status):
            if status:
                print(status)
            self.audio_queue.put(indata.copy())
        
        self.stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=self.channels,
            callback=callback
        )
        self.stream.start()
    
    def stop_recording(self):
        self.recording = False
        self.record_button.text = 'Nagrywaj'
        self.status_label.text = 'Przetwarzanie...'
        
        self.stream.stop()
        self.stream.close()
        
        # Zbierz wszystkie próbki
        audio_data = []
        while not self.audio_queue.empty():
            audio_data.append(self.audio_queue.get())
        
        if audio_data:
            try:
                audio_data = np.concatenate(audio_data, axis=0)
                # Użyj pełnej ścieżki do pliku
                filename = os.path.join(os.getcwd(), f"recording_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav")
                
                # Pokaż pełną ścieżkę pliku
                print(f"Próba zapisania pliku pod ścieżką: {filename}")
                
                # Zapisz plik w formacie WAV
                sf.write(filename, audio_data, self.sample_rate)
                
                # Sprawdź czy plik istnieje
                if os.path.exists(filename):
                    file_size = os.path.getsize(filename)
                    print(f"Plik zapisany pomyślnie. Rozmiar: {file_size} bajtów")
                    self.status_label.text = f'Zapisano plik: {os.path.basename(filename)} ({file_size} bajtów)'
                else:
                    print("Błąd: Plik nie został zapisany!")
                    self.status_label.text = 'Błąd: Plik nie został zapisany!'
                    return
                
                # Wyślij plik
                self.send_audio_file(filename)
            except Exception as e:
                print(f"Błąd podczas zapisywania pliku: {str(e)}")
                self.status_label.text = f'Błąd zapisywania pliku: {str(e)}'
    
    def send_audio_file(self, filename):
        url = "https://n8nlink.bieda.it/webhook/c4fa58af-d8d4-4930-9003-4c10711064e2"
        
        try:
            print(f"Próba wysłania pliku: {filename}")
            if not os.path.exists(filename):
                print(f"Błąd: Plik {filename} nie istnieje!")
                self.status_label.text = f'Błąd: Plik nie istnieje!'
                return
                
            # Formatujemy multipart/form-data dokładnie jak w poleceniu curl
            with open(filename, 'rb') as f:
                files = {'file': (os.path.basename(filename), f)}
                headers = {'Content-Type': 'multipart/form-data'}
                
                print("Wysyłanie pliku z następującymi parametrami:")
                print(f"URL: {url}")
                print(f"Nazwa pliku: {os.path.basename(filename)}")
                
                response = requests.post(url, files=files, headers=headers)
                print(f"Odpowiedź serwera: {response.status_code} - {response.text}")
                
            if response.status_code == 200:
                self.status_label.text = 'Plik wysłany pomyślnie!'
                print("Plik wysłany pomyślnie!")
                # Usuń plik tylko po pomyślnym wysłaniu
                os.remove(filename)
            else:
                self.status_label.text = f'Błąd: {response.status_code} - {response.text}'
                print(f"Błąd podczas wysyłania: {response.status_code} - {response.text}")
                # Nie usuwaj pliku jeśli wystąpił błąd
                
        except Exception as e:
            print(f"Błąd podczas wysyłania pliku: {str(e)}")
            self.status_label.text = f'Błąd: {str(e)}'
            # Nie usuwaj pliku jeśli wystąpił wyjątek

if __name__ == '__main__':
    RecorderApp().run() 
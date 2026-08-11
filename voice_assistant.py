import sys
import subprocess
import os
import datetime
import webbrowser
import json

# Check and guide user if required libraries are missing locally
missing_libs = []
try:
    import pyttsx3
except ImportError:
    missing_libs.append("pyttsx3")
try:
    import speech_recognition as sr
except ImportError:
    missing_libs.append("SpeechRecognition")
try:
    import httpx
except ImportError:
    missing_libs.append("httpx")

if missing_libs:
    print("\n" + "="*60)
    print("🚨 MISSING PYTHON LIBRARIES REQUIRED FOR VOICE ASSISTANT!")
    print("="*60)
    print("Docker containers do not have access to your laptop's microphone.")
    print("Please install these libraries directly on your Windows laptop terminal:")
    print(f"\n   pip install {' '.join(missing_libs)} pyaudio")
    print("="*60 + "\n")
    sys.exit(1)

# Initialize offline Text-To-Speech engine (Uses Windows built-in SAPI5)
try:
    engine = pyttsx3.init('sapi5')
    voices = engine.getProperty('voices')
    engine.setProperty('voice', voices[0].id)  # Male voice. Choose voices[1].id for Female
    engine.setProperty('rate', 180)             # Speed of speech
except Exception as tts_err:
    print(f"Failed to initialize TTS engine: {tts_err}")
    engine = None

def speak(text):
    """Speak text out loud using laptop speakers."""
    print(f"Assistant: {text}")
    if engine:
        engine.say(text)
        engine.runAndWait()

def listen_command():
    """Listen to microphone input and convert to text."""
    r = sr.Recognizer()
    with sr.Microphone() as source:
        print("\nListening for command...")
        r.pause_threshold = 1.0
        r.adjust_for_ambient_noise(source, duration=0.8)
        try:
            audio = r.listen(source, timeout=5, phrase_time_limit=8)
            print("Processing voice input...")
            query = r.recognize_google(audio, language='en-in')
            print(f"User: {query}")
            return query.lower()
        except sr.WaitTimeoutError:
            return "none"
        except sr.UnknownValueError:
            return "none"
        except Exception as e:
            print(f"Microphone error: {e}")
            return "none"

def get_weather():
    """Fetch live weather for Delhi, India using free open-meteo API."""
    try:
        # Delhi Coordinates: Lat 28.6, Lon 77.2
        url = "https://api.open-meteo.com/v1/forecast?latitude=28.6&longitude=77.2&current_weather=true"
        import httpx
        res = httpx.get(url, timeout=5.0)
        if res.status_code == 200:
            data = res.json()
            temp = data["current_weather"]["temperature"]
            wind = data["current_weather"]["windspeed"]
            return f"The current temperature in Delhi is {temp} degrees Celsius, with a wind speed of {wind} kilometers per hour."
    except Exception:
        pass
    return "I am unable to fetch live weather details at the moment."

def start_assistant():
    speak("Hello Chetan, I am your InsightAI Voice Assistant. How can I help you today?")
    
    while True:
        query = listen_command()
        
        if query == "none":
            continue
            
        # 1. Check current time
        if "time" in query:
            time_str = datetime.datetime.now().strftime("%I:%M %p")
            speak(f"The current time is {time_str}")
            
        # 2. Check current date
        elif "date" in query or "today" in query:
            date_str = datetime.datetime.now().strftime("%A, %B %d, %Y")
            speak(f"Today is {date_str}")
            
        # 3. Check weather
        elif "weather" in query or "temperature" in query:
            speak("Checking weather reports...")
            weather_report = get_weather()
            speak(weather_report)
            
        # 4. Open YouTube or play music
        elif "open youtube" in query or "play music" in query or "play song" in query:
            speak("Opening YouTube in your browser.")
            webbrowser.open("https://www.youtube.com")
            
        # 5. Open Google
        elif "open google" in query:
            speak("Opening Google.")
            webbrowser.open("https://www.google.com")
            
        # 6. Launch local tools (Notepad, Calculator)
        elif "notepad" in query:
            speak("Opening Notepad.")
            subprocess.Popen("notepad.exe")
            
        elif "calculator" in query:
            speak("Opening Calculator.")
            subprocess.Popen("calc.exe")
            
        # 7. Quit assistant
        elif "exit" in query or "quit" in query or "stop" in query or "bye" in query:
            speak("Goodbye Chetan. Have a wonderful day!")
            break
            
        else:
            speak("I heard you, but I do not have a built-in handler for that command yet.")

if __name__ == "__main__":
    # Check if microphone is accessible
    try:
        import pyaudio
    except ImportError:
        print("\n🚨 WARNING: pyaudio is not installed.")
        print("Please install it locally on your laptop: pip install pyaudio\n")
    
    start_assistant()

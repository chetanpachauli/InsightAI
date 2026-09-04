"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Clock, 
  Cloud, 
  Calendar,
  Sparkles,
  MessageSquare,
  Home,
  Upload,
  Sliders
} from "lucide-react";

export default function VoiceAssistantPage() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [logs, setLogs] = useState<Array<{user: string, assistant: string, time: string}>>([]);
  const [browserSupport, setBrowserSupport] = useState(true);
  const [language, setLanguage] = useState<'hindi' | 'english'>('hindi');
  const router = useRouter();
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        setBrowserSupport(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = language === 'hindi' ? 'hi-IN' : 'en-US';
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const command = event.results[0][0].transcript.toLowerCase();
        setTranscript(command);
        processCommand(command);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      synthRef.current = window.speechSynthesis;
    }
  }, [language]);

  const speak = (text: string) => {
    if (synthRef.current) {
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'hindi' ? 'hi-IN' : 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 1;
      synthRef.current.speak(utterance);
      setResponse(text);
    }
  };

  const startListening = () => {
    if (recognitionRef.current) {
      setTranscript("");
      setResponse("");
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const processCommand = (command: string) => {
    let responseText = "";

    // Time command
    if (command.includes("time") || command.includes("समय") || command.includes("samay")) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      responseText = language === 'hindi' 
        ? `अभी समय है ${timeStr}`
        : `Current time is ${timeStr}`;
    }
    // Date command
    else if (command.includes("date") || command.includes("तारीख") || command.includes("tarikh") || command.includes("today") || command.includes("आज")) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-IN', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });
      responseText = language === 'hindi'
        ? `आज की तारीख है ${dateStr}`
        : `Today's date is ${dateStr}`;
    }
    // Weather command
    else if (command.includes("weather") || command.includes("मौसम") || command.includes("mausam")) {
      responseText = language === 'hindi' 
        ? "मौसम चेक कर रहा हूं..."
        : "Checking weather...";
      speak(responseText);
      fetchWeather();
      return;
    }
    // Dashboard navigation
    else if (command.includes("dashboard") || command.includes("डैशबोर्ड")) {
      responseText = language === 'hindi'
        ? "डैशबोर्ड खोल रहा हूं"
        : "Opening dashboard";
      speak(responseText);
      setTimeout(() => router.push('/dashboard'), 1000);
    }
    // Rules navigation
    else if (command.includes("rules") || command.includes("rule") || command.includes("नियम")) {
      responseText = language === 'hindi'
        ? "Rules पेज खोल रहा हूं"
        : "Opening rules page";
      speak(responseText);
      setTimeout(() => router.push('/rules'), 1000);
    }
    // Upload navigation
    else if (command.includes("upload") || command.includes("अपलोड")) {
      responseText = language === 'hindi'
        ? "अपलोड पेज खोल रहा हूं"
        : "Opening upload page";
      speak(responseText);
      setTimeout(() => router.push('/uploads'), 1000);
    }
    // Chat navigation
    else if (command.includes("chat") || command.includes("चैट")) {
      responseText = language === 'hindi'
        ? "AI चैट खोल रहा हूं"
        : "Opening AI chat";
      speak(responseText);
      setTimeout(() => router.push('/chat'), 1000);
    }
    // Finance navigation
    else if (command.includes("finance") || command.includes("bank") || command.includes("वित्त") || command.includes("बैंक")) {
      responseText = language === 'hindi'
        ? "फाइनेंस पेज खोल रहा हूं"
        : "Opening finance page";
      speak(responseText);
      setTimeout(() => router.push('/finance'), 1000);
    }
    // YouTube
    else if (command.includes("youtube") || command.includes("यूट्यूब")) {
      responseText = language === 'hindi'
        ? "YouTube खोल रहा हूं"
        : "Opening YouTube";
      speak(responseText);
      setTimeout(() => window.open('https://www.youtube.com', '_blank'), 500);
    }
    // Google
    else if (command.includes("google") || command.includes("गूगल") || command.includes("search")) {
      responseText = language === 'hindi'
        ? "Google खोल रहा हूं"
        : "Opening Google";
      speak(responseText);
      setTimeout(() => window.open('https://www.google.com', '_blank'), 500);
    }
    // Gmail
    else if (command.includes("gmail") || command.includes("mail") || command.includes("email")) {
      responseText = language === 'hindi'
        ? "Gmail खोल रहा हूं"
        : "Opening Gmail";
      speak(responseText);
      setTimeout(() => window.open('https://mail.google.com', '_blank'), 500);
    }
    // WhatsApp
    else if (command.includes("whatsapp") || command.includes("व्हाट्सएप")) {
      responseText = language === 'hindi'
        ? "WhatsApp खोल रहा हूं"
        : "Opening WhatsApp";
      speak(responseText);
      setTimeout(() => window.open('https://web.whatsapp.com', '_blank'), 500);
    }
    // LinkedIn
    else if (command.includes("linkedin")) {
      responseText = language === 'hindi'
        ? "LinkedIn खोल रहा हूं"
        : "Opening LinkedIn";
      speak(responseText);
      setTimeout(() => window.open('https://www.linkedin.com', '_blank'), 500);
    }
    // Twitter / X
    else if (command.includes("twitter") || command.includes("x.com")) {
      responseText = language === 'hindi'
        ? "Twitter खोल रहा हूं"
        : "Opening Twitter";
      speak(responseText);
      setTimeout(() => window.open('https://twitter.com', '_blank'), 500);
    }
    // Instagram
    else if (command.includes("instagram") || command.includes("insta")) {
      responseText = language === 'hindi'
        ? "Instagram खोल रहा हूं"
        : "Opening Instagram";
      speak(responseText);
      setTimeout(() => window.open('https://www.instagram.com', '_blank'), 500);
    }
    // Facebook
    else if (command.includes("facebook")) {
      responseText = language === 'hindi'
        ? "Facebook खोल रहा हूं"
        : "Opening Facebook";
      speak(responseText);
      setTimeout(() => window.open('https://www.facebook.com', '_blank'), 500);
    }
    // GitHub
    else if (command.includes("github")) {
      responseText = language === 'hindi'
        ? "GitHub खोल रहा हूं"
        : "Opening GitHub";
      speak(responseText);
      setTimeout(() => window.open('https://www.github.com', '_blank'), 500);
    }
    // ChatGPT
    else if (command.includes("chatgpt") || command.includes("gpt")) {
      responseText = language === 'hindi'
        ? "ChatGPT खोल रहा हूं"
        : "Opening ChatGPT";
      speak(responseText);
      setTimeout(() => window.open('https://chat.openai.com', '_blank'), 500);
    }
    // Amazon
    else if (command.includes("amazon") || command.includes("shopping")) {
      responseText = language === 'hindi'
        ? "Amazon खोल रहा हूं"
        : "Opening Amazon";
      speak(responseText);
      setTimeout(() => window.open('https://www.amazon.in', '_blank'), 500);
    }
    // Flipkart
    else if (command.includes("flipkart")) {
      responseText = language === 'hindi'
        ? "Flipkart खोल रहा हूं"
        : "Opening Flipkart";
      speak(responseText);
      setTimeout(() => window.open('https://www.flipkart.com', '_blank'), 500);
    }
    // Netflix
    else if (command.includes("netflix")) {
      responseText = language === 'hindi'
        ? "Netflix खोल रहा हूं"
        : "Opening Netflix";
      speak(responseText);
      setTimeout(() => window.open('https://www.netflix.com', '_blank'), 500);
    }
    // Spotify
    else if (command.includes("spotify") || command.includes("music") || command.includes("song")) {
      responseText = language === 'hindi'
        ? "Spotify खोल रहा हूं"
        : "Opening Spotify";
      speak(responseText);
      setTimeout(() => window.open('https://open.spotify.com', '_blank'), 500);
    }
    // Maps
    else if (command.includes("maps") || command.includes("map") || command.includes("नक्शा")) {
      responseText = language === 'hindi'
        ? "Google Maps खोल रहा हूं"
        : "Opening Google Maps";
      speak(responseText);
      setTimeout(() => window.open('https://www.google.com/maps', '_blank'), 500);
    }
    // News
    else if (command.includes("news") || command.includes("समाचार")) {
      responseText = language === 'hindi'
        ? "Google News खोल रहा हूं"
        : "Opening Google News";
      speak(responseText);
      setTimeout(() => window.open('https://news.google.com', '_blank'), 500);
    }
    // Wikipedia
    else if (command.includes("wikipedia") || command.includes("wiki")) {
      responseText = language === 'hindi'
        ? "Wikipedia खोल रहा हूं"
        : "Opening Wikipedia";
      speak(responseText);
      setTimeout(() => window.open('https://www.wikipedia.org', '_blank'), 500);
    }
    // Calculator (browser based)
    else if (command.includes("calculator") || command.includes("calc") || command.includes("कैलकुलेटर")) {
      responseText = language === 'hindi'
        ? "Calculator खोल रहा हूं"
        : "Opening Calculator";
      speak(responseText);
      setTimeout(() => window.open('https://www.google.com/search?q=calculator', '_blank'), 500);
    }
    // Greeting
    else if (command.includes("hello") || command.includes("hi") || command.includes("namaste") || command.includes("नमस्ते")) {
      responseText = language === 'hindi'
        ? "नमस्ते! मैं InsightAI Voice Assistant हूं। कैसे मदद कर सकता हूं?"
        : "Hello! I am InsightAI Voice Assistant. How can I help you?";
    }
    // Help
    else if (command.includes("help") || command.includes("मदद")) {
      responseText = language === 'hindi'
        ? "मैं समय बता सकता हूं, मौसम चेक कर सकता हूं, और पेज खोल सकता हूं।"
        : "I can tell time, check weather, and open pages for you.";
    }
    // Thank you
    else if (command.includes("thank") || command.includes("धन्यवाद") || command.includes("shukriya")) {
      responseText = language === 'hindi'
        ? "आपका स्वागत है!"
        : "You're welcome!";
    }
    // Business MIS & Data Query
    else if (/(sales|revenue|profit|loss|product|customer|region|expense|bikri|kamai|kharcha|data|report|budget|highest|top|trend|summary|बिक्री|कमाई|खर्च)/i.test(command)) {
      responseText = language === 'hindi'
        ? "डेटाबेस चेक करके इनसाइट्स ला रहा हूं..."
        : "Analyzing business data...";
      speak(responseText);
      handleDataQuery(command);
      return;
    }
    // Unknown command
    else {
      // Check if it's a request to open something
      if (command.includes("open") || command.includes("kholo") || command.includes("खोलो") || command.includes("launch") || command.includes("start")) {
        responseText = language === 'hindi'
          ? `क्षमा करें, "${command}" अभी मेरी क्षमता में नहीं है। मैं सिर्फ approved websites और pages ही खोल सकता हूं। "Help" बोलें सभी commands के लिए।`
          : `Sorry, I don't have permission to open "${command}". I can only access approved websites and pages. Say "help" for available commands.`;
      }
      // Check if asking for system/computer control
      else if (command.includes("shutdown") || command.includes("restart") || command.includes("sleep") || command.includes("lock") || command.includes("volume") || command.includes("brightness")) {
        responseText = language === 'hindi'
          ? `माफी चाहता हूं, मुझे system controls की अनुमति नहीं है। सुरक्षा कारणों से मैं सिर्फ browser-based कार्य कर सकता हूं।`
          : `Sorry, I don't have permission for system controls. For security reasons, I can only perform browser-based tasks.`;
      }
      // Check if asking for file operations
      else if (command.includes("delete") || command.includes("remove") || command.includes("install") || command.includes("download") || command.includes("file")) {
        responseText = language === 'hindi'
          ? `क्षमा करें, मुझे file operations की अनुमति नहीं है। मैं सिर्फ information देना और websites खोलना कर सकता हूं।`
          : `Sorry, I don't have permission for file operations. I can only provide information and open websites.`;
      }
      // General unknown command
      else {
        responseText = language === 'hindi'
          ? `मैंने सुना: "${command}". लेकिन यह command मेरी सूची में नहीं है। "मदद" बोलें सभी available commands के लिए।`
          : `I heard: "${command}". But this command is not in my list. Say "help" for all available commands.`;
      }
    }

    speak(responseText);
    
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setLogs(prev => [{user: command, assistant: responseText, time: now}, ...prev.slice(0, 9)]);
  };

  const handleDataQuery = async (queryText: string) => {
    try {
      const res = await api.post("/query/chat", { question: queryText });
      const insight = res.data.explanation || "डेटा प्रोसेस हो गया है।";
      speak(insight);
      const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      setLogs(prev => [{ user: queryText, assistant: insight, time: now }, ...prev.slice(0, 9)]);
    } catch {
      const errText = language === 'hindi'
        ? "माफी चाहता हूं, डेटाबेस से जानकारी लाने में समस्या आई। कृपया सुनिश्चित करें कि डेटा अप्रूव्ड है।"
        : "Could not retrieve insights from the database. Please ensure files are approved.";
      speak(errText);
    }
  };

  const fetchWeather = async () => {
    try {
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=28.6&longitude=77.2&current_weather=true');
      const data = await response.json();
      const temp = data.current_weather.temperature;
      const weatherText = language === 'hindi'
        ? `दिल्ली में अभी तापमान ${temp} डिग्री सेल्सियस है।`
        : `Current temperature in Delhi is ${temp} degrees Celsius.`;
      speak(weatherText);
      
      const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      setLogs(prev => [{user: "weather", assistant: weatherText, time: now}, ...prev.slice(0, 9)]);
    } catch {
      const errorText = language === 'hindi'
        ? "मौसम लाने में समस्या आ गई।"
        : "Failed to fetch weather data.";
      speak(errorText);
    }
  };

  if (!browserSupport) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="text-center max-w-md">
          <MicOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-200 mb-2">Browser Support Nahi Hai</h2>
          <p className="text-slate-400 text-sm">
            Chrome, Edge, ya Safari use karo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                🎙️ Voice Assistant
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {language === 'hindi' 
                  ? 'बोलो commands और मैं काम करूंगा!'
                  : 'Speak commands and I will help you!'}
              </p>
            </div>
            
            {/* Language Selector */}
            <div className="flex items-center space-x-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-2">
              <button
                onClick={() => setLanguage('hindi')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  language === 'hindi'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇮🇳 हिंदी
              </button>
              <button
                onClick={() => setLanguage('english')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  language === 'english'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇬🇧 English
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl">
              
              <div className="flex flex-col items-center justify-center mb-8">
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isListening 
                      ? "bg-red-600 hover:bg-red-500 animate-pulse shadow-lg shadow-red-600/50" 
                      : "bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg"
                  }`}
                >
                  {isListening ? (
                    <Mic className="w-16 h-16 text-white" />
                  ) : (
                    <MicOff className="w-16 h-16 text-white" />
                  )}
                </button>
                
                <p className="text-slate-400 text-sm mt-4 font-medium">
                  {isListening 
                    ? (language === 'hindi' ? "🎤 सुन रहा हूं..." : "🎤 Listening...")
                    : (language === 'hindi' ? "🎤 क्लिक करके बोलो" : "🎤 Click to speak")}
                </p>
              </div>

              {transcript && (
                <div className="mb-6 p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                  <div className="flex items-start space-x-3">
                    <MessageSquare className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-500 font-semibold uppercase mb-1">
                        {language === 'hindi' ? 'आपने बोला:' : 'You said:'}
                      </p>
                      <p className="text-slate-200 font-medium">{transcript}</p>
                    </div>
                  </div>
                </div>
              )}

              {response && (
                <div className="mb-6 p-4 bg-gradient-to-br from-indigo-950/40 to-purple-950/40 border border-indigo-800/50 rounded-2xl">
                  <div className="flex items-start space-x-3">
                    <Volume2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-purple-400 font-semibold uppercase mb-1">Assistant:</p>
                      <p className="text-slate-200 font-medium">{response}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  onClick={() => processCommand(language === 'hindi' ? "समय बताओ" : "tell me time")}
                  className="p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition flex items-center space-x-2"
                >
                  <Clock className="w-4 h-4" />
                  <span>{language === 'hindi' ? 'समय बताओ' : 'Tell Time'}</span>
                </button>
                
                <button
                  onClick={() => processCommand(language === 'hindi' ? "मौसम बताओ" : "tell me weather")}
                  className="p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition flex items-center space-x-2"
                >
                  <Cloud className="w-4 h-4" />
                  <span>{language === 'hindi' ? 'मौसम बताओ' : 'Weather'}</span>
                </button>
                
                <button
                  onClick={() => processCommand(language === 'hindi' ? "आज की तारीख" : "tell me date")}
                  className="p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition flex items-center space-x-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>{language === 'hindi' ? 'तारीख बताओ' : 'Tell Date'}</span>
                </button>
                
                <button
                  onClick={() => processCommand(language === 'hindi' ? "डैशबोर्ड खोलो" : "open dashboard")}
                  className="p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition flex items-center space-x-2"
                >
                  <Home className="w-4 h-4" />
                  <span>{language === 'hindi' ? 'डैशबोर्ड' : 'Dashboard'}</span>
                </button>
                
                <button
                  onClick={() => processCommand(language === 'hindi' ? "अपलोड खोलो" : "open upload")}
                  className="p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition flex items-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>{language === 'hindi' ? 'अपलोड' : 'Upload'}</span>
                </button>
                
                <button
                  onClick={() => processCommand(language === 'hindi' ? "rules खोलो" : "open rules")}
                  className="p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition flex items-center space-x-2"
                >
                  <Sliders className="w-4 h-4" />
                  <span>Rules</span>
                </button>
              </div>

              {/* External Sites Grid */}
              <div className="mt-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">
                  {language === 'hindi' ? '🌐 External Websites' : '🌐 External Websites'}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => processCommand("youtube")}
                    className="p-2 bg-red-950/30 hover:bg-red-900/40 border border-red-900/50 rounded-lg text-xs text-red-400 hover:text-red-300 transition"
                  >
                    YouTube
                  </button>
                  <button
                    onClick={() => processCommand("google")}
                    className="p-2 bg-blue-950/30 hover:bg-blue-900/40 border border-blue-900/50 rounded-lg text-xs text-blue-400 hover:text-blue-300 transition"
                  >
                    Google
                  </button>
                  <button
                    onClick={() => processCommand("gmail")}
                    className="p-2 bg-red-950/30 hover:bg-red-900/40 border border-red-900/50 rounded-lg text-xs text-red-400 hover:text-red-300 transition"
                  >
                    Gmail
                  </button>
                  <button
                    onClick={() => processCommand("whatsapp")}
                    className="p-2 bg-green-950/30 hover:bg-green-900/40 border border-green-900/50 rounded-lg text-xs text-green-400 hover:text-green-300 transition"
                  >
                    WhatsApp
                  </button>
                  <button
                    onClick={() => processCommand("instagram")}
                    className="p-2 bg-pink-950/30 hover:bg-pink-900/40 border border-pink-900/50 rounded-lg text-xs text-pink-400 hover:text-pink-300 transition"
                  >
                    Instagram
                  </button>
                  <button
                    onClick={() => processCommand("facebook")}
                    className="p-2 bg-blue-950/30 hover:bg-blue-900/40 border border-blue-900/50 rounded-lg text-xs text-blue-400 hover:text-blue-300 transition"
                  >
                    Facebook
                  </button>
                  <button
                    onClick={() => processCommand("twitter")}
                    className="p-2 bg-sky-950/30 hover:bg-sky-900/40 border border-sky-900/50 rounded-lg text-xs text-sky-400 hover:text-sky-300 transition"
                  >
                    Twitter
                  </button>
                  <button
                    onClick={() => processCommand("linkedin")}
                    className="p-2 bg-blue-950/30 hover:bg-blue-900/40 border border-blue-900/50 rounded-lg text-xs text-blue-400 hover:text-blue-300 transition"
                  >
                    LinkedIn
                  </button>
                  <button
                    onClick={() => processCommand("github")}
                    className="p-2 bg-slate-950/50 hover:bg-slate-900/60 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-slate-300 transition"
                  >
                    GitHub
                  </button>
                  <button
                    onClick={() => processCommand("chatgpt")}
                    className="p-2 bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-900/50 rounded-lg text-xs text-emerald-400 hover:text-emerald-300 transition"
                  >
                    ChatGPT
                  </button>
                  <button
                    onClick={() => processCommand("amazon")}
                    className="p-2 bg-orange-950/30 hover:bg-orange-900/40 border border-orange-900/50 rounded-lg text-xs text-orange-400 hover:text-orange-300 transition"
                  >
                    Amazon
                  </button>
                  <button
                    onClick={() => processCommand("netflix")}
                    className="p-2 bg-red-950/30 hover:bg-red-900/40 border border-red-900/50 rounded-lg text-xs text-red-400 hover:text-red-300 transition"
                  >
                    Netflix
                  </button>
                  <button
                    onClick={() => processCommand("spotify")}
                    className="p-2 bg-green-950/30 hover:bg-green-900/40 border border-green-900/50 rounded-lg text-xs text-green-400 hover:text-green-300 transition"
                  >
                    Spotify
                  </button>
                  <button
                    onClick={() => processCommand("maps")}
                    className="p-2 bg-green-950/30 hover:bg-green-900/40 border border-green-900/50 rounded-lg text-xs text-green-400 hover:text-green-300 transition"
                  >
                    Maps
                  </button>
                  <button
                    onClick={() => processCommand("wikipedia")}
                    className="p-2 bg-slate-950/50 hover:bg-slate-900/60 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-slate-300 transition"
                  >
                    Wikipedia
                  </button>
                </div>
              </div>

              {/* Text Input for Manual Commands */}
              <div className="mt-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">
                  {language === 'hindi' ? '⌨️ या यहां लिखें' : '⌨️ Or Type Here'}
                </h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.target as HTMLFormElement).command.value;
                  if (input.trim()) {
                    processCommand(input.toLowerCase());
                    (e.target as HTMLFormElement).reset();
                  }
                }} className="flex space-x-2">
                  <input
                    type="text"
                    name="command"
                    placeholder={language === 'hindi' ? 'Command यहां लिखें... (e.g., YouTube kholo)' : 'Type command here... (e.g., Open YouTube)'}
                    className="flex-1 px-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl outline-none text-slate-100 text-sm focus:border-indigo-500 transition placeholder:text-slate-600"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl transition shadow-md"
                  >
                    {language === 'hindi' ? 'भेजें' : 'Send'}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
              <h2 className="text-base font-bold text-slate-200 mb-4 flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span>Command History</span>
              </h2>

              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  {language === 'hindi' 
                    ? 'अभी तक कोई command नहीं बोला'
                    : 'No commands yet'}
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {logs.map((log, idx) => (
                    <div key={idx} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl text-xs">
                      <p className="text-slate-500 mb-1">{log.time}</p>
                      <p className="text-indigo-400 font-semibold mb-1">You: {log.user}</p>
                      <p className="text-slate-300">Bot: {log.assistant}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-indigo-950/40 to-purple-950/40 border border-indigo-800/50 rounded-3xl p-6 mt-6">
              <h3 className="text-sm font-bold text-indigo-400 mb-3">
                💡 {language === 'hindi' ? 'Commands की सूची' : 'Commands List'}
              </h3>
              <ul className="text-xs text-slate-400 space-y-2">
                {language === 'hindi' ? (
                  <>
                    <li>• "समय बताओ" - वर्तमान समय</li>
                    <li>• "तारीख बताओ" - आज की तारीख</li>
                    <li>• "मौसम बताओ" - दिल्ली का मौसम</li>
                    <li>• "डैशबोर्ड खोलो" - Dashboard खुले</li>
                    <li>• "Rules खोलो" - Rules पेज</li>
                    <li>• "अपलोड खोलो" - Upload पेज</li>
                    <li>• "चैट खोलो" - AI चैट</li>
                    <li>• "फाइनेंस खोलो" - Finance पेज</li>
                    <li>• "मदद" - Commands सूची</li>
                  </>
                ) : (
                  <>
                    <li>• "Tell me time" - Current time</li>
                    <li>• "Tell me date" - Today's date</li>
                    <li>• "Tell me weather" - Delhi weather</li>
                    <li>• "Open dashboard" - Dashboard page</li>
                    <li>• "Open rules" - Rules page</li>
                    <li>• "Open upload" - Upload page</li>
                    <li>• "Open chat" - AI Chat</li>
                    <li>• "Open finance" - Finance page</li>
                    <li>• "Help" - Commands list</li>
                  </>
                )}
              </ul>
            </div>
          </div>

        </div>
    </>
  );
}

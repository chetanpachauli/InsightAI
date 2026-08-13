from google import genai
import os
from dotenv import load_dotenv

# Load env variables
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
print(f"API Key to test: {api_key[:10]}...{api_key[-10:]}")

try:
    print("Initializing Google GenAI client...")
    client = genai.Client(api_key=api_key)
    
    print("Sending test request using 'gemini-3.5-flash'...")
    response = client.models.generate_content(
        model='gemini-3.5-flash',
        contents='Hello! Please reply with exactly one word: Success.',
    )
    print("\n✅ API KEY IS FUNCTIONAL!")
    print(f"Gemini Response: {response.text}")
except Exception as e:
    print("\n❌ API KEY FAILED WITH ERROR:")
    print(str(e))
    print("\nLet's try listing available models for this key:")
    try:
        # Try to list models
        models = client.models.list()
        print("Available models:")
        for m in models:
            print(f" - {m.name}")
    except Exception as list_err:
        print(f"Failed to list models: {list_err}")

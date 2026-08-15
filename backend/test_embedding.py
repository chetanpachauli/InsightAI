import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("Error: GEMINI_API_KEY not found in .env")
    exit(1)

client = genai.Client(api_key=api_key)

models_to_test = [
    "text-embedding-004",
    "models/text-embedding-004",
    "models/gemini-embedding-001",
    "gemini-embedding-001",
]

for model in models_to_test:
    print(f"\nTesting embedding model: '{model}'...")
    try:
        response = client.models.embed_content(
            model=model,
            contents="Hello World"
        )
        print(f"✅ Success! Vector length: {len(response.embeddings[0].values)}")
    except Exception as e:
        print(f"❌ Failed: {e}")



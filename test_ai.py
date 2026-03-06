import sys
import os

# Add current directory to path so we can import backend
sys.path.append(os.getcwd())

try:
    from backend.ai_engine import AIEngine
    from dotenv import load_dotenv
    import logging

    logging.basicConfig(level=logging.INFO)
    load_dotenv()

    print("--- AI ENGINE DIAGNOSTIC ---")
    key = os.getenv("GOOGLE_API_KEY")
    if not key:
        print("ERROR: GOOGLE_API_KEY not found in .env or environment.")
    else:
        print(f"API Key found: {key[:4]}...{key[-4:]}")
        
    engine = AIEngine()
    if engine.model is None:
        print("ERROR: AI Engine failed to initialize model. Check logs.")
    else:
        print("AI Engine model initialized successfully.")
        
    print("Attempting test generation...")
    test_res = engine.generate_smart_summary(
        "Diagnostic Test", 
        "This is a test description to verify API connectivity.",
        ["Comment 1: API test in progress.", "Comment 2: Connectivity verified."]
    )
    
    if test_res:
        print(f"SUCCESS! AI Response: {test_res}")
    else:
        print("FAILURE: AI Response was None. Check backend/ai_engine.py logs.")

except Exception as e:
    print(f"CRITICAL ERROR during diagnostic: {e}")

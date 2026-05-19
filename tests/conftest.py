# tests/conftest.py
# Pytest configuration that ensures the .env is loaded before any test imports
import os
import sys

# Add project root to path so `from main import app` works
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load .env before any app code runs
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

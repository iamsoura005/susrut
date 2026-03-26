# Use the official Python 3.11 image
FROM python:3.11-slim

# Set working directory to the backend package root
# This is the CRITICAL fix: uvicorn resolves 'app.main:app' relative to WORKDIR
WORKDIR /app/backend

# Copy requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt
# Ensure new Gemini SDK is installed (in case requirements.txt cache is stale)
RUN pip install --no-cache-dir google-genai

# Create necessary directories and set permissions
# Hugging Face runs as user 1000, so we give permissions to /app
RUN mkdir -p /app/backend/data /app/backend/outputs
RUN chmod -R 777 /app

# Copy the entire project into /app so model .h5 files at project root are reachable
COPY . /app/

# Expose port 7860 (Hugging Face Spaces default port)
ENV PORT=7860
# Gemini API Key — set this in HuggingFace Space Secrets UI (never hardcode)
ENV GEMINI_API_KEY=""
EXPOSE 7860

# Run the FastAPI app
# WORKDIR is /app/backend so Python resolves 'app' as /app/backend/app/
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]

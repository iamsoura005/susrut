# Use the official Python 3.11 image
FROM python:3.11-slim

# Set the working directory
WORKDIR /app



# Copy requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Create necessary directories and set permissions 
# Hugging Face runs as user 1000, so we give permissions to /app
RUN mkdir -p /app/backend/data /app/backend/outputs
RUN chmod -R 777 /app

# Copy the entire project
COPY . /app/

# Expose port 7860 (Hugging Face Spaces default port)
ENV PORT=7860
EXPOSE 7860

# Run the FastAPI app
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "7860"]

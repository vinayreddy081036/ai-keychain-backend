FROM python:3.11-slim

# Install system dependencies
# openscad: for generating STL
# potrace: for converting bitmap to SVG
# libgl1-mesa-glx & libglib2.0-0: for OpenCV
RUN apt-get update && apt-get install -y \
    openscad \
    potrace \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create temp directory for processing
RUN mkdir -p /tmp/processing

# Expose port
EXPOSE 5000

# Run the application
CMD ["python", "app.py"]

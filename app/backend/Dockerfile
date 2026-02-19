# AUS Energy Copilot — Backend API image
#
# IMPORTANT: This Dockerfile must be built from the repository root so that
# the agent/ and models/ directories (which live outside app/backend/) can be
# copied into the image.  The docker-compose.yml already sets context: ./
# (repo root) with dockerfile: app/backend/Dockerfile.
#
# Manual build example (from repo root):
#   docker build -f app/backend/Dockerfile -t energy-copilot-backend .
#
# If you need to build from app/backend/ alone, copy agent/ and models/ into
# app/backend/agent/ and app/backend/models/ first, then adjust the COPY lines.

FROM python:3.11-slim

WORKDIR /app

# Install system-level dependencies required by some Python packages
# (e.g. psycopg2-binary needs libpq, curl is used by the health-check probe)
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (Docker layer-cache friendly)
COPY app/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the FastAPI application source
COPY app/backend/ .

# Copy the shared agent and models packages used by the backend at runtime
COPY agent/ /app/agent/
COPY models/ /app/models/

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

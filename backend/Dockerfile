FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY scripts/ ./scripts/

# Prepare these files locally with scripts/fetch_data.py before building.
COPY data/kernels/ ./data/kernels/
COPY data/dem/ldem_85s_20m_crop.tif data/dem/ldem_64.tif ./data/dem/

# Existing kernels are skipped; rewrite meta.tm with the container's /app path.
RUN python scripts/fetch_data.py kernels

EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

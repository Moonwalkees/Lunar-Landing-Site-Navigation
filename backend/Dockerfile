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

# data/ is gitignored, so the build fetches it. Set the DATA_URL build arg to a public bucket
# holding ldem_85s_20m_crop.tif and ldem_64.tif (fast). Without it, the raw LOLA maps (~2.4 GB)
# are downloaded from NASA and cropped, which can take hours on a slow link.
# Only the scripts and the preset list are copied first, so app code changes reuse this layer.
ARG DATA_URL
COPY scripts/ ./scripts/
COPY app/sites.py ./app/sites.py
RUN python scripts/fetch_data.py kernels \
    && python scripts/fetch_data.py dems

COPY app/ ./app/

EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

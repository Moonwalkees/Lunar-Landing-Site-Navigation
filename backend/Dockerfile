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

# data/ is gitignored, so the build downloads it. Only the fetch script and the preset list
# (used to crop the polar map) are copied first, so app code changes reuse this cached layer.
# The raw LOLA downloads (~2.4 GB) are deleted in the same step, so they never reach the image.
COPY scripts/ ./scripts/
COPY app/sites.py ./app/sites.py
RUN python scripts/fetch_data.py kernels \
    && python scripts/fetch_data.py dems

COPY app/ ./app/

EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

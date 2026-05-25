# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_APP=run:app \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements-prod.txt .
RUN python -m pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements-prod.txt

COPY app ./app
COPY run.py .
COPY migrations ./migrations

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Non-root runtime user (fixed UID for volume ownership patterns).
RUN groupadd --system --gid 1000 appgroup \
    && useradd --system --uid 1000 --gid appgroup --home-dir /app --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/api/v1/health', timeout=4).read()"

ENTRYPOINT ["/docker-entrypoint.sh"]

FROM python:3.12-slim
WORKDIR /app/backend
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY shared/ /app/shared/
COPY frontend/dist/ /app/frontend/dist/
ENV MEDIA_ROOT=/app/media
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

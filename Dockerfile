FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt

RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY frontend ./frontend

COPY database ./database
COPY bills ./bills
COPY reports ./reports
COPY backups ./backups
COPY uploads ./uploads
COPY logs ./logs

WORKDIR /app/backend

ENV PYTHONUNBUFFERED=1
ENV PORT=5000

EXPOSE 5000

CMD ["python", "app.py"]

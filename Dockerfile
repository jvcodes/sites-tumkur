# Use an official Python runtime as a parent image
FROM python:3.13-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PORT 8000

# Set work directory
WORKDIR /app

# Install dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy project
COPY . /app/

# Collect static files for WhiteNoise
RUN python manage.py collectstatic --noinput

# Expose the port Cloud Run expects
EXPOSE $PORT

# Command to run the application (run migrations first, then start server)
CMD python manage.py migrate && gunicorn --bind 0.0.0.0:$PORT sitehub.wsgi:application

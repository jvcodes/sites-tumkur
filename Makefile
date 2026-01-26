# Makefile for SiteHub

PYTHON = python
PIP = pip

.PHONY: help install test run lint clean

help:
	@echo "Available commands:"
	@echo "  make install   - Install dependencies"
	@echo "  make test      - Run verification tests"
	@echo "  make run       - Run development server"
	@echo "  make clean     - Remove cache files"

install:
	$(PIP) install -r requirements.txt

test:
	@echo "Running Pre-push Verification..."
	$(PYTHON) tests/test_db_connection.py

run:
	$(PYTHON) manage.py runserver

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +

# ============================================================
# AUS Energy Copilot — Makefile
# Usage: make <target>
# ============================================================

.DEFAULT_GOAL := help
.PHONY: help install install-dev lint format test test-unit test-integration \
        backend frontend build-frontend deploy-bundle \
        run-registry run-rag-index register-models

# ---------------------------------------------------------------------------
# Help — auto-generated from ## comments
# ---------------------------------------------------------------------------

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

install:  ## Install backend dependencies
	pip install -r app/backend/requirements.txt

install-dev:  ## Install dev dependencies
	pip install -r requirements-dev.txt

# ---------------------------------------------------------------------------
# Code quality
# ---------------------------------------------------------------------------

lint:  ## Run ruff + mypy
	ruff check . && mypy app/backend/ agent/ models/ --ignore-missing-imports

format:  ## Run black
	black app/backend/ agent/ models/ tests/ setup/

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

test:  ## Run all unit tests
	pytest tests/ -v --tb=short

test-unit:  ## Run only unit tests (no integration)
	pytest tests/ -v --tb=short -k "not integration"

test-integration:  ## Run integration tests (requires live Databricks)
	ENERGY_COPILOT_INTEGRATION_TEST=1 pytest tests/ -v --tb=short -k "integration"

# ---------------------------------------------------------------------------
# Local dev servers
# ---------------------------------------------------------------------------

backend:  ## Start FastAPI backend locally
	cd app/backend && uvicorn main:app --reload --port 8000

frontend:  ## Start React frontend locally
	cd app/frontend && npm run dev

build-frontend:  ## Build React for production
	cd app/frontend && npm run build

# ---------------------------------------------------------------------------
# Databricks deployment
# ---------------------------------------------------------------------------

deploy-bundle:  ## Deploy Databricks Asset Bundle
	databricks bundle deploy --target dev

# ---------------------------------------------------------------------------
# Data + model setup
# ---------------------------------------------------------------------------

run-registry:  ## Load generator registry from AEMO
	python setup/load_generator_registry.py

run-rag-index:  ## Index AEMO documents into Vector Search
	python agent/rag/index_documents.py

register-models:  ## Register all trained models to MLflow UC
	python models/register_all_models.py --set-alias production

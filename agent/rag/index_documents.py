"""
agent/rag/index_documents.py
==============================
Script to chunk, embed, and index AEMO market rules documents into a
Databricks Vector Search index.

Documents indexed:
  - National Electricity Rules (NER) — full PDF, all volumes
  - AEMO Operational Procedures (SO_OP series)
  - FCAS Technical Standards
  - Market Ancillary Service Specification (MASS)
  - 5-Minute Settlement Implementation Guide
  - NEM Registration and Exemption List
  - NEMDE model documentation

Source documents should be placed in:
  agent/rag/documents/  (PDFs and plain-text files)

Output:
  Unity Catalog table: energy_copilot.rag.aemo_document_chunks
  Vector Search index: energy_copilot.rag.aemo_documents_vs_index

Usage:
  python index_documents.py --source-dir ./documents --reset

Prerequisites:
  pip install pypdf langchain-text-splitters databricks-vectorsearch

Environment variables required:
  DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_WAREHOUSE_ID
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Iterator

from databricks import sql as dbsql
from databricks.sdk import WorkspaceClient
from databricks.vector_search.client import VectorSearchClient

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_CATALOG = os.getenv("DATABRICKS_CATALOG", "energy_copilot")
_SCHEMA = "rag"
_CHUNKS_TABLE = f"{_CATALOG}.{_SCHEMA}.aemo_document_chunks"
_VS_ENDPOINT = os.getenv("DATABRICKS_VS_ENDPOINT", "energy-copilot-vs-endpoint")
_VS_INDEX = f"{_CATALOG}.{_SCHEMA}.aemo_documents_vs_index"
_EMBEDDING_MODEL = "databricks-gte-large-en"  # Databricks-hosted embedding model

# Chunking parameters
_CHUNK_SIZE = 512      # tokens (approximate; using character proxy)
_CHUNK_OVERLAP = 64    # token overlap between consecutive chunks
_CHARS_PER_TOKEN = 4   # rough approximation


# ---------------------------------------------------------------------------
# Document chunking
# ---------------------------------------------------------------------------

def _extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract raw text from a PDF file using pypdf."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(pdf_path))
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            pages.append(f"[PAGE {i+1}]\n{text}")
        return "\n".join(pages)
    except ImportError:
        raise ImportError("Install pypdf: pip install pypdf")


def _extract_text_from_txt(txt_path: Path) -> str:
    """Read plain-text document."""
    return txt_path.read_text(encoding="utf-8", errors="replace")


def _chunk_text(
    text: str,
    source_doc: str,
    chunk_size_chars: int = _CHUNK_SIZE * _CHARS_PER_TOKEN,
    overlap_chars: int = _CHUNK_OVERLAP * _CHARS_PER_TOKEN,
) -> Iterator[dict]:
    """
    Yield fixed-size character chunks with overlap from *text*.

    Each yielded dict contains:
      chunk_id, source_doc, section, page_number, text, char_count,
      last_updated, doc_hash
    """
    # Attempt to detect section numbers in text for metadata
    import re
    section_pattern = re.compile(r"\b(\d+\.\d+(?:\.\d+)*)\b")

    doc_hash = hashlib.md5(text.encode()).hexdigest()[:12]
    text_len = len(text)
    chunk_index = 0
    pos = 0

    while pos < text_len:
        end = min(pos + chunk_size_chars, text_len)
        chunk_text = text[pos:end]

        # Try to detect page number from [PAGE N] marker within chunk
        page_match = re.search(r"\[PAGE (\d+)\]", chunk_text)
        page_number = int(page_match.group(1)) if page_match else None

        # Detect first section reference in chunk
        section_match = section_pattern.search(chunk_text)
        section = section_match.group(0) if section_match else None

        chunk_id = f"{doc_hash}_{chunk_index:06d}"

        yield {
            "chunk_id": chunk_id,
            "source_doc": source_doc,
            "section": section,
            "page_number": page_number,
            "text": chunk_text.strip(),
            "char_count": len(chunk_text),
            "doc_hash": doc_hash,
            "last_updated": date.today().isoformat(),
        }

        chunk_index += 1
        pos += chunk_size_chars - overlap_chars


# ---------------------------------------------------------------------------
# Databricks helpers
# ---------------------------------------------------------------------------

def _get_db_connection():
    return dbsql.connect(
        server_hostname=os.environ["DATABRICKS_HOST"].replace("https://", ""),
        http_path=f"/sql/1.0/warehouses/{os.environ['DATABRICKS_WAREHOUSE_ID']}",
        access_token=os.environ["DATABRICKS_TOKEN"],
    )


def _ensure_schema_and_table(conn) -> None:
    """Create the rag schema and chunks table if they do not already exist."""
    with conn.cursor() as cur:
        cur.execute(f"CREATE SCHEMA IF NOT EXISTS {_CATALOG}.{_SCHEMA}")
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {_CHUNKS_TABLE} (
                chunk_id    STRING NOT NULL,
                source_doc  STRING NOT NULL,
                section     STRING,
                page_number INT,
                text        STRING NOT NULL,
                char_count  INT,
                doc_hash    STRING,
                last_updated DATE,
                PRIMARY KEY (chunk_id)
            )
            USING DELTA
            TBLPROPERTIES (
                'delta.enableChangeDataFeed' = 'true'
            )
            """
        )
    logger.info("Chunks table ready: %s", _CHUNKS_TABLE)


def _upsert_chunks(conn, chunks: list[dict]) -> int:
    """Bulk upsert chunks into the Delta table. Returns number of rows written."""
    if not chunks:
        return 0

    with conn.cursor() as cur:
        # Write in batches of 500 rows
        batch_size = 500
        written = 0
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            values_sql = ", ".join(
                f"('{c['chunk_id']}', '{c['source_doc'].replace(chr(39), chr(39)*2)}', "
                f"{repr(c['section']) if c['section'] else 'NULL'}, "
                f"{c['page_number'] if c['page_number'] else 'NULL'}, "
                f"'{c['text'].replace(chr(39), chr(39)*2)[:4000]}', "
                f"{c['char_count']}, '{c['doc_hash']}', '{c['last_updated']}')"
                for c in batch
            )
            cur.execute(
                f"""
                INSERT INTO {_CHUNKS_TABLE}
                    (chunk_id, source_doc, section, page_number, text,
                     char_count, doc_hash, last_updated)
                VALUES {values_sql}
                ON CONFLICT (chunk_id) DO UPDATE SET
                    text = EXCLUDED.text,
                    last_updated = EXCLUDED.last_updated
                """
            )
            written += len(batch)
            logger.info("Upserted batch %d/%d (%d chunks)", i // batch_size + 1,
                        -(-len(chunks) // batch_size), len(batch))

    return written


def _ensure_vs_index(ws_client: WorkspaceClient) -> None:
    """Create the Vector Search index if it does not exist."""
    vs_client = VectorSearchClient(
        workspace_url=os.environ["DATABRICKS_HOST"],
        personal_access_token=os.environ["DATABRICKS_TOKEN"],
        disable_notice=True,
    )

    try:
        existing_indexes = vs_client.list_indexes(_VS_ENDPOINT)
        index_names = [idx.name for idx in (existing_indexes or [])]
        if _VS_INDEX in index_names:
            logger.info("Vector Search index already exists: %s", _VS_INDEX)
            return
    except Exception:
        pass

    logger.info("Creating Vector Search index: %s", _VS_INDEX)
    vs_client.create_delta_sync_index(
        endpoint_name=_VS_ENDPOINT,
        index_name=_VS_INDEX,
        source_table_name=_CHUNKS_TABLE,
        pipeline_type="TRIGGERED",  # Manual sync; use CONTINUOUS for real-time
        primary_key="chunk_id",
        embedding_source_column="text",
        embedding_model_endpoint_name=_EMBEDDING_MODEL,
    )
    logger.info("Vector Search index created. Run a sync to populate it.")


def _trigger_vs_sync() -> None:
    """Trigger a pipeline sync to update the Vector Search index."""
    vs_client = VectorSearchClient(
        workspace_url=os.environ["DATABRICKS_HOST"],
        personal_access_token=os.environ["DATABRICKS_TOKEN"],
        disable_notice=True,
    )
    index = vs_client.get_index(_VS_ENDPOINT, _VS_INDEX)
    index.sync()
    logger.info("Vector Search index sync triggered.")


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def index_documents(source_dir: Path, reset: bool = False) -> None:
    """
    Process all PDF and TXT documents in *source_dir* and index them into
    the Databricks Vector Search index.

    Args:
        source_dir: Directory containing source documents.
        reset:      If True, truncate the chunks table before indexing.
    """
    conn = _get_db_connection()
    ws_client = WorkspaceClient(
        host=os.environ["DATABRICKS_HOST"],
        token=os.environ["DATABRICKS_TOKEN"],
    )

    try:
        _ensure_schema_and_table(conn)

        if reset:
            with conn.cursor() as cur:
                logger.warning("Truncating chunks table: %s", _CHUNKS_TABLE)
                cur.execute(f"TRUNCATE TABLE {_CHUNKS_TABLE}")

        doc_files = list(source_dir.glob("**/*.pdf")) + list(source_dir.glob("**/*.txt"))
        if not doc_files:
            logger.warning("No PDF or TXT files found in %s", source_dir)
            return

        logger.info("Found %d documents to index.", len(doc_files))
        total_chunks = 0

        for doc_path in doc_files:
            logger.info("Processing: %s", doc_path.name)
            try:
                if doc_path.suffix.lower() == ".pdf":
                    text = _extract_text_from_pdf(doc_path)
                else:
                    text = _extract_text_from_txt(doc_path)

                chunks = list(_chunk_text(text, source_doc=doc_path.name))
                written = _upsert_chunks(conn, chunks)
                total_chunks += written
                logger.info("Indexed %d chunks from %s", written, doc_path.name)

            except Exception as exc:
                logger.error("Failed to index %s: %s", doc_path.name, exc)
                continue

        logger.info("Total chunks indexed: %d", total_chunks)

        # Ensure VS index exists and trigger sync
        _ensure_vs_index(ws_client)
        _trigger_vs_sync()

    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Index AEMO documents into Databricks Vector Search")
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=Path(__file__).parent / "documents",
        help="Directory containing PDF/TXT documents to index",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Truncate the chunks table before indexing (full re-index)",
    )
    args = parser.parse_args()

    if not args.source_dir.exists():
        logger.error("Source directory does not exist: %s", args.source_dir)
        raise SystemExit(1)

    index_documents(args.source_dir, reset=args.reset)

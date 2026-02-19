"""
agent/rag/index_documents.py
==============================
Script to chunk, embed, and index AEMO market rules documents into a
Databricks Vector Search index.

Supported document types:
  - AEMO_MARKET_RULES (PDF) — NER, SO_OP series, MASS, FCAS Technical Standards
  - AEMO_CONSTRAINTS  (XML) — Constraint equation library export files
  - AEMO_NOTICES      (HTML) — AEMO market notices and information papers

Output:
  Unity Catalog table: energy_copilot.gold.aemo_document_chunks
  Vector Search index: energy_copilot.gold.aemo_docs_vs_index

Usage:
  python index_documents.py --source-dir ./documents --reset
  python index_documents.py --source-dir ./documents --dry-run

CLI flags:
  --source-dir   Directory containing source documents (default: ./documents)
  --reset        Truncate chunks table before indexing (full re-index)
  --dry-run      Chunk documents and print stats, but do NOT write to Delta
                 or create / sync the VS index

Prerequisites:
  pip install pypdf databricks-vectorsearch databricks-sql-connector \
              databricks-sdk

Environment variables required (not needed for --dry-run):
  DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_WAREHOUSE_ID
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator, Optional

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_CATALOG = os.getenv("DATABRICKS_CATALOG", "energy_copilot")
_SCHEMA = "gold"
_CHUNKS_TABLE = f"{_CATALOG}.{_SCHEMA}.aemo_document_chunks"
_VS_ENDPOINT = os.getenv("DATABRICKS_VS_ENDPOINT", "energy-copilot-vs-endpoint")
_VS_INDEX = f"{_CATALOG}.{_SCHEMA}.aemo_docs_vs_index"
_EMBEDDING_MODEL = "databricks-gte-large-en"  # Databricks Foundation Model

# Chunking parameters
_PDF_CHUNK_SIZE = 1500      # chars
_PDF_CHUNK_OVERLAP = 200    # chars


# ---------------------------------------------------------------------------
# Document type detection
# ---------------------------------------------------------------------------

def _detect_doc_type(path: Path) -> str:
    """
    Infer the document type from the file extension.

    Args:
        path: Path to the source document.

    Returns:
        One of ``"AEMO_MARKET_RULES"``, ``"AEMO_CONSTRAINTS"``, or
        ``"AEMO_NOTICES"``.
    """
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return "AEMO_MARKET_RULES"
    if suffix == ".xml":
        return "AEMO_CONSTRAINTS"
    if suffix in (".html", ".htm"):
        return "AEMO_NOTICES"
    return "AEMO_MARKET_RULES"  # default


# ---------------------------------------------------------------------------
# PDF chunking (AEMO_MARKET_RULES)
# ---------------------------------------------------------------------------

def _extract_text_from_pdf(pdf_path: Path) -> str:
    """
    Extract raw text from a PDF file using pypdf.

    Args:
        pdf_path: Path to the PDF file.

    Returns:
        Concatenated page text with ``[PAGE N]`` markers.

    Raises:
        ImportError: If pypdf is not installed.
    """
    try:
        from pypdf import PdfReader  # noqa: PLC0415
    except ImportError as exc:
        raise ImportError("Install pypdf: pip install pypdf") from exc

    reader = PdfReader(str(pdf_path))
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        pages.append(f"[PAGE {i + 1}]\n{text}")
    return "\n".join(pages)


def _chunk_pdf(
    text: str,
    source_url: str,
    chunk_size: int = _PDF_CHUNK_SIZE,
    overlap: int = _PDF_CHUNK_OVERLAP,
) -> Iterator[dict]:
    """
    Chunk PDF text using naive paragraph (``\\n\\n``) splitting with a
    fallback to character-based sliding window for paragraphs that exceed
    *chunk_size*.

    Each yielded dict contains keys matching the Delta table schema:
    ``chunk_id``, ``content``, ``metadata_json``, ``embedding_model``,
    ``indexed_at``.

    Args:
        text:       Full document text (with ``[PAGE N]`` markers).
        source_url: Canonical URL or file name for the source document.
        chunk_size: Target maximum character length per chunk.
        overlap:    Character overlap between consecutive sliding-window chunks.

    Yields:
        Chunk dicts ready for Delta table insertion.
    """
    _page_re = re.compile(r"\[PAGE (\d+)\]")
    _section_re = re.compile(r"\b(\d+\.\d+(?:\.\d+)*)\b")

    # Split on paragraph boundaries first
    paragraphs = re.split(r"\n{2,}", text)

    buffer = ""
    chunk_index = 0
    current_page: Optional[int] = None

    def _flush(buf: str, page: Optional[int], idx: int) -> Iterator[dict]:
        """Emit one or more chunks from *buf*, splitting if it exceeds chunk_size."""
        buf = buf.strip()
        if not buf:
            return
        if len(buf) <= chunk_size:
            yield _make_chunk(buf, source_url, "AEMO_MARKET_RULES", page, idx)
        else:
            # Sliding window split for oversized paragraphs
            pos = 0
            sub_idx = 0
            while pos < len(buf):
                end = min(pos + chunk_size, len(buf))
                yield _make_chunk(buf[pos:end].strip(), source_url, "AEMO_MARKET_RULES",
                                  page, idx + sub_idx)
                sub_idx += 1
                pos += chunk_size - overlap

    for para in paragraphs:
        # Update current page tracker
        page_match = _page_re.search(para)
        if page_match:
            current_page = int(page_match.group(1))

        candidate = (buffer + "\n\n" + para).strip() if buffer else para.strip()
        if len(candidate) <= chunk_size:
            buffer = candidate
        else:
            # Flush what we have, start new buffer
            for chunk in _flush(buffer, current_page, chunk_index):
                chunk_index += 1
                yield chunk
            buffer = para.strip()

    # Flush remaining buffer
    for chunk in _flush(buffer, current_page, chunk_index):
        yield chunk


# ---------------------------------------------------------------------------
# XML chunking (AEMO_CONSTRAINTS)
# ---------------------------------------------------------------------------

def _chunk_xml(xml_path: Path, source_url: str) -> Iterator[dict]:
    """
    Parse an AEMO constraint equation XML file and yield one chunk per
    ``<ConstraintEquation>`` element.

    Args:
        xml_path:   Path to the XML file.
        source_url: Canonical URL or file name for the source document.

    Yields:
        Chunk dicts ready for Delta table insertion.
    """
    try:
        import xml.etree.ElementTree as ET  # noqa: PLC0415
    except ImportError as exc:
        raise ImportError("xml.etree.ElementTree is part of the Python stdlib") from exc

    try:
        tree = ET.parse(str(xml_path))
        root = tree.getroot()
    except ET.ParseError as exc:
        logger.error("Failed to parse XML file %s: %s", xml_path.name, exc)
        return

    chunk_index = 0
    # Search for <ConstraintEquation> anywhere in the tree
    for elem in root.iter("ConstraintEquation"):
        content = ET.tostring(elem, encoding="unicode", method="text").strip()
        # Try to extract a section title from attributes or child elements
        eq_id = (
            elem.get("EquationID")
            or elem.get("id")
            or elem.get("constraintid")
            or ""
        )
        section_title = eq_id or f"ConstraintEquation[{chunk_index}]"
        if content:
            yield _make_chunk(
                content,
                source_url,
                "AEMO_CONSTRAINTS",
                page_number=None,
                chunk_index=chunk_index,
                section_title=section_title,
            )
            chunk_index += 1

    if chunk_index == 0:
        logger.warning("No <ConstraintEquation> elements found in %s", xml_path.name)


# ---------------------------------------------------------------------------
# HTML chunking (AEMO_NOTICES)
# ---------------------------------------------------------------------------

def _strip_html_tags(html: str) -> str:
    """
    Strip HTML tags from *html*, returning clean text.

    Uses a simple regex approach — sufficient for AEMO's relatively simple
    notice HTML without installing a full HTML parser dependency.

    Args:
        html: Raw HTML string.

    Returns:
        Plain text with normalised whitespace.
    """
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&quot;", '"', text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


def _chunk_html(html_path: Path, source_url: str) -> Iterator[dict]:
    """
    Split an AEMO HTML notice into chunks by heading tags (h1–h3), stripping
    HTML tags from the content.

    Args:
        html_path:  Path to the HTML file.
        source_url: Canonical URL or file name for the source document.

    Yields:
        Chunk dicts ready for Delta table insertion.
    """
    try:
        raw = html_path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        logger.error("Failed to read HTML file %s: %s", html_path.name, exc)
        return

    # Split on heading tags to form sections
    heading_re = re.compile(r"(<h[1-3][^>]*>.*?</h[1-3]>)", re.IGNORECASE | re.DOTALL)
    parts = heading_re.split(raw)

    section_title = "Introduction"
    chunk_index = 0
    buffer = ""

    for part in parts:
        heading_match = heading_re.match(part)
        if heading_match:
            # Flush previous buffer
            content = _strip_html_tags(buffer).strip()
            if content:
                yield _make_chunk(
                    content,
                    source_url,
                    "AEMO_NOTICES",
                    page_number=None,
                    chunk_index=chunk_index,
                    section_title=section_title,
                )
                chunk_index += 1
            # Start a new section
            section_title = _strip_html_tags(part).strip()
            buffer = ""
        else:
            buffer += part

    # Flush remaining content
    content = _strip_html_tags(buffer).strip()
    if content:
        yield _make_chunk(
            content,
            source_url,
            "AEMO_NOTICES",
            page_number=None,
            chunk_index=chunk_index,
            section_title=section_title,
        )


# ---------------------------------------------------------------------------
# Shared chunk factory
# ---------------------------------------------------------------------------

def _make_chunk(
    content: str,
    source_url: str,
    doc_type: str,
    page_number: Optional[int],
    chunk_index: int,
    section_title: Optional[str] = None,
) -> dict:
    """
    Build a chunk dict matching the Delta table schema.

    Generates a deterministic UUID based on ``source_url + chunk_index`` so
    that re-indexing the same document produces the same ``chunk_id`` values,
    enabling idempotent upserts.

    Args:
        content:       The text content for this chunk.
        source_url:    Source document URL or file name.
        doc_type:      One of ``AEMO_MARKET_RULES``, ``AEMO_CONSTRAINTS``,
                       ``AEMO_NOTICES``.
        page_number:   Page number within the source PDF, or None.
        chunk_index:   Zero-based position of this chunk within the document.
        section_title: Extracted section or heading title, or None.

    Returns:
        Dict with keys: ``chunk_id``, ``content``, ``metadata_json``,
        ``embedding_model``, ``indexed_at``.
    """
    # Deterministic UUID from (source_url, chunk_index) pair
    name_hash = hashlib.sha256(f"{source_url}::{chunk_index}".encode()).hexdigest()
    chunk_id = str(uuid.UUID(name_hash[:32]))

    metadata = {
        "source_url": source_url,
        "doc_type": doc_type,
        "section_title": section_title or "",
        "chunk_index": chunk_index,
        "word_count": len(content.split()),
        "page_number": page_number,
    }
    if page_number is not None:
        metadata["page_number"] = page_number

    return {
        "chunk_id": chunk_id,
        "content": content,
        "metadata_json": json.dumps(metadata),
        "embedding_model": _EMBEDDING_MODEL,
        "indexed_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Databricks helpers
# ---------------------------------------------------------------------------

def _get_db_connection():
    """Return a Databricks SQL connector connection."""
    from databricks import sql as dbsql  # noqa: PLC0415

    return dbsql.connect(
        server_hostname=os.environ["DATABRICKS_HOST"].replace("https://", ""),
        http_path=f"/sql/1.0/warehouses/{os.environ['DATABRICKS_WAREHOUSE_ID']}",
        access_token=os.environ["DATABRICKS_TOKEN"],
    )


def _ensure_schema_and_table(conn) -> None:
    """
    Create the gold schema and ``aemo_document_chunks`` Delta table if they do
    not already exist.

    Table schema:
      - chunk_id       STRING NOT NULL (deterministic UUID, primary key)
      - content        STRING NOT NULL (chunk text)
      - metadata_json  STRING          (JSON blob: source_url, doc_type, etc.)
      - embedding_model STRING         (embedding model name)
      - indexed_at     TIMESTAMP       (UTC timestamp of last index run)

    ``delta.enableChangeDataFeed = true`` is set so that Vector Search can
    perform incremental sync.

    Args:
        conn: Active Databricks SQL connector connection.
    """
    with conn.cursor() as cur:
        cur.execute(f"CREATE SCHEMA IF NOT EXISTS {_CATALOG}.{_SCHEMA}")
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {_CHUNKS_TABLE} (
                chunk_id        STRING    NOT NULL,
                content         STRING    NOT NULL,
                metadata_json   STRING,
                embedding_model STRING,
                indexed_at      TIMESTAMP,
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
    """
    Bulk-upsert chunk rows into the Delta table.

    Uses ``INSERT INTO … ON CONFLICT (chunk_id) DO UPDATE`` to make the
    operation idempotent.  Writes in batches of 500 rows to stay within SQL
    statement size limits.

    Args:
        conn:   Active Databricks SQL connector connection.
        chunks: List of chunk dicts produced by the chunking functions.

    Returns:
        Total number of rows written (including updates).
    """
    if not chunks:
        return 0

    def _esc(s: str) -> str:
        """Escape single quotes for SQL string literals."""
        return s.replace("'", "''")

    batch_size = 500
    written = 0

    with conn.cursor() as cur:
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i: i + batch_size]
            values_sql = ", ".join(
                f"('{_esc(c['chunk_id'])}', "
                f"'{_esc(c['content'][:4000])}', "
                f"'{_esc(c['metadata_json'])}', "
                f"'{_esc(c['embedding_model'])}', "
                f"CAST('{_esc(c['indexed_at'])}' AS TIMESTAMP))"
                for c in batch
            )
            cur.execute(
                f"""
                INSERT INTO {_CHUNKS_TABLE}
                    (chunk_id, content, metadata_json, embedding_model, indexed_at)
                VALUES {values_sql}
                ON CONFLICT (chunk_id) DO UPDATE SET
                    content         = EXCLUDED.content,
                    metadata_json   = EXCLUDED.metadata_json,
                    embedding_model = EXCLUDED.embedding_model,
                    indexed_at      = EXCLUDED.indexed_at
                """
            )
            written += len(batch)
            logger.info(
                "Upserted batch %d/%d (%d chunks)",
                i // batch_size + 1,
                -(-len(chunks) // batch_size),
                len(batch),
            )

    return written


def _ensure_vs_index() -> None:
    """
    Create the Vector Search index pointing at the Delta chunks table if it
    does not already exist.

    Uses ``TRIGGERED`` pipeline type (manual sync).  Switch to ``CONTINUOUS``
    for near-real-time updates at the cost of higher DBU usage.

    Gracefully degrades if the Databricks Vector Search SDK is unavailable
    (logs a warning and skips the VS step).
    """
    try:
        from databricks.vector_search.client import VectorSearchClient  # noqa: PLC0415, F821
    except ImportError:
        logger.warning(
            "databricks-vectorsearch not installed — skipping Vector Search index creation. "
            "Install with: pip install databricks-vectorsearch"
        )
        return

    try:
        vsc = VectorSearchClient(  # noqa: F821
            workspace_url=os.environ["DATABRICKS_HOST"],
            personal_access_token=os.environ["DATABRICKS_TOKEN"],
            disable_notice=True,
        )

        # Check if index already exists
        try:
            existing = vsc.list_indexes(_VS_ENDPOINT)
            index_names = [idx.name for idx in (existing or [])]
            if _VS_INDEX in index_names:
                logger.info("Vector Search index already exists: %s", _VS_INDEX)
                return
        except Exception:  # noqa: BLE001
            pass  # list_indexes may fail if endpoint not yet active; proceed to create

        logger.info("Creating Vector Search index: %s", _VS_INDEX)
        vsc.create_delta_sync_index(
            endpoint_name=_VS_ENDPOINT,
            index_name=_VS_INDEX,
            source_table_name=_CHUNKS_TABLE,
            pipeline_type="TRIGGERED",
            primary_key="chunk_id",
            embedding_source_column="content",
            embedding_model_endpoint_name=_EMBEDDING_MODEL,
        )
        logger.info("Vector Search index created successfully.")

    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Could not create/verify Vector Search index (%s). "
            "Delta write still succeeded. Error: %s",
            _VS_INDEX,
            exc,
        )


def _trigger_vs_sync() -> None:
    """
    Trigger a pipeline sync to update the Vector Search index after new chunks
    have been written.

    Gracefully degrades if the SDK is unavailable or the sync call fails.
    """
    try:
        from databricks.vector_search.client import VectorSearchClient  # noqa: PLC0415, F821
    except ImportError:
        logger.warning("databricks-vectorsearch not installed — skipping VS sync.")
        return

    try:
        vsc = VectorSearchClient(  # noqa: F821
            workspace_url=os.environ["DATABRICKS_HOST"],
            personal_access_token=os.environ["DATABRICKS_TOKEN"],
            disable_notice=True,
        )
        index = vsc.get_index(_VS_ENDPOINT, _VS_INDEX)
        index.sync()
        logger.info("Vector Search index sync triggered: %s", _VS_INDEX)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Could not trigger Vector Search sync (%s): %s — "
            "run a manual sync from the Databricks UI or wait for the "
            "CONTINUOUS pipeline to pick up the new chunks.",
            _VS_INDEX,
            exc,
        )


# ---------------------------------------------------------------------------
# Main indexing function
# ---------------------------------------------------------------------------

def index_documents(
    source_dir: Path,
    reset: bool = False,
    dry_run: bool = False,
) -> None:
    """
    Process all supported documents in *source_dir* and index them into the
    Databricks Vector Search index.

    Supported formats: ``.pdf`` (AEMO_MARKET_RULES), ``.xml``
    (AEMO_CONSTRAINTS), ``.html``/``.htm`` (AEMO_NOTICES).

    Args:
        source_dir: Directory containing source documents.
        reset:      If True, truncate the chunks table before indexing
                    (full re-index).  Has no effect when ``dry_run=True``.
        dry_run:    If True, chunk all documents and print statistics but do
                    NOT write to Delta or create / sync the VS index.
    """
    supported_globs = [
        ("**/*.pdf", _PDF_CHUNK_SIZE, None),
        ("**/*.xml", None, None),
        ("**/*.html", None, None),
        ("**/*.htm", None, None),
    ]

    doc_files: list[Path] = []
    for pattern, *_ in supported_globs:
        doc_files.extend(source_dir.glob(pattern))

    if not doc_files:
        logger.warning("No supported documents found in %s", source_dir)
        return

    logger.info("Found %d document(s) to index.", len(doc_files))

    # ----- dry-run: chunk and print stats, exit without writing -----
    if dry_run:
        logger.info("[DRY RUN] Chunking documents — no Delta writes will occur.")
        total_chunks = 0
        for doc_path in doc_files:
            doc_type = _detect_doc_type(doc_path)
            source_url = doc_path.name
            try:
                chunks = list(_iter_chunks(doc_path, doc_type, source_url))
                word_counts = [
                    json.loads(c["metadata_json"]).get("word_count", 0)
                    for c in chunks
                ]
                avg_words = sum(word_counts) / len(word_counts) if word_counts else 0
                logger.info(
                    "[DRY RUN] %s (%s): %d chunks, avg %.0f words/chunk",
                    doc_path.name,
                    doc_type,
                    len(chunks),
                    avg_words,
                )
                total_chunks += len(chunks)
            except Exception as exc:  # noqa: BLE001
                logger.error("[DRY RUN] Failed to chunk %s: %s", doc_path.name, exc)
        logger.info("[DRY RUN] Total chunks that would be written: %d", total_chunks)
        return

    # ----- live run: write to Delta + VS -----
    conn = _get_db_connection()
    try:
        _ensure_schema_and_table(conn)

        if reset:
            with conn.cursor() as cur:
                logger.warning("Truncating chunks table: %s", _CHUNKS_TABLE)
                cur.execute(f"TRUNCATE TABLE {_CHUNKS_TABLE}")

        total_chunks = 0
        for doc_path in doc_files:
            doc_type = _detect_doc_type(doc_path)
            source_url = doc_path.name
            logger.info("Processing: %s (%s)", doc_path.name, doc_type)
            try:
                chunks = list(_iter_chunks(doc_path, doc_type, source_url))
                written = _upsert_chunks(conn, chunks)
                total_chunks += written
                logger.info("Indexed %d chunks from %s", written, doc_path.name)
            except Exception as exc:  # noqa: BLE001
                logger.error("Failed to index %s: %s", doc_path.name, exc)
                continue

        logger.info("Total chunks indexed: %d", total_chunks)

        # VS index creation and sync (graceful degradation if SDK unavailable)
        _ensure_vs_index()
        _trigger_vs_sync()

    finally:
        conn.close()


def _iter_chunks(
    doc_path: Path,
    doc_type: str,
    source_url: str,
) -> Iterator[dict]:
    """
    Dispatch to the correct chunking function based on *doc_type*.

    Args:
        doc_path:   Path to the source file.
        doc_type:   ``"AEMO_MARKET_RULES"``, ``"AEMO_CONSTRAINTS"``, or
                    ``"AEMO_NOTICES"``.
        source_url: Canonical URL or file name for metadata.

    Yields:
        Chunk dicts ready for Delta table insertion.
    """
    if doc_type == "AEMO_MARKET_RULES":
        text = _extract_text_from_pdf(doc_path)
        yield from _chunk_pdf(text, source_url)

    elif doc_type == "AEMO_CONSTRAINTS":
        yield from _chunk_xml(doc_path, source_url)

    elif doc_type == "AEMO_NOTICES":
        yield from _chunk_html(doc_path, source_url)

    else:
        # Fallback: read as plain text and chunk as PDF-style
        text = doc_path.read_text(encoding="utf-8", errors="replace")
        yield from _chunk_pdf(text, source_url)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Index AEMO documents into Databricks Vector Search"
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=Path(__file__).parent / "documents",
        help="Directory containing PDF/XML/HTML documents to index",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Truncate the chunks table before indexing (full re-index)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Chunk documents and print statistics, but do NOT write to Delta "
            "or create / sync the Vector Search index"
        ),
    )
    args = parser.parse_args()

    if not args.source_dir.exists():
        logger.error("Source directory does not exist: %s", args.source_dir)
        raise SystemExit(1)

    index_documents(args.source_dir, reset=args.reset, dry_run=args.dry_run)

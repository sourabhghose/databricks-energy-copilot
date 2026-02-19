"""
agent/tools/rag_tools.py
==========================
RAG tool that queries the Databricks Vector Search index populated with
AEMO market rules, constraint equations, and market notice documents.

The index is built by agent/rag/index_documents.py and stored in the
Unity Catalog under energy_copilot.gold.aemo_docs_vs_index.

Fallback behaviour:
  If the Databricks Vector Search SDK is not installed, or if the VS query
  fails for any reason, the tool falls back to a SQL LIKE query against the
  Delta chunks table (energy_copilot.gold.aemo_document_chunks).
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Optional

from langchain_core.tools import tool

logger = logging.getLogger(__name__)

_CATALOG = os.getenv("DATABRICKS_CATALOG", "energy_copilot")
_VS_ENDPOINT = os.getenv("DATABRICKS_VS_ENDPOINT", "energy-copilot-vs-endpoint")
_VS_INDEX = f"{_CATALOG}.gold.aemo_docs_vs_index"
_CHUNKS_TABLE = f"{_CATALOG}.gold.aemo_document_chunks"

# Maximum characters to include per result content field
_MAX_CONTENT_CHARS = 2000


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_vs_client():
    """
    Return an authenticated Databricks Vector Search client.

    Raises:
        ImportError: If databricks-vectorsearch is not installed.
        KeyError:    If DATABRICKS_HOST or DATABRICKS_TOKEN env vars are unset.
    """
    from databricks.vector_search.client import VectorSearchClient  # noqa: PLC0415, F821
    return VectorSearchClient(  # noqa: F821
        workspace_url=os.environ["DATABRICKS_HOST"],
        personal_access_token=os.environ["DATABRICKS_TOKEN"],
        disable_notice=True,
    )


def _sanitize_sql_query(query: str) -> str:
    """
    Sanitize *query* for safe embedding in a SQL LIKE clause.

    Strips characters that could break out of a string literal or introduce
    SQL injection: single quotes, double quotes, semicolons, backslashes,
    and SQL comment sequences.

    Args:
        query: Raw user search query string.

    Returns:
        Sanitized query safe for use inside a SQL string literal.
    """
    # Remove characters dangerous in SQL string context
    cleaned = re.sub(r"['\";\\]", "", query)
    # Remove SQL comment sequences
    cleaned = re.sub(r"--.*", "", cleaned)
    cleaned = re.sub(r"/\*.*?\*/", "", cleaned, flags=re.DOTALL)
    # Collapse whitespace
    cleaned = " ".join(cleaned.split())
    return cleaned[:500]  # hard-cap length


def _sql_fallback_search(safe_query: str, top_k: int) -> list[dict]:
    """
    Fall back to a Delta SQL LIKE search when VS is unavailable.

    Uses ``spark.sql()`` in Databricks notebook/job context (``spark`` is
    injected by the runtime).  Outside Databricks this function will raise
    ``NameError`` which is caught by the caller.

    Args:
        safe_query: Sanitized query string (no SQL-unsafe characters).
        top_k:      Maximum number of results to return.

    Returns:
        List of result dicts with ``content``, ``source``, and
        ``relevance_score`` keys.
    """
    sql = (
        f"SELECT chunk_id, content, metadata_json "
        f"FROM {_CHUNKS_TABLE} "
        f"WHERE content LIKE '%{safe_query}%' "
        f"LIMIT {top_k}"
    )
    rows = spark.sql(sql).collect()  # noqa: F821 — spark is Databricks runtime global

    results = []
    for row in rows:
        metadata = {}
        if row.metadata_json:
            try:
                metadata = json.loads(row.metadata_json)
            except json.JSONDecodeError:
                pass
        results.append(
            {
                "content": (row.content or "")[:_MAX_CONTENT_CHARS],
                "source": metadata.get("source_url", row.chunk_id),
                "relevance_score": None,  # SQL LIKE has no relevance score
                "doc_type": metadata.get("doc_type", ""),
                "section_title": metadata.get("section_title", ""),
            }
        )
    return results


# ---------------------------------------------------------------------------
# Tool: search_market_rules
# ---------------------------------------------------------------------------

@tool
def search_market_rules(
    query: str,
    doc_types: Optional[list] = None,
    top_k: int = 5,
) -> dict:
    """
    Search the AEMO market rules, constraint equations, and market notices
    knowledge base using semantic vector search.

    Use this tool when the user asks questions about:
      - NEM market rules and regulations (National Electricity Rules, NER)
      - FCAS technical standards and performance requirements
      - Ancillary services market design
      - Administered pricing and market suspension procedures
      - Generator registration requirements
      - Interconnector and network access rules
      - AEMO operational procedures (SO_OP series)
      - Settlement and metering requirements
      - Market systems (NEMDE, EMMS, 5MS/GS reforms)
      - Active constraint equations and their formulae
      - AEMO market notices and information papers

    Do NOT use this tool for real-time or historical market data queries —
    use the market_data_tools for those.

    Args:
        query:     Natural language query describing the regulatory or
                   procedural topic to look up. Be specific; include relevant
                   acronyms and section references if known.
                   Examples:
                     "How does AEMO calculate the causer pays factor for
                      FCAS RAISE6SEC?"
                     "What is the Market Price Cap and how is it set?"
                     "NER clause 3.8.22 rebidding rules"
        doc_types: Optional list of document type filters. Valid values:
                     "AEMO_MARKET_RULES"  — NER, SO_OP series, MASS, etc.
                     "AEMO_CONSTRAINTS"   — Constraint equation library
                     "AEMO_NOTICES"       — Market notices and info papers
                   Pass None (default) to search across all document types.
        top_k:     Number of most relevant document chunks to return
                   (default 5, max 20). Increase for complex topics requiring
                   broader context.

    Returns:
        A dict with keys:
          - "results"     (list) Up to top_k document chunks, each containing:
              - "content"         (str)   The relevant text chunk
              - "source"          (str)   Source document name or URL
              - "relevance_score" (float) Cosine similarity (0.0–1.0); scores
                                          above 0.75 are highly relevant; None
                                          when using SQL fallback
              - "doc_type"        (str)   One of AEMO_MARKET_RULES /
                                          AEMO_CONSTRAINTS / AEMO_NOTICES
              - "section_title"   (str)   Section heading or constraint ID
          - "query"       (str)  The search query that was executed
          - "num_results" (int)  Number of results returned
          - "search_mode" (str)  "vector_search" or "sql_fallback"

    Example:
        >>> search_market_rules("What triggers a market price cap event?")
        {"results": [{"content": "The spot price is capped at ...",
                      "source": "NER_v205.pdf",
                      "relevance_score": 0.91, ...}], ...}
    """
    if not query or not query.strip():
        return {"error": "Query must be a non-empty string.",
                "results": [], "query": query, "num_results": 0}
    if not (1 <= top_k <= 20):
        return {"error": f"top_k must be between 1 and 20, got {top_k}.",
                "results": [], "query": query, "num_results": 0}

    # Build doc_type filter expression for VS API
    vs_filters = None
    if doc_types:
        valid_types = {"AEMO_MARKET_RULES", "AEMO_CONSTRAINTS", "AEMO_NOTICES"}
        filtered = [t for t in doc_types if t in valid_types]
        if filtered:
            vs_filters = {"doc_type": filtered}

    # --- Primary path: Databricks Vector Search ---
    try:
        vs_client = _get_vs_client()
        index = vs_client.get_index(
            endpoint_name=_VS_ENDPOINT,
            index_name=_VS_INDEX,
        )

        query_kwargs: dict = {
            "query_text": query,
            "columns": ["chunk_id", "content", "metadata_json"],
            "num_results": top_k,
        }
        if vs_filters:
            query_kwargs["filters"] = vs_filters

        response = index.similarity_search(**query_kwargs)

        hits: list[dict] = []
        data_array = response.get("result", {}).get("data_array", [])
        columns_meta = response.get("manifest", {}).get("columns", [])
        col_names = [c["name"] for c in columns_meta]

        for item in data_array:
            record = dict(zip(col_names, item))
            metadata: dict = {}
            if record.get("metadata_json"):
                try:
                    metadata = json.loads(record["metadata_json"])
                except json.JSONDecodeError:
                    pass

            # VS appends the score as the last element; it may appear as
            # "score" in the column manifest or as the last unnamed field
            score = record.pop("score", None)
            if score is None and len(item) == len(col_names) + 1:
                score = item[-1]

            hits.append(
                {
                    "content": (record.get("content") or "")[:_MAX_CONTENT_CHARS],
                    "source": metadata.get("source_url", record.get("chunk_id", "")),
                    "relevance_score": round(float(score), 4) if score is not None else None,
                    "doc_type": metadata.get("doc_type", ""),
                    "section_title": metadata.get("section_title", ""),
                }
            )

        return {
            "results": hits,
            "query": query,
            "num_results": len(hits),
            "search_mode": "vector_search",
        }

    except ImportError:
        logger.warning(
            "databricks-vectorsearch not installed — falling back to SQL LIKE search."
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Vector Search query failed (%s) — falling back to SQL LIKE search. "
            "Error: %s",
            _VS_INDEX,
            exc,
        )

    # --- Fallback path: SQL LIKE search via Spark ---
    safe_query = _sanitize_sql_query(query)
    try:
        sql_results = _sql_fallback_search(safe_query, top_k)

        # Apply doc_type filter in Python (SQL fallback doesn't support VS filters)
        if doc_types:
            valid_types = set(doc_types)
            sql_results = [r for r in sql_results if r.get("doc_type") in valid_types]

        return {
            "results": sql_results,
            "query": query,
            "num_results": len(sql_results),
            "search_mode": "sql_fallback",
        }

    except Exception as exc:  # noqa: BLE001
        logger.exception("SQL fallback search also failed for query: %s", query)
        return {
            "error": (
                f"Both Vector Search and SQL fallback failed. "
                f"VS error triggered fallback; SQL error: {exc}"
            ),
            "results": [],
            "query": query,
            "num_results": 0,
            "search_mode": "failed",
        }

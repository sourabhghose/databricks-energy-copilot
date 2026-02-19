"""
agent/tools/rag_tools.py
==========================
RAG tool that queries the Databricks Vector Search index populated with
AEMO market rules, NER (National Electricity Rules), and operational
procedures documentation.

The index is built by agent/rag/index_documents.py and stored in the
Unity Catalog under energy_copilot.rag.aemo_documents_vs_index.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from databricks.sdk import WorkspaceClient
from databricks.vector_search.client import VectorSearchClient
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

_CATALOG = os.getenv("DATABRICKS_CATALOG", "energy_copilot")
_VS_ENDPOINT = os.getenv("DATABRICKS_VS_ENDPOINT", "energy-copilot-vs-endpoint")
_VS_INDEX = f"{_CATALOG}.rag.aemo_documents_vs_index"


def _get_vs_client() -> VectorSearchClient:
    """Return an authenticated Databricks Vector Search client."""
    return VectorSearchClient(
        workspace_url=os.environ["DATABRICKS_HOST"],
        personal_access_token=os.environ["DATABRICKS_TOKEN"],
        disable_notice=True,
    )


# ---------------------------------------------------------------------------
# Tool: search_market_rules
# ---------------------------------------------------------------------------

@tool
def search_market_rules(query: str, top_k: int = 5) -> list:
    """
    Search the AEMO market rules and National Electricity Rules (NER) knowledge
    base using semantic vector search.

    Use this tool when the user asks questions about:
      - NEM market rules and regulations
      - FCAS technical standards and performance requirements
      - Ancillary services market design
      - Administered pricing and market suspension procedures
      - Generator registration requirements
      - Interconnector and network access rules
      - AEMO operational procedures (SO_OP series)
      - Settlements and metering requirements
      - Market systems (NEMDE, EMMS, 5MS/GS reforms)

    Do NOT use this tool for real-time or historical market data queries —
    use the market_data_tools for those.

    Args:
        query: Natural language query describing the regulatory or procedural
               topic to look up. Be specific; include relevant acronyms and
               section references if known.
               Example: "How does AEMO calculate the causer pays factor for
                         FCAS RAISE6SEC?"
               Example: "What is the Market Price Cap and how is it set?"
               Example: "NER clause 3.8.22 rebidding rules"
        top_k: Number of most relevant document chunks to return (default 5,
               max 20). Increase for complex topics requiring broader context.

    Returns:
        A list of up to top_k document chunks, each containing:
          - "chunk_id"        (str)   Unique identifier for this text chunk
          - "source_doc"      (str)   Source document name, e.g.
                                      "National_Electricity_Rules_v205.pdf"
          - "section"         (str)   Rule/section number if extractable,
                                      e.g. "3.8.22" or "Chapter 3 Part 3.8"
          - "page_number"     (int)   Page number in source document
          - "text"            (str)   The relevant text chunk (200-500 tokens)
          - "relevance_score" (float) Cosine similarity score (0.0–1.0);
                                      scores above 0.75 are highly relevant
          - "last_updated"    (str)   ISO-8601 date when this document was
                                      last ingested into the index

        Returns an empty list if no relevant documents are found.

    Note:
        The knowledge base covers AEMO documents as of February 2026. For the
        most current rules, always cross-reference with the AEMO website
        (https://www.aemo.com.au).

    Example:
        >>> search_market_rules("What triggers a market price cap event?")
        [{"source_doc": "NER_v205.pdf", "section": "3.14.2",
          "text": "The spot price is capped at the Market Price Cap...",
          "relevance_score": 0.91}, ...]
    """
    if not query or not query.strip():
        raise ValueError("Query must be a non-empty string.")
    if not (1 <= top_k <= 20):
        raise ValueError(f"top_k must be between 1 and 20, got {top_k}.")

    try:
        vs_client = _get_vs_client()
        index = vs_client.get_index(
            endpoint_name=_VS_ENDPOINT,
            index_name=_VS_INDEX,
        )

        results = index.similarity_search(
            query_text=query,
            columns=["chunk_id", "source_doc", "section", "page_number", "text", "last_updated"],
            num_results=top_k,
        )

        # Normalise the Databricks VS response format
        hits = []
        for item in results.get("result", {}).get("data_array", []):
            cols = results.get("manifest", {}).get("columns", [])
            col_names = [c["name"] for c in cols]
            record = dict(zip(col_names, item))
            # The last element in data_array is typically the score
            if "score" in record:
                record["relevance_score"] = round(float(record.pop("score")), 4)
            else:
                record["relevance_score"] = None
            hits.append(record)

        return hits

    except Exception as exc:
        logger.exception("Vector search failed for query: %s", query)
        return [{"error": str(exc), "query": query}]

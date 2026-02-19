"""
agent/evaluation/run_evaluation.py
=====================================
Evaluation harness for the AUS Energy Copilot agent.

Runs all 50 evaluation pairs from eval_dataset.py against the agent,
scores responses using a combination of rule-based checks and an LLM judge,
and writes results to both MLflow and a local JSON report.

Scoring rubric:
  - key_fact_coverage  (0–1.0): Fraction of required key_facts present in response
  - tool_usage         (0–1.0): Whether appropriate tools were called
  - decline_correctness(0–1.0): For OUT_OF_SCOPE: did agent decline? For others: did it not?
  - response_quality   (0–1.0): LLM judge score for accuracy, relevance, and tone
  - overall_score      (0–1.0): Weighted average

Usage:
  python run_evaluation.py [--categories FACTUAL_MARKET FORECAST] [--output report.json]

Prerequisites:
  ANTHROPIC_API_KEY, DATABRICKS_HOST, DATABRICKS_TOKEN env vars set.
  Agent tools connected to a running Databricks SQL warehouse.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import mlflow
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ---------------------------------------------------------------------------
# Import agent and eval dataset
# ---------------------------------------------------------------------------

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))  # project root

from agent.copilot_agent import build_agent_executor
from agent.evaluation.eval_dataset import ALL_EVAL_PAIRS, EvalPair, CATEGORY_COUNTS

# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def score_key_fact_coverage(response: str, key_facts: list[str]) -> float:
    """
    Return the fraction of key_facts that appear (case-insensitive) in response.
    """
    if not key_facts:
        return 1.0
    response_lower = response.lower()
    hits = sum(1 for fact in key_facts if fact.lower() in response_lower)
    return round(hits / len(key_facts), 3)


def score_tool_usage(intermediate_steps: list[dict], category: str) -> float:
    """
    Score whether appropriate tools were used based on category.
    OUT_OF_SCOPE questions should have 0 tool calls.
    All others should have at least 1 tool call.
    """
    num_tools_called = len(intermediate_steps)
    if category == "OUT_OF_SCOPE":
        # For declined queries, no tool calls expected
        return 1.0 if num_tools_called == 0 else 0.5
    else:
        return 1.0 if num_tools_called >= 1 else 0.0


def score_decline_correctness(response: str, should_decline: bool) -> float:
    """
    Score whether the agent correctly handled out-of-scope questions.
    For should_decline=True, check for decline indicators.
    For should_decline=False, check the agent did NOT refuse.
    """
    decline_indicators = [
        "cannot", "can't", "outside", "not able", "not something i",
        "not a question", "don't provide", "unable to", "not within",
        "scope", "financial adviser", "trading advice",
    ]
    response_lower = response.lower()
    has_decline = any(ind in response_lower for ind in decline_indicators)

    if should_decline:
        return 1.0 if has_decline else 0.0
    else:
        # Should NOT have declined a legitimate question
        return 0.0 if has_decline else 1.0


def score_with_llm_judge(
    question: str,
    response: str,
    category: str,
    anthropic_client,
) -> float:
    """
    Use Claude as an LLM judge to score response quality on a 0-4 scale,
    then normalise to 0.0-1.0.

    Criteria:
      4 - Excellent: accurate, complete, properly cites data timestamps, appropriate tone
      3 - Good: mostly accurate, minor omissions, acceptable tone
      2 - Adequate: partially correct or missing key details
      1 - Poor: inaccurate, unhelpful, or inappropriate
      0 - Failure: wrong answer, harmful content, or failed to decline when required
    """
    judge_prompt = f"""You are evaluating an AI assistant response for an Australian energy market platform.

QUESTION: {question}

CATEGORY: {category}

RESPONSE: {response}

Score the response on a scale of 0-4 based on:
- Accuracy of market data and facts
- Completeness (covers all aspects of the question)
- Data citation (response references data timestamps when using live data)
- Appropriate tone (concise, trader-friendly, no made-up data)
- For OUT_OF_SCOPE: did it politely decline without being unhelpful?

Respond with ONLY a JSON object in this exact format:
{{"score": <0-4 integer>, "reason": "<one sentence>"}}"""

    try:
        import anthropic
        message = anthropic_client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=100,
            messages=[{"role": "user", "content": judge_prompt}],
        )
        raw = message.content[0].text.strip()
        # Parse JSON response
        result = json.loads(raw)
        score = int(result.get("score", 2))
        return round(min(max(score, 0), 4) / 4.0, 3)
    except Exception as exc:
        logger.warning("LLM judge failed: %s", exc)
        return 0.5  # Default to neutral score on failure


def compute_overall_score(
    key_fact_coverage: float,
    tool_usage: float,
    decline_correctness: float,
    response_quality: float,
) -> float:
    """
    Weighted average of component scores.
    Weights: key_fact=0.3, tool_usage=0.2, decline=0.2, quality=0.3
    """
    return round(
        0.30 * key_fact_coverage
        + 0.20 * tool_usage
        + 0.20 * decline_correctness
        + 0.30 * response_quality,
        3,
    )


# ---------------------------------------------------------------------------
# Run single eval pair
# ---------------------------------------------------------------------------

def run_eval_pair(
    pair: EvalPair,
    executor,
    anthropic_client,
    timeout_seconds: float = 60.0,
) -> dict:
    """
    Run a single evaluation pair and return a result dict.
    """
    start_time = time.monotonic()

    try:
        result = executor.invoke(
            {"input": pair.question, "chat_history": []},
        )
        elapsed = time.monotonic() - start_time
        response_text = result.get("output", "")
        intermediate_steps = [
            {
                "tool": step[0].tool,
                "tool_input": step[0].tool_input,
                "observation": str(step[1])[:300],
            }
            for step in result.get("intermediate_steps", [])
        ]
        error = None

    except Exception as exc:
        elapsed = time.monotonic() - start_time
        response_text = f"ERROR: {exc}"
        intermediate_steps = []
        error = str(exc)
        logger.warning("Agent failed on question '%s': %s", pair.question[:60], exc)

    # Scoring
    key_fact_score = score_key_fact_coverage(response_text, pair.key_facts)
    tool_score = score_tool_usage(intermediate_steps, pair.category)
    decline_score = score_decline_correctness(response_text, pair.should_decline)
    quality_score = score_with_llm_judge(pair.question, response_text, pair.category, anthropic_client)
    overall = compute_overall_score(key_fact_score, tool_score, decline_score, quality_score)

    return {
        "question": pair.question,
        "category": pair.category,
        "expected_type": pair.expected_type,
        "should_decline": pair.should_decline,
        "notes": pair.notes,
        "response": response_text,
        "intermediate_steps": intermediate_steps,
        "scores": {
            "key_fact_coverage": key_fact_score,
            "tool_usage": tool_score,
            "decline_correctness": decline_score,
            "response_quality": quality_score,
            "overall": overall,
        },
        "elapsed_seconds": round(elapsed, 2),
        "error": error,
    }


# ---------------------------------------------------------------------------
# Evaluation harness
# ---------------------------------------------------------------------------

def run_evaluation(
    categories: Optional[list[str]] = None,
    output_path: Optional[Path] = None,
    mlflow_experiment: Optional[str] = None,
) -> dict:
    """
    Run the full evaluation suite and return an aggregated report dict.

    Args:
        categories:        List of category names to evaluate (None = all).
        output_path:       Path to write JSON report (None = no file output).
        mlflow_experiment: MLflow experiment name for tracking.

    Returns:
        Dict with "summary", "by_category", and "results" keys.
    """
    import anthropic

    # Filter eval pairs by category
    pairs = ALL_EVAL_PAIRS
    if categories:
        pairs = [p for p in pairs if p.category in categories]

    logger.info("Running evaluation on %d pairs (categories: %s)", len(pairs),
                categories or "ALL")

    # Build agent
    executor = build_agent_executor(streaming=False, verbose=False)
    anthropic_client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    # MLflow setup
    if mlflow_experiment:
        mlflow.set_experiment(mlflow_experiment)
    else:
        mlflow.set_experiment("/Users/energy-copilot-team/copilot-evaluation")

    results = []

    with mlflow.start_run(run_name=f"eval-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"):
        mlflow.log_param("num_pairs", len(pairs))
        mlflow.log_param("categories", json.dumps(categories or "ALL"))
        mlflow.log_param("llm_model", "claude-sonnet-4-5")

        for i, pair in enumerate(pairs, 1):
            logger.info("[%d/%d] Category=%s | %s", i, len(pairs),
                        pair.category, pair.question[:70])
            result = run_eval_pair(pair, executor, anthropic_client)
            results.append(result)

            # Log per-pair metrics to MLflow
            mlflow.log_metric(f"pair_{i:02d}_overall", result["scores"]["overall"])

        # Aggregate scores
        all_scores = [r["scores"]["overall"] for r in results]
        avg_overall = round(sum(all_scores) / len(all_scores), 3) if all_scores else 0.0

        by_category: dict = {}
        for r in results:
            cat = r["category"]
            by_category.setdefault(cat, []).append(r["scores"]["overall"])

        category_averages = {
            cat: round(sum(scores) / len(scores), 3)
            for cat, scores in by_category.items()
        }

        # Log aggregate metrics
        mlflow.log_metric("avg_overall_score", avg_overall)
        for cat, score in category_averages.items():
            mlflow.log_metric(f"avg_{cat.lower()}", score)

        pass_threshold = 0.70
        pass_count = sum(1 for s in all_scores if s >= pass_threshold)
        pass_rate = round(pass_count / len(all_scores), 3) if all_scores else 0.0
        mlflow.log_metric("pass_rate_70pct", pass_rate)

        logger.info("=== EVALUATION COMPLETE ===")
        logger.info("Overall average score: %.3f", avg_overall)
        logger.info("Pass rate (>= 0.70): %.1f%% (%d/%d)", pass_rate * 100,
                    pass_count, len(all_scores))
        for cat, score in sorted(category_averages.items()):
            logger.info("  %s: %.3f", cat, score)

        report = {
            "run_at": datetime.now(timezone.utc).isoformat(),
            "num_pairs": len(pairs),
            "summary": {
                "avg_overall_score": avg_overall,
                "pass_rate_70pct": pass_rate,
                "pass_count": pass_count,
                "total_count": len(all_scores),
            },
            "by_category": category_averages,
            "results": results,
        }

        if output_path:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(json.dumps(report, indent=2, default=str))
            logger.info("Report written to: %s", output_path)
            mlflow.log_artifact(str(output_path))

    return report


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run AUS Energy Copilot evaluation")
    parser.add_argument(
        "--categories",
        nargs="+",
        choices=list(CATEGORY_COUNTS.keys()),
        help="Restrict evaluation to specific categories",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent / "results" / "eval_report.json",
        help="Path to write JSON evaluation report",
    )
    parser.add_argument(
        "--experiment",
        type=str,
        default=None,
        help="MLflow experiment name",
    )
    args = parser.parse_args()

    report = run_evaluation(
        categories=args.categories,
        output_path=args.output,
        mlflow_experiment=args.experiment,
    )

    print(f"\nOverall score: {report['summary']['avg_overall_score']:.3f}")
    print(f"Pass rate (>=70%): {report['summary']['pass_rate_70pct']*100:.1f}%")

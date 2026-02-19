"""
agent/evaluation/eval_dataset.py
==================================
60 Q&A evaluation pairs for the AUS Energy Copilot agent.

Each entry is an EvalPair dataclass containing:
  - question:      The user question to pose to the agent
  - category:      Evaluation category
  - expected_type: What kind of response is expected
  - key_facts:     List of facts/phrases that MUST appear in a correct response
  - should_decline: True if the agent should politely refuse to answer
  - notes:         Marker for what makes this question interesting

Categories:
  1. FACTUAL_MARKET   (15) — Live/historical market data queries
  2. FORECAST         (10) — Price/demand/weather forecast queries
  3. EVENT_EXPLANATION (8) — Causal analysis of price events
  4. COMPARATIVE       (7) — Cross-region/cross-period analysis
  5. MARKET_RULES_RAG  (5) — Regulatory and rules queries (uses RAG)
  6. OUT_OF_SCOPE      (5) — Should be politely declined
  7. ANOMALY_EVENTS    (2) — Anomaly detection event queries (new)
  8. MODEL_HEALTH      (2) — ML model registry health queries (new)
  9. FORECAST_ACCURACY (3) — Model evaluation metrics queries (new)
  10. MULTI_TOOL_CHAIN  (1) — Multi-tool chain queries (new)
  11. NEW_OUT_OF_SCOPE  (2) — New out-of-scope: trading advice on models + retrain (new)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class EvalPair:
    question: str
    category: str
    expected_type: str  # "data", "forecast", "explanation", "comparison", "rules", "decline"
    key_facts: List[str] = field(default_factory=list)
    should_decline: bool = False
    notes: str = ""


# ===========================================================================
# Category 1: Factual Market Queries (15)
# ===========================================================================

FACTUAL_MARKET = [
    EvalPair(
        question="What is the current spot price in New South Wales?",
        category="FACTUAL_MARKET",
        expected_type="data",
        key_facts=["NSW1", "AUD/MWh", "settlement_date"],
        notes="Most basic price lookup; must cite timestamp.",
    ),
    EvalPair(
        question="Show me prices across all five NEM regions right now.",
        category="FACTUAL_MARKET",
        expected_type="data",
        key_facts=["NSW1", "QLD1", "VIC1", "SA1", "TAS1", "AUD/MWh"],
        notes="Multi-region latest price query.",
    ),
    EvalPair(
        question="What was the average spot price in South Australia last Tuesday?",
        category="FACTUAL_MARKET",
        expected_type="data",
        key_facts=["SA1", "AUD/MWh", "average"],
        notes="Historical average price — requires date arithmetic.",
    ),
    EvalPair(
        question="How many negative price intervals did Victoria have yesterday?",
        category="FACTUAL_MARKET",
        expected_type="data",
        key_facts=["VIC1", "negative", "intervals"],
        notes="Negative price count — tests price categorisation.",
    ),
    EvalPair(
        question="What is the current flow on the Basslink interconnector?",
        category="FACTUAL_MARKET",
        expected_type="data",
        key_facts=["BASSLINK", "MW", "flow"],
        notes="Interconnector flow query.",
    ),
    EvalPair(
        question="What interconnectors are currently at or near their export limits?",
        category="FACTUAL_MARKET",
        expected_type="data",
        key_facts=["utilisation", "export_limit", "%"],
        notes="Constraint awareness — requires utilisation calculation.",
    ),
    EvalPair(
        question="What is the current generation mix in Queensland?",
        category="FACTUAL_MARKET",
        expected_type="data",
        key_facts=["QLD1", "fuel_type", "MW"],
        notes="Generation mix at latest interval.",
    ),
    EvalPair(
        question="How much wind power is currently being generated across the NEM?",
        category="FACTUAL_MARKET",
        expected_type="data",
        key_facts=["WIND", "MW", "generation"],
        notes="Cross-region wind generation aggregation.",
    ),
    EvalPair(
        question="What was the peak demand in New South Wales last week and when did it occur?",
        category="FACTUAL_MARKET",
        expected_type="data",
        key_facts=["NSW1", "peak", "MW", "time"],
        notes="Historical peak demand with timestamp.",
    ),
    EvalPair(
        question="Show me FCAS RAISE6SEC prices for VIC1 over the last 24 hours.",
        category="FACTUAL_MARKET",
        expected_type="data",
        key_facts=["VIC1", "RAISE6SEC", "AUD/MW"],
        notes="FCAS price query — tests 8-service market knowledge.",
    ),
    EvalPair(
        question="What are the currently active network constraints in South Australia?",
        category="FACTUAL_MARKET",
        expected_type="data",
        key_facts=["SA1", "constraint", "marginal_value"],
        notes="Active constraint lookup.",
    ),
    EvalPair(
        question="How much solar generation was there in Victoria last Sunday between noon and 2pm?",
        category="FACTUAL_MARKET",
        expected_type="data",
        key_facts=["VIC1", "SOLAR", "MW", "GWh"],
        notes="Time-filtered generation by fuel type.",
    ),
    EvalPair(
        question="Give me a market summary for the NEM yesterday.",
        category="FACTUAL_MARKET",
        expected_type="data",
        key_facts=["AUD/MWh", "MW", "generation", "renewables"],
        notes="Daily market summary — comprehensive data aggregation.",
    ),
    EvalPair(
        question="Which region had the highest electricity price in the last trading interval?",
        category="FACTUAL_MARKET",
        expected_type="data",
        key_facts=["AUD/MWh", "region", "settlement_date"],
        notes="Cross-region price comparison at latest interval.",
    ),
    EvalPair(
        question="What was the total renewable generation percentage for the NEM last Monday?",
        category="FACTUAL_MARKET",
        expected_type="data",
        key_facts=["renewable", "%", "GWh", "wind", "solar"],
        notes="Multi-fuel aggregation requiring renewables definition.",
    ),
]


# ===========================================================================
# Category 2: Forecast Queries (10)
# ===========================================================================

FORECAST = [
    EvalPair(
        question="What is the price forecast for New South Wales for the next 4 hours?",
        category="FORECAST",
        expected_type="forecast",
        key_facts=["NSW1", "forecast", "AUD/MWh", "P10", "P90"],
        notes="Short-horizon price forecast; must show confidence interval.",
    ),
    EvalPair(
        question="What is tomorrow's day-ahead price forecast for South Australia?",
        category="FORECAST",
        expected_type="forecast",
        key_facts=["SA1", "24h", "forecast", "AUD/MWh"],
        notes="Day-ahead forecast with appropriate uncertainty caveat.",
    ),
    EvalPair(
        question="What is the demand forecast for Queensland over the next 7 days?",
        category="FORECAST",
        expected_type="forecast",
        key_facts=["QLD1", "MW", "demand", "forecast"],
        notes="Week-ahead demand forecast.",
    ),
    EvalPair(
        question="Is the Victorian price likely to spike in the next 30 minutes?",
        category="FORECAST",
        expected_type="forecast",
        key_facts=["VIC1", "forecast", "caveat", "uncertainty"],
        notes="Spike probability question — must caveat probabilistic nature.",
    ),
    EvalPair(
        question="What temperature and solar forecast do we have for Adelaide tomorrow?",
        category="FORECAST",
        expected_type="forecast",
        key_facts=["SA1", "temp_c", "solar", "forecast"],
        notes="Weather forecast for region — tests BOM integration.",
    ),
    EvalPair(
        question="Forecast the wind generation impact on South Australian prices this afternoon.",
        category="FORECAST",
        expected_type="forecast",
        key_facts=["SA1", "wind", "price", "forecast"],
        notes="Combined weather and price forecast reasoning.",
    ),
    EvalPair(
        question="What is the 1-hour price forecast for all five NEM regions?",
        category="FORECAST",
        expected_type="forecast",
        key_facts=["NSW1", "QLD1", "VIC1", "SA1", "TAS1", "1h", "AUD/MWh"],
        notes="Multi-region 1-hour forecast.",
    ),
    EvalPair(
        question="Will the Basslink flow direction change in the next 4 hours according to forecasts?",
        category="FORECAST",
        expected_type="forecast",
        key_facts=["BASSLINK", "forecast", "caveat"],
        notes="Interconnector flow direction — model should caveat uncertainty.",
    ),
    EvalPair(
        question="What is the peak demand forecast for New South Wales this summer?",
        category="FORECAST",
        expected_type="forecast",
        key_facts=["NSW1", "demand", "peak", "forecast"],
        notes="Seasonal peak demand — may hit 7d horizon limit.",
    ),
    EvalPair(
        question="How accurate have the day-ahead price forecasts been for Victoria this month?",
        category="FORECAST",
        expected_type="forecast",
        key_facts=["VIC1", "accuracy", "forecast", "error"],
        notes="Forecast accuracy — tests model performance metrics.",
    ),
]


# ===========================================================================
# Category 3: Event Explanation Queries (8)
# ===========================================================================

EVENT_EXPLANATION = [
    EvalPair(
        question=(
            "Why did the South Australian spot price hit $14,500/MWh at 3pm last Thursday? "
            "What caused the spike?"
        ),
        category="EVENT_EXPLANATION",
        expected_type="explanation",
        key_facts=["SA1", "spike", "cause", "constraint", "outage"],
        notes="Price spike explanation — core use case for explain_price_event tool.",
    ),
    EvalPair(
        question="Can you explain why there were negative prices in Victoria yesterday morning?",
        category="EVENT_EXPLANATION",
        expected_type="explanation",
        key_facts=["VIC1", "negative", "solar", "renewable", "curtailment"],
        notes="Negative price event — rooftop solar over-generation.",
    ),
    EvalPair(
        question=(
            "There was a price spike in Queensland at 6:30pm yesterday. "
            "What generation came off to cause that?"
        ),
        category="EVENT_EXPLANATION",
        expected_type="explanation",
        key_facts=["QLD1", "outage", "generator", "MW", "spike"],
        notes="Generator trip correlation with price spike.",
    ),
    EvalPair(
        question=(
            "Why was the price difference between South Australia and Victoria so large "
            "at 2pm yesterday?"
        ),
        category="EVENT_EXPLANATION",
        expected_type="explanation",
        key_facts=["SA1", "VIC1", "constraint", "interconnector", "Heywood", "price_difference"],
        notes="Price divergence between regions — interconnector constraint cause.",
    ),
    EvalPair(
        question="The NEM had a market suspension event last month. What happened?",
        category="EVENT_EXPLANATION",
        expected_type="explanation",
        key_facts=["market suspension", "AEMO", "administered price"],
        notes="Market suspension event explanation — tests rules knowledge integration.",
    ),
    EvalPair(
        question=(
            "NSW1 had a price of $17,500/MWh for 20 consecutive intervals last week. "
            "Walk me through what happened."
        ),
        category="EVENT_EXPLANATION",
        expected_type="explanation",
        key_facts=["NSW1", "MPC", "$17,500", "constraint", "demand"],
        notes="Market Price Cap (MPC) extended event explanation.",
    ),
    EvalPair(
        question="Why did wind curtailment increase in South Australia last Sunday afternoon?",
        category="EVENT_EXPLANATION",
        expected_type="explanation",
        key_facts=["SA1", "WIND", "curtailment", "constraint", "Heywood"],
        notes="Renewable curtailment event — network constraint cause.",
    ),
    EvalPair(
        question=(
            "Tasmania prices were disconnected from the mainland yesterday. "
            "Was Basslink offline?"
        ),
        category="EVENT_EXPLANATION",
        expected_type="explanation",
        key_facts=["TAS1", "BASSLINK", "islanding", "price"],
        notes="Basslink outage impact on Tasmanian prices.",
    ),
]


# ===========================================================================
# Category 4: Comparative Analysis Queries (7)
# ===========================================================================

COMPARATIVE = [
    EvalPair(
        question="Which NEM region had the highest average spot price last month?",
        category="COMPARATIVE",
        expected_type="comparison",
        key_facts=["AUD/MWh", "average", "region", "ranking"],
        notes="Cross-region price ranking over a month.",
    ),
    EvalPair(
        question="Compare the renewable energy penetration across all NEM regions yesterday.",
        category="COMPARATIVE",
        expected_type="comparison",
        key_facts=["renewable", "%", "wind", "solar", "NSW1", "QLD1", "VIC1", "SA1", "TAS1"],
        notes="Renewable share comparison — requires generation mix data.",
    ),
    EvalPair(
        question=(
            "How does today's Queensland demand compare to the same day last year?"
        ),
        category="COMPARATIVE",
        expected_type="comparison",
        key_facts=["QLD1", "demand", "MW", "year-over-year"],
        notes="Year-on-year demand comparison.",
    ),
    EvalPair(
        question="Which region had the most FCAS costs last week? Break it down by service.",
        category="COMPARATIVE",
        expected_type="comparison",
        key_facts=["FCAS", "AUD", "region", "service"],
        notes="FCAS cost comparison across regions and services.",
    ),
    EvalPair(
        question=(
            "Compare the price volatility (standard deviation) of all five regions "
            "over the past 7 days."
        ),
        category="COMPARATIVE",
        expected_type="comparison",
        key_facts=["std", "volatility", "AUD/MWh", "NSW1", "QLD1", "VIC1", "SA1", "TAS1"],
        notes="Price volatility metric comparison.",
    ),
    EvalPair(
        question="How has the South Australian average price trended week-over-week this month?",
        category="COMPARATIVE",
        expected_type="comparison",
        key_facts=["SA1", "week", "trend", "AUD/MWh"],
        notes="Weekly price trend for a single region.",
    ),
    EvalPair(
        question=(
            "Compare the number of price spike intervals (above $1000/MWh) between "
            "South Australia and Queensland over the last 30 days."
        ),
        category="COMPARATIVE",
        expected_type="comparison",
        key_facts=["spike", "SA1", "QLD1", "$1000", "intervals", "count"],
        notes="Spike frequency comparison between two volatile regions.",
    ),
]


# ===========================================================================
# Category 5: Market Rules / RAG Queries (5)
# ===========================================================================

MARKET_RULES_RAG = [
    EvalPair(
        question="What is the Market Price Cap in the NEM and how is it determined?",
        category="MARKET_RULES_RAG",
        expected_type="rules",
        key_facts=["Market Price Cap", "$17,500", "AEMC", "NER"],
        notes="MPC definition — must use RAG to cite NER clause.",
    ),
    EvalPair(
        question="Explain how the Causer Pays mechanism for FCAS works.",
        category="MARKET_RULES_RAG",
        expected_type="rules",
        key_facts=["causer pays", "FCAS", "frequency deviation", "factor"],
        notes="Causer pays methodology — AEMO procedures document.",
    ),
    EvalPair(
        question="What is the cumulative price threshold and what happens when it is breached?",
        category="MARKET_RULES_RAG",
        expected_type="rules",
        key_facts=["CPT", "cumulative price threshold", "administered pricing", "AUD"],
        notes="CPT mechanism — NER clause 3.14.",
    ),
    EvalPair(
        question=(
            "Can a generator rebid its offer price to zero within 5 minutes of dispatch? "
            "What are the rules around rebidding?"
        ),
        category="MARKET_RULES_RAG",
        expected_type="rules",
        key_facts=["rebid", "NER", "clause 3.8", "bona fide", "dispatch"],
        notes="Rebidding rules — contentious NER provision.",
    ),
    EvalPair(
        question="What are the FCAS technical requirements for a 6-second raise service provider?",
        category="MARKET_RULES_RAG",
        expected_type="rules",
        key_facts=["RAISE6SEC", "technical requirements", "response time", "MASS"],
        notes="FCAS technical standard — Market Ancillary Service Specification.",
    ),
]


# ===========================================================================
# Category 6: Out-of-Scope Queries (5) — should be declined
# ===========================================================================

OUT_OF_SCOPE = [
    EvalPair(
        question="Should I buy AGL shares given the current electricity prices?",
        category="OUT_OF_SCOPE",
        expected_type="decline",
        key_facts=["cannot", "trading advice", "financial"],
        should_decline=True,
        notes="Investment advice — must decline and explain why.",
    ),
    EvalPair(
        question="What is the weather forecast for the Sydney CBD this weekend for a picnic?",
        category="OUT_OF_SCOPE",
        expected_type="decline",
        key_facts=["outside scope", "energy", "NEM"],
        should_decline=True,
        notes="General weather query unrelated to energy markets.",
    ),
    EvalPair(
        question="Write me a Python script to scrape the AEMO website.",
        category="OUT_OF_SCOPE",
        expected_type="decline",
        key_facts=["outside scope", "cannot"],
        should_decline=True,
        notes="Code generation request unrelated to energy market data.",
    ),
    EvalPair(
        question="What will the NEM spot price be in exactly 3 months?",
        category="OUT_OF_SCOPE",
        expected_type="decline",
        key_facts=["beyond", "horizon", "uncertain", "7 days"],
        should_decline=True,
        notes="Forecast beyond supported horizon — must acknowledge limitation.",
    ),
    EvalPair(
        question="Tell me about political debates around nuclear power in Australia.",
        category="OUT_OF_SCOPE",
        expected_type="decline",
        key_facts=["outside scope", "energy policy", "cannot advise"],
        should_decline=True,
        notes="Political/policy opinion — not a market data question.",
    ),
]


# ===========================================================================
# Category 7: Anomaly Events Queries (3) — testing get_anomaly_events
# ===========================================================================

ANOMALY_EVENTS = [
    EvalPair(
        question="Were there any price spikes in SA1 in the last 48 hours?",
        category="ANOMALY_EVENTS",
        expected_type="data",
        key_facts=["event_type", "price_spike", "SA1"],
        notes="get_anomaly_events with region=SA1, hours_back=48, type filter for price_spike.",
    ),
    EvalPair(
        question="How many anomaly events has the NEM had today?",
        category="ANOMALY_EVENTS",
        expected_type="data",
        key_facts=["total_count", "by_type"],
        notes="get_anomaly_events with region=ALL; must report total_count and breakdown by_type.",
    ),
    EvalPair(
        question=(
            "Show me all negative price and regional separation anomalies in NSW1 "
            "over the past week."
        ),
        category="ANOMALY_EVENTS",
        expected_type="data",
        key_facts=["NSW1", "negative_price", "regional_separation", "events"],
        notes=(
            "get_anomaly_events with region=NSW1, hours_back=168, "
            "event_types=['negative_price','regional_separation']."
        ),
    ),
]


# ===========================================================================
# Category 8: Model Health Queries (2) — testing get_model_health
# ===========================================================================

MODEL_HEALTH = [
    EvalPair(
        question="Are all the ML forecast models healthy and up to date?",
        category="MODEL_HEALTH",
        expected_type="data",
        key_facts=["healthy_count", "total_count", "version"],
        notes="get_model_health with no filter; response must cover all 21 models.",
    ),
    EvalPair(
        question="What version is the NSW1 price forecast model?",
        category="MODEL_HEALTH",
        expected_type="data",
        key_facts=["version", "price_forecast", "NSW1"],
        notes="get_model_health filtered to price_forecast; must surface NSW1 version number.",
    ),
]


# ===========================================================================
# Category 9: Forecast Accuracy Queries (5) — testing get_forecast_accuracy
# ===========================================================================

FORECAST_ACCURACY = [
    EvalPair(
        question="What is the current MAPE for the VIC1 price forecast model?",
        category="FORECAST_ACCURACY",
        expected_type="data",
        key_facts=["mape_pct", "VIC1", "price"],
        notes="get_forecast_accuracy(model_type='price', region='VIC1'); report mape_pct.",
    ),
    EvalPair(
        question="Has the QLD1 solar forecast passed its accuracy targets?",
        category="FORECAST_ACCURACY",
        expected_type="data",
        key_facts=["passed_dod", "QLD1", "solar", "daytime_mape_pct"],
        notes=(
            "get_forecast_accuracy(model_type='solar', region='QLD1'); "
            "must report passed_dod and daytime_mape_pct."
        ),
    ),
    EvalPair(
        question="What is the F1 score for the anomaly detection model?",
        category="FORECAST_ACCURACY",
        expected_type="data",
        key_facts=["f1_score", "anomaly", "precision", "recall"],
        notes=(
            "get_forecast_accuracy(model_type='anomaly', region='NSW1'); "
            "must surface f1_score, precision, recall."
        ),
    ),
    EvalPair(
        question=(
            "Are there any anomaly events in NSW1 right now, and how accurate is "
            "the price model that predicted them?"
        ),
        category="FORECAST_ACCURACY",
        expected_type="data",
        key_facts=["NSW1", "anomaly", "mape_pct", "events"],
        notes=(
            "Multi-tool chain: get_anomaly_events(NSW1) followed by "
            "get_forecast_accuracy(price, NSW1); both tools must be called."
        ),
    ),
    EvalPair(
        question="Can you retrain the wind model to improve its accuracy?",
        category="FORECAST_ACCURACY",
        expected_type="data",
        key_facts=["train.py", "Optuna", "MLflow", "cannot directly retrain"],
        should_decline=False,
        notes=(
            "Should describe the retraining process (train.py, Optuna HPO, MLflow) "
            "but must NOT claim to directly retrain or modify models."
        ),
    ),
]


# ===========================================================================
# Out-of-scope addendum — trading advice about ML models (1 extra)
# ===========================================================================

OUT_OF_SCOPE_ADDENDUM = [
    EvalPair(
        question=(
            "Which ML model has the best accuracy and should I trust its forecasts "
            "to make trades?"
        ),
        category="OUT_OF_SCOPE",
        expected_type="decline",
        key_facts=["no trading advice", "AFSL"],
        should_decline=True,
        notes=(
            "Combined model-health + trading advice request; must decline the "
            "trading-advice portion and cite AFSL/no-financial-advice caveat."
        ),
    ),
]


# ===========================================================================
# Aggregated dataset
# ===========================================================================

ALL_EVAL_PAIRS: list[EvalPair] = (
    FACTUAL_MARKET
    + FORECAST
    + EVENT_EXPLANATION
    + COMPARATIVE
    + MARKET_RULES_RAG
    + OUT_OF_SCOPE
    + ANOMALY_EVENTS
    + MODEL_HEALTH
    + FORECAST_ACCURACY
    + OUT_OF_SCOPE_ADDENDUM
)

assert len(ALL_EVAL_PAIRS) == 60, f"Expected 60 eval pairs, got {len(ALL_EVAL_PAIRS)}"

CATEGORY_COUNTS = {
    "FACTUAL_MARKET": len(FACTUAL_MARKET),
    "FORECAST": len(FORECAST),
    "EVENT_EXPLANATION": len(EVENT_EXPLANATION),
    "COMPARATIVE": len(COMPARATIVE),
    "MARKET_RULES_RAG": len(MARKET_RULES_RAG),
    "OUT_OF_SCOPE": len(OUT_OF_SCOPE) + len(OUT_OF_SCOPE_ADDENDUM),
    "ANOMALY_EVENTS": len(ANOMALY_EVENTS),
    "MODEL_HEALTH": len(MODEL_HEALTH),
    "FORECAST_ACCURACY": len(FORECAST_ACCURACY),
}


if __name__ == "__main__":
    print(f"Total eval pairs: {len(ALL_EVAL_PAIRS)}")
    for cat, count in CATEGORY_COUNTS.items():
        print(f"  {cat}: {count}")

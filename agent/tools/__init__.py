"""
agent/tools/__init__.py
Exports all tools for use by the copilot agent.
"""
from agent.tools.market_data_tools import (
    get_latest_prices,
    get_price_history,
    get_generation_mix,
    get_interconnector_flows,
    get_active_constraints,
    get_fcas_prices,
)
from agent.tools.forecast_tools import (
    get_price_forecast,
    get_demand_forecast,
    get_weather_forecast,
)
from agent.tools.analysis_tools import (
    explain_price_event,
    compare_regions,
    get_market_summary,
    get_anomaly_events,      # new
    get_model_health,        # new
    get_forecast_accuracy,   # new
)
from agent.tools.rag_tools import search_market_rules

ALL_TOOLS = [
    get_latest_prices,
    get_price_history,
    get_generation_mix,
    get_interconnector_flows,
    get_active_constraints,
    get_fcas_prices,
    get_price_forecast,
    get_demand_forecast,
    get_weather_forecast,
    explain_price_event,
    compare_regions,
    get_market_summary,
    get_anomaly_events,
    get_model_health,
    get_forecast_accuracy,
    search_market_rules,
]

__all__ = [t.name for t in ALL_TOOLS] + ["ALL_TOOLS"]

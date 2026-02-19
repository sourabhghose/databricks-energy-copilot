# Product Requirements Document (PRD)
# AUS Energy Copilot — Phase 1: Market Intelligence & AI Assistant

**Version:** 1.0
**Date:** 19 February 2026
**Author:** Sourabh Ghose
**Status:** Draft

---

## 1. Executive Summary

AUS Energy Copilot is an AI-powered market intelligence and trading assistant for the Australian National Electricity Market (NEM). Phase 1 delivers a real-time market analytics platform (comparable to NemSight) combined with a conversational AI copilot — built entirely on Databricks-native technologies.

The product ingests open-source data from AEMO/NEMWEB, OpenElectricity, and Bureau of Meteorology weather feeds, processes it through a medallion lakehouse architecture, and serves it through three interfaces: interactive dashboards, natural language Genie analytics, and an AI agent copilot.

**Target users:** Energy traders, portfolio analysts, market analysts, and trading desk managers operating in the Australian NEM.

---

## 2. Problem Statement

### Current Pain Points

1. **Fragmented market data**: Traders juggle multiple tools (NEMWEB portal, spreadsheets, NemSight, custom scripts) to piece together a market view. There is no unified platform combining prices, generation, weather, and constraints.

2. **Reactive, not predictive**: Existing tools like NemSight show what *happened*. Traders need to know what *will* happen — price spikes, demand surges, renewable generation shortfalls — before they occur.

3. **Manual analysis bottleneck**: Understanding *why* a price spiked requires manually correlating outages, weather events, interconnector constraints, and demand patterns across multiple data sources. This takes experienced analysts 30-60 minutes per event.

4. **No natural language access**: Non-technical stakeholders (risk managers, executives) cannot self-serve market analytics without requesting analyst support.

5. **High tool costs**: Commercial solutions like NemSight + EOT can cost $50K-$200K+ per year in licensing. An open-data, Databricks-native solution reduces this significantly for teams already on the platform.

### Opportunity

Build an AI-first market intelligence platform that:
- Unifies all NEM market data in a governed lakehouse
- Provides predictive intelligence (price/demand/generation forecasts)
- Enables natural language interaction with market data
- Delivers proactive AI-driven insights and alerts
- Runs entirely on Databricks, leveraging existing platform investment

---

## 3. Target Users & Personas

### P1: Energy Trader (Primary)
- **Goal**: Make profitable trading decisions quickly
- **Needs**: Real-time prices, generation mix, interconnector flows, price forecasts, competitor bidstack analysis, alerts on price spikes
- **AI Copilot Use**: "What's the SA spot price forecast for 4-6pm today?", "Why did QLD price spike at 2pm?", "Show me the bidstack changes for Bayswater in the last hour"

### P2: Market Analyst (Primary)
- **Goal**: Produce market reports and identify trends
- **Needs**: Historical analysis, cross-regional comparisons, seasonal patterns, renewable penetration trends, demand correlations
- **AI Copilot Use**: "Compare average peak prices across all regions for Q4 2025 vs Q4 2024", "What's the correlation between wind generation and SA prices?"

### P3: Risk / Portfolio Manager (Secondary)
- **Goal**: Monitor portfolio exposure to market movements
- **Needs**: Price volatility metrics, regional risk profiles, interconnector congestion patterns, demand forecast accuracy
- **AI Copilot Use**: "What was the volatility in VIC prices this week?", "Summarize interconnector congestion events in the last month"

### P4: Trading Desk Manager / Executive (Secondary)
- **Goal**: High-level market overview without technical complexity
- **Needs**: Daily market summaries, key metrics dashboard, trend alerts
- **AI Copilot Use**: "Give me a morning market brief", "What were the key market events yesterday?"

---

## 4. Product Scope — Phase 1

### 4.1 In Scope

#### Data Platform (Foundation Layer)
- [x] Ingest AEMO NEMWEB public data (dispatch, trading, generation, interconnectors, constraints)
- [x] Ingest OpenElectricity API data (curated generation, demand, price, emissions)
- [x] Ingest Open-Meteo / BOM weather data (temperature, wind, solar radiation, precipitation)
- [x] Ingest APVI rooftop solar estimates
- [x] Medallion architecture: Bronze (raw) → Silver (cleaned/joined) → Gold (analytics-ready)
- [x] Unity Catalog governance with full lineage
- [x] Incremental/streaming data pipelines via Lakeflow SDP

#### Real-Time Market Dashboard (NemSight Alternative)
- [x] Live regional spot prices (NSW, QLD, VIC, SA, TAS) — 5-minute refresh
- [x] Generation mix by fuel type per region (coal, gas, hydro, wind, solar, battery)
- [x] Interconnector flows and limits (directional MW, congestion indicators)
- [x] Demand vs supply balance per region
- [x] Price history charts (intraday, daily, weekly, monthly)
- [x] Weather overlay (temperature, wind speed, solar irradiance by NEM region)
- [x] Configurable price/demand threshold alerts

#### AI/ML Forecasting Models
- [x] Regional spot price forecasting (1-hour, 4-hour, 24-hour ahead)
- [x] Regional demand forecasting (1-hour, 4-hour, 24-hour ahead)
- [x] Wind generation forecasting (per region)
- [x] Solar generation forecasting (utility + rooftop, per region)
- [x] Model performance tracking and versioning via MLflow

#### Genie Spaces (Natural Language Analytics)
- [x] NEM Prices & Demand Genie space
- [x] Generation & Fuel Mix Genie space
- [x] Interconnectors & Constraints Genie space
- [x] Sample questions and business glossary for each space

#### AI Copilot Agent
- [x] Conversational chat interface (Streamlit-based)
- [x] Market Q&A using RAG over AEMO documentation + market rules
- [x] Price spike / anomaly explanation (causal analysis)
- [x] AI-generated daily/hourly market summaries
- [x] Forecast retrieval ("What's the price forecast for SA?")
- [x] Tool calling: query live data, invoke forecast models, search historical patterns
- [x] Proactive alerts: predicted price spikes, demand surges, renewable shortfalls

#### Frontend Application
- [x] Databricks App (Streamlit) with tabbed layout
- [x] Tabs: Dashboard, Forecasts, Copilot Chat, Genie Analytics, Alerts
- [x] Responsive web design (desktop + tablet)
- [x] OAuth authentication via Databricks

### 4.2 Out of Scope (Phase 2+)
- Deal capture and portfolio management (ETRM)
- Bid preparation and AEMO submission
- Settlement processing and reconciliation
- Forward curve construction and mark-to-market
- Risk analytics (VaR, Greeks, sensitivity)
- PPA valuation
- Gas market data (STTM, DWGM)
- WEM (Western Australian) market data
- Native mobile application
- Multi-tenancy / white-labeling

---

## 5. Data Architecture

### 5.1 Data Sources

| Source | Data | Frequency | Access Method | License |
|--------|------|-----------|---------------|---------|
| **NEMWEB** | Dispatch prices, generation, interconnectors, constraints, bids | 5-min | HTTP file download (CSV ZIP) | Public / Free |
| **NEMWEB** | Trading interval summaries | 30-min | HTTP file download (CSV ZIP) | Public / Free |
| **NEMWEB** | Pre-dispatch forecasts (PREDISPATCH, P5MIN, STPASA) | 5-min / 30-min | HTTP file download (CSV ZIP) | Public / Free |
| **OpenElectricity** | Curated generation, demand, price, emissions, capacity | 5-min | REST API (JSON) | CC BY 4.0 / Free API key |
| **Open-Meteo** | Temperature, wind, solar radiation, humidity, precipitation | Hourly | REST API (JSON) | Free / No key |
| **APVI** | Rooftop solar generation by state/postcode | 30-min | REST API / CSV | Free |

### 5.2 Medallion Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        GOLD LAYER                                │
│  Analytics-ready, aggregated, feature-engineered                 │
│                                                                  │
│  gold.nem_prices_5min          - Regional prices, 5-min         │
│  gold.nem_prices_30min         - Trading interval prices         │
│  gold.nem_demand_actuals       - Actual demand by region         │
│  gold.nem_generation_by_fuel   - Gen by fuel type & region       │
│  gold.nem_generation_by_unit   - Gen by individual DUID          │
│  gold.nem_interconnectors      - Flows, limits, congestion       │
│  gold.nem_constraints_active   - Active constraint sets          │
│  gold.nem_bidstacks            - Aggregated bidstack by region   │
│  gold.weather_nem_regions      - Weather mapped to NEM regions   │
│  gold.solar_rooftop            - Rooftop PV by region            │
│  gold.price_forecasts          - ML forecast outputs             │
│  gold.demand_forecasts         - ML forecast outputs             │
│  gold.generation_forecasts     - ML forecast outputs             │
│  gold.market_events            - Detected anomalies & events     │
│  gold.daily_market_summary     - AI-generated daily summaries    │
├──────────────────────────────────────────────────────────────────┤
│                       SILVER LAYER                               │
│  Cleaned, validated, joined, SCD Type 2 where applicable        │
│                                                                  │
│  silver.dispatch_prices        - Cleaned dispatch prices         │
│  silver.dispatch_generation    - Cleaned generation data         │
│  silver.dispatch_demand        - Cleaned demand data             │
│  silver.dispatch_interconnect  - Cleaned interconnector data     │
│  silver.trading_intervals      - 30-min trading data             │
│  silver.predispatch_prices     - Pre-dispatch price forecasts    │
│  silver.predispatch_demand     - Pre-dispatch demand forecasts   │
│  silver.generator_registry     - Generator metadata (DUID, fuel) │
│  silver.constraint_sets        - Constraint equations & RHS      │
│  silver.bidstacks_raw          - Individual generator bids       │
│  silver.weather_observations   - Cleaned weather time series     │
│  silver.weather_forecasts      - Forward weather forecasts       │
│  silver.rooftop_solar          - APVI rooftop PV data            │
├──────────────────────────────────────────────────────────────────┤
│                       BRONZE LAYER                               │
│  Raw ingestion, append-only, schema-on-read                     │
│                                                                  │
│  bronze.nemweb_dispatch_is     - Raw DISPATCHIS files            │
│  bronze.nemweb_dispatch_price  - Raw DISPATCHPRICE files         │
│  bronze.nemweb_dispatch_gen    - Raw DISPATCH_UNIT_SCADA         │
│  bronze.nemweb_dispatch_inter  - Raw DISPATCHINTERCONNECTORRES   │
│  bronze.nemweb_trading_is      - Raw TRADINGIS files             │
│  bronze.nemweb_predispatch     - Raw PREDISPATCH files           │
│  bronze.nemweb_bids            - Raw BIDPEROFFER files           │
│  bronze.nemweb_constraints     - Raw constraint files            │
│  bronze.openelec_raw           - Raw OpenElectricity API resp.   │
│  bronze.weather_raw            - Raw Open-Meteo API responses    │
│  bronze.apvi_raw               - Raw APVI solar data             │
└──────────────────────────────────────────────────────────────────┘
```

### 5.3 Data Freshness Targets

| Data Type | Target Latency | Pipeline Mode |
|-----------|---------------|---------------|
| Dispatch prices (5-min) | < 2 minutes from AEMO publish | Streaming (SDP) |
| Generation data (5-min) | < 2 minutes from AEMO publish | Streaming (SDP) |
| Trading intervals (30-min) | < 5 minutes | Triggered batch |
| Pre-dispatch forecasts | < 5 minutes | Triggered batch |
| Weather data (hourly) | < 15 minutes | Scheduled batch |
| Rooftop solar (30-min) | < 15 minutes | Scheduled batch |
| ML forecasts | < 10 minutes after new dispatch | Triggered batch |
| Daily market summary | By 06:00 AEST daily | Scheduled batch |

---

## 6. AI/ML Models Specification

### 6.1 Regional Spot Price Forecasting

| Attribute | Detail |
|-----------|--------|
| **Objective** | Predict regional reference price (RRP) for each NEM region |
| **Horizons** | 1-hour, 4-hour, 24-hour ahead (rolling) |
| **Granularity** | 5-minute dispatch intervals, aggregated to 30-min for longer horizons |
| **Features** | Historical prices, demand, generation by fuel, interconnector flows, weather (temp, wind, solar rad), calendar (hour, day-of-week, holiday, season), AEMO pre-dispatch forecasts |
| **Algorithms** | Ensemble: LightGBM (primary) + temporal fusion transformer (experimental) |
| **Target Metrics** | MAE < $15/MWh (1-hr), MAE < $25/MWh (4-hr), MAE < $40/MWh (24-hr) |
| **Training** | Rolling window, retrained weekly on latest 12 months |
| **Serving** | Batch inference on each new dispatch interval; results to `gold.price_forecasts` |

### 6.2 Regional Demand Forecasting

| Attribute | Detail |
|-----------|--------|
| **Objective** | Predict total demand (MW) per NEM region |
| **Horizons** | 1-hour, 4-hour, 24-hour ahead |
| **Features** | Historical demand, temperature forecast, solar radiation, calendar features, rooftop solar estimate, AEMO pre-dispatch demand |
| **Algorithms** | LightGBM + linear regression baseline |
| **Target Metrics** | MAPE < 3% (1-hr), MAPE < 5% (24-hr) |

### 6.3 Wind Generation Forecasting

| Attribute | Detail |
|-----------|--------|
| **Objective** | Predict aggregate wind generation (MW) per region |
| **Horizons** | 1-hour, 4-hour, 24-hour ahead |
| **Features** | Wind speed/direction at hub height, historical wind generation, installed capacity, seasonal patterns |
| **Algorithms** | Gradient boosted trees + quantile regression for confidence intervals |
| **Target Metrics** | MAPE < 15% (1-hr), MAPE < 25% (24-hr) |

### 6.4 Solar Generation Forecasting

| Attribute | Detail |
|-----------|--------|
| **Objective** | Predict aggregate solar generation (utility + rooftop) per region |
| **Horizons** | 1-hour, 4-hour, next-day |
| **Features** | Solar irradiance forecast, cloud cover, historical solar generation, installed capacity, rooftop PV estimates |
| **Algorithms** | Gradient boosted trees + clear-sky model baseline |
| **Target Metrics** | MAPE < 10% (1-hr), MAPE < 20% (next-day) |

### 6.5 Anomaly / Event Detection

| Attribute | Detail |
|-----------|--------|
| **Objective** | Detect and classify unusual market events (price spikes, demand surges, generation trips, constraint binding) |
| **Method** | Statistical thresholds + isolation forest + rule-based classification |
| **Output** | Event records in `gold.market_events` with type, severity, affected region, probable cause |

---

## 7. AI Copilot Agent Specification

### 7.1 Architecture

```
User (Streamlit Chat UI)
        │
        ▼
┌─────────────────────────────────┐
│     Mosaic AI Agent             │
│     (Compound AI System)        │
│                                 │
│  ┌───────────┐ ┌─────────────┐  │
│  │ LLM       │ │ Tool Router │  │
│  │ (System   │ │             │  │
│  │  Prompt)  │ │ ┌─────────┐ │  │
│  │           │ │ │ UC Func │ │  │
│  │ Context:  │ │ │ Tools   │ │  │
│  │ - NEM     │ │ │         │ │  │
│  │   domain  │ │ └─────────┘ │  │
│  │ - Trading │ │             │  │
│  │   terms   │ │ ┌─────────┐ │  │
│  │ - AEMO    │ │ │ Vector  │ │  │
│  │   rules   │ │ │ Search  │ │  │
│  └───────────┘ │ │ (RAG)   │ │  │
│                │ └─────────┘ │  │
│                └─────────────┘  │
└─────────────────────────────────┘
        │
        ▼ Tool Calls
┌──────────────────────────────────────────────────────┐
│                Unity Catalog Functions                │
│                                                      │
│  get_latest_prices(region)                           │
│  get_price_forecast(region, horizon)                 │
│  get_demand_forecast(region, horizon)                │
│  get_generation_mix(region, start, end)              │
│  get_interconnector_flows(interconnector_id)          │
│  get_price_history(region, start, end, interval)     │
│  get_weather_forecast(region, hours_ahead)            │
│  explain_price_event(region, timestamp)               │
│  get_market_summary(date)                            │
│  search_market_rules(query)           [Vector Search] │
│  get_active_constraints(region)                       │
│  get_generator_info(duid)                            │
│  compare_regions(metric, start, end)                 │
└──────────────────────────────────────────────────────┘
```

### 7.2 Copilot Capabilities

| Capability | Description | Tools Used |
|------------|-------------|------------|
| **Market Q&A** | Answer factual questions about current and historical market state | `get_latest_prices`, `get_price_history`, `get_generation_mix`, `get_interconnector_flows` |
| **Forecasting** | Retrieve and explain price/demand/generation forecasts | `get_price_forecast`, `get_demand_forecast`, `get_weather_forecast` |
| **Event Explanation** | Explain why a price spike or unusual event occurred | `explain_price_event`, `get_active_constraints`, `get_generation_mix`, `get_weather_forecast` |
| **Market Summaries** | Generate natural language summaries of market conditions | `get_market_summary`, `get_latest_prices`, `get_generation_mix` |
| **Comparative Analysis** | Compare metrics across regions or time periods | `compare_regions`, `get_price_history` |
| **Rule/Regulation Lookup** | Answer questions about NEM rules, AEMO procedures | `search_market_rules` (RAG) |
| **Proactive Alerts** | Surface predicted events before they happen | `get_price_forecast` + anomaly thresholds |

### 7.3 Example Conversations

**Trader at 2pm:**
> **User**: "What's the SA spot price forecast for the next 4 hours?"
>
> **Copilot**: "The current SA spot price is $87/MWh. My forecast for the next 4 hours:
> - 2:30pm: $92/MWh (↑ rising demand, wind dropping)
> - 3:00pm: $105/MWh (↑ afternoon peak approaching)
> - 3:30pm: $118/MWh (↑ peak demand, low wind)
> - 4:00pm: $135/MWh (↑ evening ramp, solar declining)
> - 4:30pm: $142/MWh (↑ peak — solar offline, wind still low)
> - 5:00pm: $128/MWh (↓ demand easing)
>
> Key drivers: BOM forecasts wind speed dropping to 8 km/h across SA wind farms by 3pm. Temperature forecast of 38°C in Adelaide driving aircon load. Heywood interconnector currently at 85% capacity."

**Analyst at 9am:**
> **User**: "Give me a morning market brief"
>
> **Copilot**: "NEM Morning Brief — 19 Feb 2026:
>
> **Overnight**: Prices were subdued across all regions. NSW averaged $52/MWh, VIC $48/MWh, QLD $55/MWh, SA $61/MWh, TAS $44/MWh.
>
> **Key events**: Loy Yang A Unit 2 returned from outage at 04:00 AEST (500MW). SA wind generation averaged 1,200MW overnight (65% capacity factor).
>
> **Today's outlook**: Hot day forecast — Adelaide 39°C, Sydney 34°C. Expect afternoon price spikes in SA (forecast peak $180/MWh at 5pm) and NSW ($120/MWh). QNI interconnector maintenance reducing capacity by 200MW until 6pm.
>
> **Watch items**: SA evening peak risk — low wind forecast + high temp = potential $300+ price if Heywood congests."

---

## 8. Frontend Application Specification

### 8.1 Technology

- **Framework**: Streamlit (deployed via Databricks Apps)
- **Charting**: Plotly (interactive), Altair (declarative)
- **Maps**: Folium / Plotly mapbox for geographic overlays
- **Authentication**: Databricks OAuth (SSO)
- **State Management**: Streamlit session state + Lakebase for persistent preferences

### 8.2 Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  🔋 AUS Energy Copilot           [Region: All ▼]  [👤 User] │
├──────┬──────┬──────────┬──────────┬────────┬────────────────┤
│ Home │ Live │ Forecasts│ Copilot  │ Genie  │ Alerts         │
│      │Market│          │  Chat    │Analytics│               │
├──────┴──────┴──────────┴──────────┴────────┴────────────────┤
│                                                             │
│                    [Active Tab Content]                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Tab Specifications

#### Tab 1: Home (Executive Overview)
- 5-region price ticker bar (live, color-coded: green < $100, amber $100-$300, red > $300)
- NEM-wide demand vs available capacity gauge
- Today's AI market brief (auto-generated)
- Key alerts / predicted events
- 24-hour price sparklines per region

#### Tab 2: Live Market
- **Prices panel**: 5-minute regional price chart (multi-line, interactive zoom)
- **Generation panel**: Stacked area chart by fuel type per selected region
- **Interconnectors panel**: Directional flow diagram with congestion indicators
- **Demand panel**: Actual vs forecast demand overlay
- Filters: region selector, time range, fuel type

#### Tab 3: Forecasts
- Price forecast chart: actual vs predicted with confidence bands
- Demand forecast chart: actual vs predicted
- Wind/solar generation forecast vs actual
- Model accuracy metrics (MAE, MAPE) over rolling windows
- Forecast horizon selector (1hr, 4hr, 24hr)

#### Tab 4: Copilot Chat
- Full-screen chat interface
- Message history (session-persistent)
- Inline charts/tables rendered from agent tool responses
- Suggested questions sidebar
- "Morning Brief" quick-action button

#### Tab 5: Genie Analytics
- Embedded Genie space selector (Prices, Generation, Interconnectors)
- Natural language query input
- Results rendered as tables and charts
- Query history

#### Tab 6: Alerts
- Active alerts table (triggered, acknowledged, resolved)
- Alert configuration: metric, region, threshold, notification channel
- Alert history with linked market events
- Predicted alert section (AI-driven "likely to trigger in next 4 hours")

---

## 9. Genie Spaces Design

### Space 1: NEM Prices & Demand

**Tables/Views**: `gold.nem_prices_5min`, `gold.nem_prices_30min`, `gold.nem_demand_actuals`, `gold.price_forecasts`, `gold.demand_forecasts`

**Sample Questions**:
- "What was the average price in SA last week?"
- "Show me the top 10 highest price intervals in VIC this month"
- "Compare peak vs off-peak prices across all regions for January 2026"
- "What is the 95th percentile price in QLD for the past 90 days?"
- "Show daily average demand in NSW for the past 30 days"

**Glossary**: RRP (Regional Reference Price), Dispatch Interval, Trading Interval, Peak (7am-10pm weekdays), Off-Peak, Super-Peak (4pm-8pm), Baseload

### Space 2: Generation & Fuel Mix

**Tables/Views**: `gold.nem_generation_by_fuel`, `gold.nem_generation_by_unit`, `gold.solar_rooftop`, `gold.generation_forecasts`

**Sample Questions**:
- "What percentage of QLD generation came from renewables this week?"
- "Show me the top 10 generators by output in NSW today"
- "How much rooftop solar was generated in SA yesterday?"
- "Compare coal vs gas generation in VIC over the past year"
- "What is the average wind capacity factor in SA by month?"

**Glossary**: DUID (Dispatchable Unit Identifier), Capacity Factor, Nameplate Capacity, Rooftop PV, Semi-Scheduled, Scheduled

### Space 3: Interconnectors & Constraints

**Tables/Views**: `gold.nem_interconnectors`, `gold.nem_constraints_active`, `gold.market_events`

**Sample Questions**:
- "How often was Heywood interconnector congested in the past month?"
- "Show average flows on QNI by hour of day"
- "What constraints were binding in SA during the price spike on Feb 15?"
- "Compare interconnector utilization across all NEM interconnectors this quarter"

**Glossary**: Interconnector (VIC1-NSW1, N-Q-MNSP1, V-SA, T-V-MNSP1, V-S-MNSP1), Binding Constraint, RHS (Right Hand Side), Marginal Value

---

## 10. Non-Functional Requirements

### 10.1 Performance
- Dashboard page load: < 3 seconds
- Chart data refresh: < 5 seconds for 5-min data
- Copilot response time: < 15 seconds for simple queries, < 30 seconds for complex multi-tool queries
- Genie query response: < 20 seconds
- Forecast model inference: < 60 seconds per region per horizon

### 10.2 Reliability
- Data pipeline SLA: 99.5% uptime
- Dashboard availability: 99.5% (Databricks Apps SLA)
- Data freshness: alert if dispatch data > 10 minutes stale
- Model monitoring: alert if forecast MAE degrades > 20% from baseline

### 10.3 Security & Governance
- All data governed via Unity Catalog
- Row/column-level security where needed
- OAuth SSO via Databricks identity
- Audit logging for all copilot queries
- No PII in market data (public AEMO data)

### 10.4 Scalability
- Support 5+ years of historical data (~50M+ dispatch intervals)
- Support 20+ concurrent dashboard users
- Forecast models scale to all 5 regions x 3 horizons = 15 model variants

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Data freshness | < 2 min from AEMO publish to dashboard | Pipeline monitoring |
| Price forecast accuracy (1-hr MAE) | < $15/MWh | MLflow model metrics |
| Demand forecast accuracy (1-hr MAPE) | < 3% | MLflow model metrics |
| Copilot query resolution rate | > 80% answered without human escalation | Agent evaluation |
| Daily active users | 10+ within first month of launch | App analytics |
| Genie query accuracy | > 85% correct SQL generation | Genie benchmarks |
| Dashboard load time | < 3 seconds | App performance monitoring |
| Time to insight (price spike explanation) | < 30 seconds (vs 30-60 min manual) | User feedback |

---

## 12. Dependencies & Risks

### Dependencies
| Dependency | Risk Level | Mitigation |
|------------|-----------|------------|
| AEMO NEMWEB data availability | Low | Public, stable for 10+ years; fallback to OpenElectricity API |
| OpenElectricity API uptime | Medium | Cache data in Delta Lake; not sole source for any critical data |
| Open-Meteo / BOM weather API | Low | Free, reliable; cache forecasts; fallback to persistence model |
| Databricks Apps GA availability | Low | GA since 2025; Streamlit is stable framework |
| Lakebase availability in ap-southeast-2 | Medium | Available; fallback to external Postgres if needed |
| Genie API (public preview) | Medium | Can launch without embedding; use Genie spaces directly |
| Mosaic AI Agent Framework | Low | GA; well-documented; MLflow-based |

### Risks
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| AEMO changes NEMWEB file format | High | Low | Schema validation in Bronze layer; alerts on schema drift |
| Price forecast accuracy insufficient | Medium | Medium | Ensemble models; benchmark against AEMO pre-dispatch; iterate |
| Copilot hallucination on market data | High | Medium | Tool-calling architecture (grounded); evaluation suite; guardrails |
| Data volume exceeds cost expectations | Medium | Low | Incremental processing; partitioning; lifecycle policies |
| User adoption below target | Medium | Medium | Co-design with traders; iterative UX feedback; training |

---

## 13. Glossary

| Term | Definition |
|------|-----------|
| **NEM** | National Electricity Market — covers QLD, NSW, VIC, SA, TAS |
| **AEMO** | Australian Energy Market Operator |
| **NEMWEB** | AEMO's public data portal for NEM market data |
| **RRP** | Regional Reference Price — the spot electricity price in $/MWh |
| **Dispatch Interval** | 5-minute interval for physical dispatch and pricing |
| **Trading Interval** | 30-minute interval for financial settlement |
| **DUID** | Dispatchable Unit Identifier — unique ID for each generator/load |
| **FCAS** | Frequency Control Ancillary Services |
| **Interconnector** | Transmission link between NEM regions |
| **Bidstack** | Ordered set of price-quantity bids from generators |
| **SDP** | Structured Data Processing (Lakeflow Spark Declarative Pipelines) |
| **PPA** | Power Purchase Agreement |
| **MAE** | Mean Absolute Error |
| **MAPE** | Mean Absolute Percentage Error |

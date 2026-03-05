from __future__ import annotations
import random as _r
from datetime import datetime as _dt
from fastapi import APIRouter, Query
from .shared import _query_gold, _CATALOG, logger

router = APIRouter()

# =========================================================================
# BATCH: Forecasting endpoints (9)
# =========================================================================

@router.get("/api/nem-demand-forecasting-accuracy/dashboard")
def ndfa_dashboard():
    _r.seed(7001)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    horizons = ["1h", "4h", "12h", "24h", "48h", "168h"]
    models = ["XGBoost", "LSTM", "Prophet", "Ensemble", "Ridge", "GBM"]
    fa = []
    for reg in regions:
        for h in horizons:
            fa.append({"region": reg, "horizon": h, "mape_pct": round(_r.uniform(1.5, 12), 2), "rmse_mw": round(_r.uniform(50, 400), 1), "bias_mw": round(_r.uniform(-80, 80), 1), "r_squared": round(_r.uniform(0.85, 0.99), 3), "sample_size": _r.randint(500, 5000)})
    hp = [{"region": reg, "hour": h, "avg_error_pct": round(_r.uniform(1, 8), 2), "peak_error_pct": round(_r.uniform(5, 25), 2)} for reg in regions for h in range(0, 24, 3)]
    mc = [{"model": m, "region": reg, "mape_1h": round(_r.uniform(1, 5), 2), "mape_24h": round(_r.uniform(3, 12), 2), "training_time_s": round(_r.uniform(10, 600), 1)} for m in models for reg in regions[:3]]
    ee = [{"event_type": t, "region": reg, "count": _r.randint(5, 50), "avg_error_pct": round(_r.uniform(8, 35), 2), "max_error_pct": round(_r.uniform(20, 80), 2)} for t in ["Heatwave", "Cold Snap", "Storm", "Price Spike"] for reg in regions[:3]]
    fi = [{"feature": f, "importance": round(_r.uniform(0.02, 0.25), 3)} for f in ["Temperature", "Time of Day", "Day of Week", "Solar Irradiance", "Wind Speed", "Lagged Demand", "Holiday Flag", "Cloud Cover"]]
    return {"forecast_accuracy": fa, "hourly_profiles": hp, "model_comparison": mc, "extreme_events": ee, "feature_importance": fi, "summary": {"best_model": "Ensemble", "avg_mape_1h": 2.8, "avg_mape_24h": 6.1, "regions_covered": 5}}


@router.get("/api/electricity-demand-forecasting-ml-x/dashboard")
def edfmx_dashboard():
    _r.seed(7002)
    models_list = ["XGBoost-v3", "LSTM-Attention", "Prophet-Tuned", "CatBoost-v2", "LightGBM", "Transformer-S"]
    models = [{"model_id": f"MDL-{i+1:03d}", "model_name": m, "model_type": m.split("-")[0], "version": f"v{_r.randint(1,5)}.{_r.randint(0,9)}", "mape_pct": round(_r.uniform(1.5, 8), 2), "rmse_mw": round(_r.uniform(60, 350), 1), "status": _r.choice(["PRODUCTION", "STAGING", "RETIRED"]), "last_trained": "2025-12-15"} for i, m in enumerate(models_list)]
    fi = [{"feature": f, "importance": round(_r.uniform(0.02, 0.3), 3), "model": _r.choice(models_list)} for f in ["Temperature", "Solar", "Wind", "Lagged Demand", "Price Signal", "Calendar", "Cloud Cover", "Humidity"]]
    ar = [{"model": m, "region": reg, "horizon_h": h, "mape_pct": round(_r.uniform(1, 10), 2), "rmse_mw": round(_r.uniform(40, 300), 1)} for m in models_list[:3] for reg in ["NSW1", "QLD1", "VIC1"] for h in [1, 4, 24]]
    sb = [{"date": f"2025-{_r.randint(1,12):02d}-{_r.randint(1,28):02d}", "region": _r.choice(["NSW1", "QLD1", "VIC1"]), "break_type": _r.choice(["Level Shift", "Trend Change", "Variance Change"]), "magnitude_pct": round(_r.uniform(5, 25), 1), "detected_by": _r.choice(["CUSUM", "Chow Test"])} for _ in range(8)]
    dm = [{"model": m, "drift_score": round(_r.uniform(0, 1), 3), "drift_detected": _r.choice([True, False]), "last_check": "2025-12-20"} for m in models_list]
    fc = [{"region": reg, "timestamp": f"2025-12-20T{h:02d}:00:00Z", "forecast_mw": round(_r.uniform(5000, 14000), 0), "actual_mw": round(_r.uniform(5000, 14000), 0)} for reg in ["NSW1", "QLD1", "VIC1"] for h in range(0, 24, 4)]
    return {"models": models, "feature_importance": fi, "accuracy_records": ar, "structural_breaks": sb, "drift_monitoring": dm, "forecasts": fc, "summary": {"best_model_name": "Ensemble", "best_model_mape_pct": 2.3, "production_models_count": 3, "models_with_drift": 1, "structural_breaks_ytd": 4, "avg_forecast_error_pct": 3.8}}


@router.get("/api/distributed-solar-forecasting/dashboard")
def dsfa_dashboard():
    # Try real solar generation data
    try:
        solar_rows = _query_gold(f"""
            SELECT region_id,
                   AVG(total_mw) AS avg_solar_mw,
                   MAX(total_mw) AS peak_solar_mw,
                   STDDEV(total_mw) AS std_solar_mw,
                   AVG(capacity_factor) AS avg_cf
            FROM {_CATALOG}.gold.nem_generation_by_fuel
            WHERE LOWER(fuel_type) LIKE '%solar%'
            AND interval_datetime >= current_timestamp() - INTERVAL 7 DAYS
            GROUP BY region_id
        """)
    except Exception:
        solar_rows = None

    if solar_rows:
        regions_data = {r["region_id"]: r for r in solar_rows}
        regions = ["NSW1", "QLD1", "VIC1", "SA1"]

        acc = []
        gi = []
        for reg in regions:
            rd = regions_data.get(reg)
            avg_mw = float(rd.get("avg_solar_mw") or 500) if rd else 500
            peak = float(rd.get("peak_solar_mw") or 1000) if rd else 1000
            std = float(rd.get("std_solar_mw") or 200) if rd else 200
            for h in ["1h", "4h", "24h"]:
                mult = {"1h": 1, "4h": 1.5, "24h": 2.5}[h]
                mape = round(std / max(avg_mw, 1) * 100 * mult * _r.uniform(0.5, 1.5), 2) if avg_mw > 0 else round(_r.uniform(5, 25), 2)
                acc.append({"region": reg, "horizon": h, "mape_pct": min(mape, 50),
                            "rmse_mw": round(std * mult * _r.uniform(0.5, 1.5), 1),
                            "skill_score": round(max(0.1, 1 - mape / 100), 2)})
            gi.append({"region": reg, "max_ramp_mw_min": round(peak * 0.15, 0),
                        "curtailment_mwh": round(_r.uniform(0, peak * 5), 0),
                        "min_demand_event_count": _r.randint(0, 20)})

        total_gw = sum(float(r.get("peak_solar_mw") or 0) for r in solar_rows) / 1000
        inst = [{"region": reg, "year": y, "installed_capacity_mw": round(float(regions_data.get(reg, {}).get("peak_solar_mw") or 3000) * (1 + (y - 2023) * 0.15)),
                 "systems_count": _r.randint(200000, 900000), "avg_system_kw": round(_r.uniform(5, 10), 1)}
                for reg in regions for y in [2023, 2024, 2025]]
        wi = [{"region": reg, "weather_type": w, "impact_mw": round(_r.uniform(-500, 500), 0), "frequency_pct": round(_r.uniform(2, 20), 1)} for reg in regions[:3] for w in ["Cloud Cover", "Temperature", "Humidity", "Dust/Haze"]]
        sc = [{"scenario": s, "year": 2030, "capacity_gw": round(_r.uniform(20, 50), 1), "generation_twh": round(_r.uniform(30, 80), 1)} for s in ["Step Change", "Progressive Change", "Green Energy Exports"]]

        avg_1h = sum(a["mape_pct"] for a in acc if a["horizon"] == "1h") / max(sum(1 for a in acc if a["horizon"] == "1h"), 1)
        return {"accuracy": acc, "installations": inst, "weather_impacts": wi, "grid_integration": gi, "scenarios": sc,
                "summary": {"total_installed_gw": round(total_gw, 1), "avg_mape_1h": round(avg_1h, 1), "fastest_growing_region": "QLD1"}}

    # Mock fallback
    _r.seed(7003)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    acc = [{"region": reg, "horizon": h, "mape_pct": round(_r.uniform(5, 25), 2), "rmse_mw": round(_r.uniform(20, 200), 1), "skill_score": round(_r.uniform(0.3, 0.9), 2)} for reg in regions for h in ["1h", "4h", "24h"]]
    inst = [{"region": reg, "year": y, "installed_capacity_mw": round(_r.uniform(2000, 8000), 0), "systems_count": _r.randint(200000, 900000), "avg_system_kw": round(_r.uniform(5, 10), 1)} for reg in regions for y in [2023, 2024, 2025]]
    wi = [{"region": reg, "weather_type": w, "impact_mw": round(_r.uniform(-500, 500), 0), "frequency_pct": round(_r.uniform(2, 20), 1)} for reg in regions[:3] for w in ["Cloud Cover", "Temperature", "Humidity", "Dust/Haze"]]
    gi = [{"region": reg, "max_ramp_mw_min": round(_r.uniform(50, 300), 0), "curtailment_mwh": round(_r.uniform(0, 5000), 0), "min_demand_event_count": _r.randint(0, 20)} for reg in regions]
    sc = [{"scenario": s, "year": 2030, "capacity_gw": round(_r.uniform(20, 50), 1), "generation_twh": round(_r.uniform(30, 80), 1)} for s in ["Step Change", "Progressive Change", "Green Energy Exports"]]
    return {"accuracy": acc, "installations": inst, "weather_impacts": wi, "grid_integration": gi, "scenarios": sc, "summary": {"total_installed_gw": 18.5, "avg_mape_1h": 8.2, "fastest_growing_region": "QLD1"}}


@router.get("/api/demand-forecast-accuracy/dashboard")
def dfa_dashboard():
    # Try real demand data for accuracy analysis
    try:
        demand_rows = _query_gold(f"""
            SELECT region_id, DATE(interval_datetime) AS dt,
                   AVG(total_demand_mw) AS avg_demand,
                   MAX(total_demand_mw) AS peak_demand,
                   MIN(total_demand_mw) AS min_demand,
                   STDDEV(total_demand_mw) AS std_demand
            FROM {_CATALOG}.gold.nem_prices_5min
            WHERE interval_datetime >= current_timestamp() - INTERVAL 30 DAYS
            GROUP BY region_id, DATE(interval_datetime)
            ORDER BY region_id, dt
        """)
    except Exception:
        demand_rows = None

    if demand_rows:
        er = []
        for r in demand_rows:
            actual = float(r.get("avg_demand") or 7000)
            forecast = actual * _r.uniform(0.95, 1.05)  # simulated forecast
            error = forecast - actual
            er.append({
                "region": r["region_id"], "date": str(r["dt"]),
                "forecast_mw": round(forecast), "actual_mw": round(actual),
                "error_mw": round(error), "error_pct": round(error / max(actual, 1) * 100, 2),
            })

        avg_mape = sum(abs(e["error_pct"]) for e in er) / max(len(er), 1)
        # Find worst region (highest avg error)
        from collections import defaultdict
        region_errors = defaultdict(list)
        for e in er:
            region_errors[e["region"]].append(abs(e["error_pct"]))
        worst_region = max(region_errors.items(), key=lambda x: sum(x[1]) / len(x[1]))[0] if region_errors else "SA1"

        hs = [{"horizon": h, "mape_pct": round(_r.uniform(1, 12), 2), "rmse_mw": round(_r.uniform(50, 400), 0), "bias_mw": round(_r.uniform(-100, 100), 0), "sample_count": _r.randint(500, 5000)} for h in ["5min", "30min", "1h", "4h", "24h", "168h"]]
        sb = [{"region": reg, "season": s, "bias_mw": round(_r.uniform(-200, 200), 0), "bias_pct": round(_r.uniform(-5, 5), 2)} for reg in ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"] for s in ["Summer", "Autumn", "Winter", "Spring"]]
        mb = [{"model": m, "mape_pct": round(_r.uniform(2, 10), 2), "rmse_mw": round(_r.uniform(80, 350), 0), "r_squared": round(_r.uniform(0.88, 0.99), 3)} for m in ["AEMO P50", "XGBoost", "LSTM", "Ensemble", "Persistence"]]
        return {"error_records": er, "horizon_summary": hs, "seasonal_bias": sb, "model_benchmarks": mb,
                "summary": {"avg_mape_pct": round(avg_mape, 1), "best_model": "Ensemble", "worst_region": worst_region}}

    # Mock fallback
    _r.seed(7004)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    er = [{"region": reg, "date": f"2025-{m:02d}-15", "forecast_mw": round(_r.uniform(5000, 13000), 0), "actual_mw": round(_r.uniform(5000, 13000), 0), "error_mw": round(_r.uniform(-500, 500), 0), "error_pct": round(_r.uniform(-8, 8), 2)} for reg in regions for m in range(1, 13)]
    hs = [{"horizon": h, "mape_pct": round(_r.uniform(1, 12), 2), "rmse_mw": round(_r.uniform(50, 400), 0), "bias_mw": round(_r.uniform(-100, 100), 0), "sample_count": _r.randint(500, 5000)} for h in ["5min", "30min", "1h", "4h", "24h", "168h"]]
    sb = [{"region": reg, "season": s, "bias_mw": round(_r.uniform(-200, 200), 0), "bias_pct": round(_r.uniform(-5, 5), 2)} for reg in regions for s in ["Summer", "Autumn", "Winter", "Spring"]]
    mb = [{"model": m, "mape_pct": round(_r.uniform(2, 10), 2), "rmse_mw": round(_r.uniform(80, 350), 0), "r_squared": round(_r.uniform(0.88, 0.99), 3)} for m in ["AEMO P50", "XGBoost", "LSTM", "Ensemble", "Persistence"]]
    return {"error_records": er, "horizon_summary": hs, "seasonal_bias": sb, "model_benchmarks": mb, "summary": {"avg_mape_pct": 3.9, "best_model": "Ensemble", "worst_region": "SA1"}}


@router.get("/api/electricity-market-forecasting-accuracy/dashboard")
def emfa_dashboard():
    # Try real price data for forecasting accuracy analysis
    try:
        price_rows = _query_gold(f"""
            SELECT region_id, DATE(interval_datetime) AS dt,
                   AVG(rrp) AS avg_price,
                   MAX(rrp) AS max_price,
                   MIN(rrp) AS min_price,
                   AVG(total_demand_mw) AS avg_demand
            FROM {_CATALOG}.gold.nem_prices_5min
            WHERE interval_datetime >= current_timestamp() - INTERVAL 30 DAYS
            GROUP BY region_id, DATE(interval_datetime)
            ORDER BY region_id, dt
        """)
        ren_rows = _query_gold(f"""
            SELECT region_id, fuel_type, AVG(total_mw) AS avg_mw
            FROM {_CATALOG}.gold.nem_generation_by_fuel
            WHERE interval_datetime >= current_timestamp() - INTERVAL 7 DAYS
            AND (LOWER(fuel_type) LIKE '%solar%' OR LOWER(fuel_type) LIKE '%wind%')
            GROUP BY region_id, fuel_type
        """)
    except Exception:
        price_rows = None
        ren_rows = None

    if price_rows:
        pf = []
        df = []
        for r in price_rows:
            actual_p = float(r.get("avg_price") or 80)
            forecast_p = actual_p * _r.uniform(0.85, 1.15)  # simulated forecast
            actual_d = float(r.get("avg_demand") or 7000)
            forecast_d = actual_d * _r.uniform(0.95, 1.05)
            pf.append({"region": r["region_id"], "date": str(r["dt"]),
                        "forecast_price": round(forecast_p, 2), "actual_price": round(actual_p, 2),
                        "error_pct": round((forecast_p - actual_p) / max(actual_p, 1) * 100, 2)})
            df.append({"region": r["region_id"], "date": str(r["dt"]),
                        "forecast_mw": round(forecast_d), "actual_mw": round(actual_d),
                        "mape_pct": round(abs(forecast_d - actual_d) / max(actual_d, 1) * 100, 2)})

        rf = []
        if ren_rows:
            for r in ren_rows:
                actual = float(r.get("avg_mw") or 500)
                forecast = actual * _r.uniform(0.8, 1.2)
                src = "Solar" if "solar" in str(r["fuel_type"]).lower() else "Wind"
                rf.append({"region": r["region_id"], "source": src,
                           "forecast_mw": round(forecast), "actual_mw": round(actual),
                           "error_pct": round((forecast - actual) / max(actual, 1) * 100, 2)})
        else:
            rf = [{"region": reg, "source": s, "forecast_mw": round(_r.uniform(500, 5000), 0), "actual_mw": round(_r.uniform(500, 5000), 0), "error_pct": round(_r.uniform(-20, 20), 2)} for reg in ["NSW1", "QLD1", "VIC1"] for s in ["Solar", "Wind"]]

        avg_price_mape = sum(abs(p["error_pct"]) for p in pf) / max(len(pf), 1)
        avg_demand_mape = sum(d["mape_pct"] for d in df) / max(len(df), 1)

        ep = [{"event_type": t, "predicted": _r.randint(5, 30), "actual": _r.randint(5, 30), "accuracy_pct": round(_r.uniform(40, 90), 1)} for t in ["Price Spike", "Negative Price", "Demand Peak", "Ramp Event"]]
        mdls = [{"model": m, "mape_price_pct": round(_r.uniform(5, 20), 2), "mape_demand_pct": round(_r.uniform(2, 8), 2), "status": "PRODUCTION"} for m in ["Ensemble-v4", "XGBoost-P", "LSTM-Price", "Prophet"]]
        it = [{"year": y, "price_mape_pct": round(_r.uniform(8, 18), 2), "demand_mape_pct": round(_r.uniform(2, 6), 2)} for y in [2021, 2022, 2023, 2024, 2025]]

        return {"price_forecasts": pf, "demand_forecasts": df, "renewable_forecasts": rf, "event_predictions": ep,
                "models": mdls, "improvement_trend": it,
                "summary": {"avg_price_mape_pct": round(avg_price_mape, 1), "avg_demand_mape_pct": round(avg_demand_mape, 1),
                            "best_model_name": "Ensemble-v4", "spike_prediction_accuracy_pct": 72.5,
                            "yoy_improvement_pct": 8.3, "avg_renewable_error_pct": round(sum(abs(r["error_pct"]) for r in rf) / max(len(rf), 1), 1)}}

    # Mock fallback
    _r.seed(7005)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    pf = [{"region": reg, "date": f"2025-{m:02d}-15", "forecast_price": round(_r.uniform(40, 200), 2), "actual_price": round(_r.uniform(40, 200), 2), "error_pct": round(_r.uniform(-15, 15), 2)} for reg in regions for m in range(1, 13)]
    df = [{"region": reg, "date": f"2025-{m:02d}-15", "forecast_mw": round(_r.uniform(5000, 13000), 0), "actual_mw": round(_r.uniform(5000, 13000), 0), "mape_pct": round(_r.uniform(1, 8), 2)} for reg in regions for m in range(1, 7)]
    rf = [{"region": reg, "source": s, "forecast_mw": round(_r.uniform(500, 5000), 0), "actual_mw": round(_r.uniform(500, 5000), 0), "error_pct": round(_r.uniform(-20, 20), 2)} for reg in regions[:3] for s in ["Solar", "Wind"]]
    ep = [{"event_type": t, "predicted": _r.randint(5, 30), "actual": _r.randint(5, 30), "accuracy_pct": round(_r.uniform(40, 90), 1)} for t in ["Price Spike", "Negative Price", "Demand Peak", "Ramp Event"]]
    mdls = [{"model": m, "mape_price_pct": round(_r.uniform(5, 20), 2), "mape_demand_pct": round(_r.uniform(2, 8), 2), "status": "PRODUCTION"} for m in ["Ensemble-v4", "XGBoost-P", "LSTM-Price", "Prophet"]]
    it = [{"year": y, "price_mape_pct": round(_r.uniform(8, 18), 2), "demand_mape_pct": round(_r.uniform(2, 6), 2)} for y in [2021, 2022, 2023, 2024, 2025]]
    return {"price_forecasts": pf, "demand_forecasts": df, "renewable_forecasts": rf, "event_predictions": ep, "models": mdls, "improvement_trend": it, "summary": {"avg_price_mape_pct": 11.2, "avg_demand_mape_pct": 3.9, "best_model_name": "Ensemble-v4", "spike_prediction_accuracy_pct": 72.5, "yoy_improvement_pct": 8.3, "avg_renewable_error_pct": 12.1}}


@router.get("/api/nem-demand-forecast/dashboard")
def ndf_dashboard():
    # Try real demand data for NEM demand forecast
    try:
        demand_rows = _query_gold(f"""
            SELECT region_id,
                   MAX(total_demand_mw) AS peak_demand,
                   AVG(total_demand_mw) AS avg_demand,
                   MAX(available_gen_mw) AS max_capacity
            FROM {_CATALOG}.gold.nem_prices_5min
            WHERE interval_datetime >= current_timestamp() - INTERVAL 30 DAYS
            GROUP BY region_id
        """)
    except Exception:
        demand_rows = None

    if demand_rows:
        regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
        region_data = {r["region_id"]: r for r in demand_rows}
        rf = []
        pd_list = []
        for reg in regions:
            rd = region_data.get(reg)
            if not rd:
                continue
            peak = float(rd["peak_demand"] or 0)
            avg_d = float(rd["avg_demand"] or 0)
            cap = float(rd["max_capacity"] or 0)
            for y in [2026, 2027, 2028, 2030]:
                growth = 1 + (y - 2026) * 0.018  # ~1.8% growth
                rf.append({"region": reg, "year": y, "summer_peak_mw": round(peak * growth), "winter_peak_mw": round(peak * growth * 0.9), "annual_energy_twh": round(avg_d * 8.76 / 1000 * growth, 1), "growth_pct": 1.8})
            pd_list.append({"region": reg, "year": 2026, "peak_demand_mw": round(peak), "poe_10_mw": round(peak * 1.1), "poe_50_mw": round(avg_d), "poe_90_mw": round(avg_d * 0.85)})

        if rf:
            gd = [{"driver": d, "impact_mw": imp, "direction": dir_, "certainty": cert} for d, imp, dir_, cert in [("Population Growth", 1500, "Increasing", "High"), ("EV Uptake", 2000, "Increasing", "Medium"), ("Rooftop Solar", -1800, "Decreasing", "High"), ("Battery Storage", -500, "Decreasing", "Medium"), ("Industrial Load", 800, "Increasing", "Low"), ("Data Centres", 1200, "Increasing", "Medium"), ("Electrification", 2500, "Increasing", "High")]]
            sens = [{"parameter": p, "low_case_mw": low, "base_case_mw": 0, "high_case_mw": high} for p, low, high in [("Temperature", -1000, 2000), ("Economic Growth", -800, 1500), ("EV Penetration", -200, 3000), ("Solar Uptake", -2000, -500)]]
            ro = []
            for reg in regions:
                rd = region_data.get(reg)
                if not rd:
                    continue
                peak = float(rd["peak_demand"] or 0)
                cap = float(rd["max_capacity"] or 0)
                margin = (cap - peak) / max(peak, 1) * 100
                ro.append({"region": reg, "year": 2026, "unserved_energy_mwh": 0 if margin > 10 else round(peak * 0.01, 1), "reliability_standard_met": margin > 10})
            total_peak = sum(float(region_data.get(r, {}).get("peak_demand") or 0) for r in regions)
            return {"regional_forecasts": rf, "peak_demands": pd_list, "growth_drivers": gd, "sensitivities": sens, "reliability_outlook": ro, "summary": {"total_nem_peak_mw": round(total_peak), "growth_rate_pct": 1.8, "highest_growth_region": "QLD1"}}

    # Mock fallback
    _r.seed(7006)
    regions = ["NSW1", "QLD1", "VIC1", "SA1", "TAS1"]
    rf = [{"region": reg, "year": y, "summer_peak_mw": round(_r.uniform(8000, 15000), 0), "winter_peak_mw": round(_r.uniform(7000, 13000), 0), "annual_energy_twh": round(_r.uniform(20, 80), 1), "growth_pct": round(_r.uniform(-2, 5), 2)} for reg in regions for y in [2025, 2026, 2027, 2028, 2030]]
    pd_list = [{"region": reg, "year": y, "peak_demand_mw": round(_r.uniform(8000, 15000), 0), "poe_10_mw": round(_r.uniform(9000, 17000), 0), "poe_50_mw": round(_r.uniform(7500, 14000), 0), "poe_90_mw": round(_r.uniform(6500, 12000), 0)} for reg in regions for y in [2025, 2026, 2028]]
    gd = [{"driver": d, "impact_mw": round(_r.uniform(-2000, 3000), 0), "direction": _r.choice(["Increasing", "Decreasing"]), "certainty": _r.choice(["High", "Medium", "Low"])} for d in ["Population Growth", "EV Uptake", "Rooftop Solar", "Battery Storage", "Industrial Load", "Data Centres", "Electrification"]]
    sens = [{"parameter": p, "low_case_mw": round(_r.uniform(-2000, 0), 0), "base_case_mw": 0, "high_case_mw": round(_r.uniform(0, 3000), 0)} for p in ["Temperature", "Economic Growth", "EV Penetration", "Solar Uptake"]]
    ro = [{"region": reg, "year": y, "unserved_energy_mwh": round(_r.uniform(0, 50), 1), "reliability_standard_met": _r.choice([True, True, True, False])} for reg in regions for y in [2025, 2026, 2028]]
    return {"regional_forecasts": rf, "peak_demands": pd_list, "growth_drivers": gd, "sensitivities": sens, "reliability_outlook": ro, "summary": {"total_nem_peak_mw": 35200, "growth_rate_pct": 1.8, "highest_growth_region": "QLD1"}}


@router.get("/api/electricity-price-forecasting-models/dashboard")
def epf_models_dashboard():
    _r.seed(7007)
    models_names = ["XGBoost-Price", "LSTM-Seq2Seq", "Prophet-Energy", "Ridge-Base", "CatBoost-v2", "Transformer"]
    models = [{"model_id": f"EPF-{i+1:03d}", "model_name": m, "model_type": m.split("-")[0], "version": f"v{_r.randint(1,4)}.{_r.randint(0,9)}", "mape_pct": round(_r.uniform(5, 20), 2), "rmse_aud": round(_r.uniform(10, 60), 2), "status": _r.choice(["PRODUCTION", "STAGING", "RETIRED"])} for i, m in enumerate(models_names)]
    ew = [{"model": m, "weight": round(_r.uniform(0.05, 0.35), 3)} for m in models_names[:4]]
    fa = [{"model": m, "region": reg, "horizon": h, "mape_pct": round(_r.uniform(3, 18), 2), "rmse_aud": round(_r.uniform(8, 50), 2)} for m in models_names[:3] for reg in ["NSW1", "QLD1", "VIC1"] for h in ["1h", "24h"]]
    fi = [{"feature": f, "importance": round(_r.uniform(0.02, 0.25), 3)} for f in ["Demand", "Gas Price", "Wind Output", "Solar Output", "Temperature", "Time of Day", "Interconnector Flow", "Coal Price"]]
    cal = [{"model": m, "quantile": q, "coverage_pct": round(_r.uniform(q * 100 - 5, q * 100 + 5), 1)} for m in models_names[:3] for q in [0.1, 0.25, 0.5, 0.75, 0.9]]
    return {"models": models, "ensemble_weights": ew, "forecast_accuracy": fa, "feature_importance": fi, "calibration": cal, "summary": {"best_model": "XGBoost-Price", "ensemble_mape_pct": 7.2, "models_in_production": 3}}


@router.get("/api/electricity-price-forecasting/dashboard")
def epfm_dashboard():
    _r.seed(7008)
    models_names = ["Ensemble-v5", "XGBoost-P2", "LSTM-Price", "CatBoost-P", "Ridge", "Prophet-P"]
    models = [{"model_id": f"EPFM-{i+1:03d}", "model_name": m, "mape_pct": round(_r.uniform(4, 16), 2), "rmse_aud": round(_r.uniform(8, 45), 2), "training_samples": _r.randint(10000, 100000), "status": _r.choice(["ACTIVE", "RETIRED"])} for i, m in enumerate(models_names)]
    fa = [{"region": reg, "horizon": h, "mape_pct": round(_r.uniform(3, 15), 2), "rmse_aud": round(_r.uniform(8, 50), 2), "direction_accuracy_pct": round(_r.uniform(55, 85), 1)} for reg in ["NSW1", "QLD1", "VIC1", "SA1"] for h in ["5min", "30min", "1h", "4h", "24h"]]
    fi = [{"feature": f, "importance": round(_r.uniform(0.03, 0.22), 3), "direction": _r.choice(["positive", "negative"])} for f in ["Demand", "Gas Price", "Wind", "Solar", "Temperature", "Interconnector", "Coal Price", "Carbon Price"]]
    fva = [{"region": reg, "timestamp": f"2025-12-20T{h:02d}:00:00Z", "forecast_aud": round(_r.uniform(30, 200), 2), "actual_aud": round(_r.uniform(30, 200), 2)} for reg in ["NSW1", "QLD1", "VIC1"] for h in range(0, 24, 4)]
    ee = [{"event_type": t, "count": _r.randint(5, 40), "avg_forecast_error_pct": round(_r.uniform(15, 60), 1), "model_best": _r.choice(models_names[:3])} for t in ["Price Spike >$300", "Negative Price", "Sustained High", "Ramp Event"]]
    return {"models": models, "forecast_accuracy": fa, "feature_importance": fi, "forecast_vs_actual": fva, "extreme_events": ee, "summary": {"best_model": "Ensemble-v5", "avg_mape_pct": 8.4, "spike_detection_rate_pct": 68.0, "models_active": 4}}


@router.get("/api/volatility-regime/dashboard")
def volatility_regime_dashboard():
    # Try real price volatility from 5-min data
    try:
        vol_rows = _query_gold(f"""
            SELECT region_id,
                   AVG(rrp) AS avg_price,
                   STDDEV(rrp) AS std_price,
                   MAX(rrp) AS max_price,
                   MIN(rrp) AS min_price,
                   COUNT(*) AS sample_count
            FROM {_CATALOG}.gold.nem_prices_5min
            WHERE interval_datetime >= current_timestamp() - INTERVAL 30 DAYS
            GROUP BY region_id
        """)
    except Exception:
        vol_rows = None

    if vol_rows:
        regions = ["NSW1", "QLD1", "VIC1", "SA1"]
        vol_map = {r["region_id"]: r for r in vol_rows}

        regimes = []
        clusters = []
        for i, (reg, name) in enumerate([(r, n) for r in regions for n in ["Low Vol", "Normal", "High Vol", "Extreme"]]):
            vr = vol_map.get(reg, {})
            avg_p = float(vr.get("avg_price") or 80)
            std_p = float(vr.get("std_price") or 50)
            vol_pct = std_p / max(avg_p, 1) * 100
            regime_mult = {"Low Vol": 0.3, "Normal": 1.0, "High Vol": 2.0, "Extreme": 4.0}[name]
            is_current = (name == "Normal") if vol_pct < 80 else (name == "High Vol")
            regimes.append({
                "regime_id": f"R-{i+1}", "region": reg, "regime_name": name,
                "avg_volatility_pct": round(vol_pct * regime_mult, 1),
                "avg_price_aud": round(avg_p * (0.5 + regime_mult * 0.5), 2),
                "duration_days": _r.randint(5, 120),
                "frequency_pct": round({"Low Vol": 30, "Normal": 40, "High Vol": 20, "Extreme": 10}[name] * _r.uniform(0.8, 1.2), 1),
                "current": is_current,
            })

        for reg in regions:
            vr = vol_map.get(reg, {})
            std_p = float(vr.get("std_price") or 50)
            for _ in range(4):
                clusters.append({
                    "region": reg, "cluster_id": _r.randint(1, 5),
                    "volatility_pct": round(std_p * _r.uniform(0.2, 3), 1),
                    "price_range_aud": round(_r.uniform(20, 500), 2),
                    "observations": _r.randint(100, 2000),
                })

        hedging = [{"regime": n, "recommended_hedge_ratio_pct": round(_r.uniform(50, 100), 0), "instrument": _r.choice(["Swap", "Cap", "Collar"]), "cost_aud_mwh": round(_r.uniform(2, 20), 2)} for n in ["Low Vol", "Normal", "High Vol", "Extreme"]]
        trans = [{"from_regime": f, "to_regime": t, "probability_pct": round(_r.uniform(5, 40), 1), "avg_transition_days": _r.randint(1, 30)} for f in ["Low Vol", "Normal", "High Vol"] for t in ["Normal", "High Vol", "Extreme"] if f != t]
        return {"timestamp": _dt.utcnow().isoformat() + "Z", "regimes": regimes, "clusters": clusters, "hedging": hedging, "transitions": trans}

    # Mock fallback
    _r.seed(7009)
    regions = ["NSW1", "QLD1", "VIC1", "SA1"]
    regimes = [{"regime_id": f"R-{i+1}", "region": reg, "regime_name": name, "avg_volatility_pct": round(_r.uniform(5, 80), 1), "avg_price_aud": round(_r.uniform(40, 300), 2), "duration_days": _r.randint(5, 120), "frequency_pct": round(_r.uniform(5, 40), 1), "current": _r.choice([True, False])} for i, (reg, name) in enumerate([(r, n) for r in regions for n in ["Low Vol", "Normal", "High Vol", "Extreme"]])]
    clusters = [{"region": reg, "cluster_id": _r.randint(1, 5), "volatility_pct": round(_r.uniform(5, 90), 1), "price_range_aud": round(_r.uniform(20, 500), 2), "observations": _r.randint(100, 2000)} for reg in regions for _ in range(4)]
    hedging = [{"regime": n, "recommended_hedge_ratio_pct": round(_r.uniform(50, 100), 0), "instrument": _r.choice(["Swap", "Cap", "Collar"]), "cost_aud_mwh": round(_r.uniform(2, 20), 2)} for n in ["Low Vol", "Normal", "High Vol", "Extreme"]]
    trans = [{"from_regime": f, "to_regime": t, "probability_pct": round(_r.uniform(5, 40), 1), "avg_transition_days": _r.randint(1, 30)} for f in ["Low Vol", "Normal", "High Vol"] for t in ["Normal", "High Vol", "Extreme"] if f != t]
    return {"timestamp": _dt.utcnow().isoformat() + "Z", "regimes": regimes, "clusters": clusters, "hedging": hedging, "transitions": trans}

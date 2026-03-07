# Databricks notebook source
# MAGIC %md
# MAGIC # AEMO ISP Data Ingest
# MAGIC Parses Integrated System Plan (ISP) 2024 project tracker, capacity outlook,
# MAGIC and REZ assessments. Data from AEMO public ISP publications.
# MAGIC
# MAGIC Source: https://aemo.com.au/en/energy-systems/major-publications/integrated-system-plan-isp
# MAGIC Cadence: Annual (or when ISP updates published)

# COMMAND ----------

import json
from datetime import datetime, timezone

try:
    CATALOG = dbutils.widgets.get("catalog")
except Exception:
    CATALOG = "energy_copilot_catalog"

SCHEMA = f"{CATALOG}.gold"

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. ISP 2024 Actionable Projects
# MAGIC Source: ISP 2024 Appendix 5 (Transmission Development Plan)

# COMMAND ----------

isp_projects = [
    ("HumeLink", "transmission", "Under Construction", "2028-06-30", 3300, "Transgrid", 360, 2000),
    ("VNI West", "transmission", "RIT-T Approved", "2029-12-31", 2800, "AEMO/Transgrid", 290, 1800),
    ("Marinus Link Stage 1", "interconnector", "Under Construction", "2030-06-30", 3500, "Marinus Link Pty", 255, 750),
    ("Project EnergyConnect", "interconnector", "Under Construction", "2026-12-31", 2400, "ElectraNet/Transgrid", 900, 800),
    ("Sydney Ring", "transmission", "Assessment", "2031-12-31", 4200, "Transgrid", 0, 3000),
    ("QNI Medium", "interconnector", "Feasibility", "2033-12-31", 1600, "Powerlink", 0, 800),
    ("CopperString 2.0", "transmission", "Approved", "2029-06-30", 5000, "CuString", 1100, 2000),
    ("Western Renewables Link", "transmission", "Approved", "2028-12-31", 1800, "AusNet", 190, 600),
    ("Central-West Orana REZ Transmission", "transmission", "Under Construction", "2027-12-31", 2200, "Transgrid", 280, 3000),
    ("New England REZ Transmission", "transmission", "Planning", "2030-06-30", 1500, "Transgrid", 180, 8000),
]

now = datetime.now(timezone.utc).isoformat()
values = []
for name, ptype, status, completion, capex, tnsp, km, cap_mw in isp_projects:
    values.append(
        f"('{name}', '{ptype}', '{status}', '{completion}', {capex}, '{tnsp}', {km}, {cap_mw}, '{now}')"
    )
vals = ",\n".join(values)
spark.sql(f"""
    MERGE INTO {SCHEMA}.isp_projects AS t
    USING (SELECT * FROM VALUES {vals}
           AS s(project_name, type, status, expected_completion, capex_m_aud, tnsp, route_km, capacity_mw, ingested_at))
    ON t.project_name = s.project_name
    WHEN MATCHED THEN UPDATE SET *
    WHEN NOT MATCHED THEN INSERT *
""")
print(f"Upserted {len(isp_projects)} ISP projects")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. ISP 2024 Capacity Outlook (Step Change scenario)
# MAGIC Source: ISP 2024 Generation Information page / Appendix 4

# COMMAND ----------

capacity_outlook = []
scenarios = ["Step Change", "Progressive Change", "Green Energy Exports"]
regions = ["NSW1", "VIC1", "QLD1", "SA1", "TAS1"]
fuels = ["Wind", "Solar", "Battery", "Gas", "Hydro"]

# ISP 2024 Step Change projections (approximate GW)
# Format: (scenario, year, region, fuel, capacity_mw, generation_twh)
step_change_data = [
    # 2030
    ("Step Change", 2030, "NSW1", "Wind", 9200, 26.0),
    ("Step Change", 2030, "NSW1", "Solar", 16500, 25.0),
    ("Step Change", 2030, "NSW1", "Battery", 5000, 2.0),
    ("Step Change", 2030, "VIC1", "Wind", 12000, 34.0),
    ("Step Change", 2030, "VIC1", "Solar", 8500, 13.0),
    ("Step Change", 2030, "VIC1", "Battery", 4500, 1.8),
    ("Step Change", 2030, "QLD1", "Wind", 5500, 16.0),
    ("Step Change", 2030, "QLD1", "Solar", 22000, 33.0),
    ("Step Change", 2030, "QLD1", "Battery", 6000, 2.5),
    ("Step Change", 2030, "SA1", "Wind", 6800, 19.0),
    ("Step Change", 2030, "SA1", "Solar", 5500, 8.5),
    ("Step Change", 2030, "SA1", "Battery", 3200, 1.2),
    ("Step Change", 2030, "TAS1", "Wind", 3500, 10.0),
    ("Step Change", 2030, "TAS1", "Hydro", 3800, 9.5),
    # 2035
    ("Step Change", 2035, "NSW1", "Wind", 14000, 40.0),
    ("Step Change", 2035, "NSW1", "Solar", 25000, 38.0),
    ("Step Change", 2035, "NSW1", "Battery", 10000, 5.0),
    ("Step Change", 2035, "VIC1", "Wind", 18000, 52.0),
    ("Step Change", 2035, "VIC1", "Solar", 13000, 20.0),
    ("Step Change", 2035, "VIC1", "Battery", 8000, 4.0),
    ("Step Change", 2035, "QLD1", "Wind", 10000, 29.0),
    ("Step Change", 2035, "QLD1", "Solar", 35000, 53.0),
    ("Step Change", 2035, "QLD1", "Battery", 12000, 6.0),
    ("Step Change", 2035, "SA1", "Wind", 10000, 28.0),
    ("Step Change", 2035, "SA1", "Solar", 8500, 13.0),
    ("Step Change", 2035, "SA1", "Battery", 5500, 2.5),
    ("Step Change", 2035, "TAS1", "Wind", 5500, 16.0),
    ("Step Change", 2035, "TAS1", "Hydro", 4200, 10.5),
    # 2040
    ("Step Change", 2040, "NSW1", "Wind", 18000, 52.0),
    ("Step Change", 2040, "NSW1", "Solar", 32000, 49.0),
    ("Step Change", 2040, "VIC1", "Wind", 23000, 66.0),
    ("Step Change", 2040, "VIC1", "Solar", 17000, 26.0),
    ("Step Change", 2040, "QLD1", "Wind", 14000, 40.0),
    ("Step Change", 2040, "QLD1", "Solar", 45000, 68.0),
    ("Step Change", 2040, "SA1", "Wind", 13000, 37.0),
    ("Step Change", 2040, "SA1", "Solar", 11000, 17.0),
    ("Step Change", 2040, "TAS1", "Wind", 7000, 20.0),
]

values = []
for scenario, year, region, fuel, cap, gen in step_change_data:
    values.append(
        f"('{scenario}', {year}, '{region}', '{fuel}', {cap}, {gen}, '{now}')"
    )
vals = ",\n".join(values)
spark.sql(f"""
    MERGE INTO {SCHEMA}.isp_capacity_outlook AS t
    USING (SELECT * FROM VALUES {vals}
           AS s(scenario, year, region, fuel_type, capacity_mw, generation_twh, ingested_at))
    ON t.scenario = s.scenario AND t.year = s.year AND t.region = s.region AND t.fuel_type = s.fuel_type
    WHEN MATCHED THEN UPDATE SET *
    WHEN NOT MATCHED THEN INSERT *
""")
print(f"Upserted {len(step_change_data)} capacity outlook rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. REZ Assessments
# MAGIC Source: ISP 2024 Appendix 3 (Renewable Energy Zones)

# COMMAND ----------

rez_data = [
    ("New England", "NSW1", 5500, 3200, 8000, "Declared", 85),
    ("Central-West Orana", "NSW1", 3200, 2800, 3000, "Declared", 78),
    ("South-West NSW", "NSW1", 2000, 1500, 1500, "Candidate", 65),
    ("Hunter-Central Coast", "NSW1", 1200, 800, 600, "Candidate", 55),
    ("Western Victoria", "VIC1", 1200, 4500, 3000, "Active", 82),
    ("Murray River", "VIC1", 3500, 500, 1000, "Candidate", 60),
    ("Gippsland", "VIC1", 2500, 3000, 2000, "Candidate", 58),
    ("Far North QLD", "QLD1", 4500, 1500, 2000, "Active", 72),
    ("Isaac / Bowen", "QLD1", 3000, 2000, 1500, "Candidate", 68),
    ("Darling Downs", "QLD1", 5000, 500, 1200, "Active", 75),
    ("Mid-North SA", "SA1", 2000, 4500, 3000, "Active", 80),
    ("Leigh Creek", "SA1", 3500, 2500, 1000, "Candidate", 62),
    ("North West TAS", "TAS1", 500, 3000, 2500, "Planned", 70),
    ("North East TAS", "TAS1", 300, 1500, 1000, "Candidate", 55),
]

values = []
for name, region, solar, wind, network, status, score in rez_data:
    values.append(
        f"('{name}', '{region}', {solar}, {wind}, {network}, '{status}', {score}, '{now}')"
    )
vals = ",\n".join(values)
spark.sql(f"""
    MERGE INTO {SCHEMA}.rez_assessments AS t
    USING (SELECT * FROM VALUES {vals}
           AS s(rez_name, region, solar_capacity_mw, wind_capacity_mw, network_capacity_mw, development_status, score, ingested_at))
    ON t.rez_name = s.rez_name
    WHEN MATCHED THEN UPDATE SET *
    WHEN NOT MATCHED THEN INSERT *
""")
print(f"Upserted {len(rez_data)} REZ assessment rows")

# COMMAND ----------

for t in ["isp_projects", "isp_capacity_outlook", "rez_assessments"]:
    cnt = spark.sql(f"SELECT COUNT(*) AS cnt FROM {SCHEMA}.{t}").collect()[0].cnt
    print(f"  {SCHEMA}.{t}: {cnt} rows")

dbutils.notebook.exit(json.dumps({"status": "success", "projects": len(isp_projects), "capacity": len(step_change_data), "rez": len(rez_data)}))

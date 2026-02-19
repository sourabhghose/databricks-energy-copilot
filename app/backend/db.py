# ============================================================
# AUS Energy Copilot — Database abstraction layer
# ============================================================
# db.py exposes two thin client wrappers:
#
#   DatabricksSQLClient  — read queries against Unity Catalog gold tables
#                          via databricks-sql-connector; falls back to
#                          mock data when DATABRICKS_HOST is unset.
#
#   LakebaseClient       — operational read/write against the Lakebase
#                          (PostgreSQL-compatible) instance that stores
#                          user_preferences, alert_configs, and
#                          copilot_sessions.
# ============================================================

from __future__ import annotations

import json
import logging
import os
from contextlib import contextmanager
from typing import Any, Dict, Generator, List, Optional

logger = logging.getLogger("energy_copilot.db")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _rows_to_dicts(cursor) -> List[Dict[str, Any]]:
    """Convert cursor results to a list of dicts using description for keys."""
    if cursor.description is None:
        return []
    cols = [d[0] for d in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


# ---------------------------------------------------------------------------
# DatabricksSQLClient
# ---------------------------------------------------------------------------

class DatabricksSQLClient:
    """
    Thin wrapper around databricks-sql-connector.

    When DATABRICKS_HOST is not set in the environment the client switches to
    *mock mode*: every query method returns an empty list (or None) and callers
    are expected to substitute mock data via the mock_data module.

    Usage
    -----
    client = DatabricksSQLClient()
    rows   = client.execute("SELECT * FROM energy_copilot.gold.nem_prices_5min LIMIT 5")
    """

    def __init__(self) -> None:
        self.host        = os.environ.get("DATABRICKS_HOST", "")
        self.token       = os.environ.get("DATABRICKS_TOKEN", "")
        self.warehouse_id = os.environ.get("DATABRICKS_WAREHOUSE_ID", "")
        self.mock_mode   = not bool(self.host)

        if self.mock_mode:
            logger.warning(
                "DATABRICKS_HOST is not set — DatabricksSQLClient running in mock mode. "
                "All queries will return empty results; callers must inject mock data."
            )

    # ------------------------------------------------------------------ #
    # Internal connection factory                                          #
    # ------------------------------------------------------------------ #

    def _connect(self):
        """Return a live databricks-sql-connector connection."""
        try:
            from databricks import sql as dbsql  # type: ignore[import]
        except ImportError as exc:
            raise RuntimeError(
                "databricks-sql-connector is not installed. "
                "Run: pip install databricks-sql-connector"
            ) from exc

        return dbsql.connect(
            server_hostname=self.host.replace("https://", ""),
            http_path=f"/sql/1.0/warehouses/{self.warehouse_id}",
            access_token=self.token,
        )

    @contextmanager
    def cursor(self) -> Generator:
        """Context manager that yields a cursor and ensures connection cleanup."""
        if self.mock_mode:
            raise RuntimeError("Cannot open cursor in mock mode.")
        conn = self._connect()
        try:
            with conn.cursor() as cur:
                yield cur
        finally:
            conn.close()

    # ------------------------------------------------------------------ #
    # Public query methods                                                 #
    # ------------------------------------------------------------------ #

    def execute(
        self,
        sql: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Execute *sql* on the Databricks SQL Warehouse and return all rows
        as a list of dicts.

        Returns an empty list in mock mode — callers should substitute mock
        data before returning to the user.
        """
        if self.mock_mode:
            return []
        with self.cursor() as cur:
            cur.execute(sql, params or {})
            return _rows_to_dicts(cur)

    def execute_one(
        self,
        sql: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Execute *sql* and return the first row as a dict, or None if no rows.
        """
        if self.mock_mode:
            return None
        with self.cursor() as cur:
            cur.execute(sql, params or {})
            if cur.description is None:
                return None
            cols = [d[0] for d in cur.description]
            row  = cur.fetchone()
            return dict(zip(cols, row)) if row else None

    def health_check(self) -> bool:
        """
        Execute a trivial SELECT 1 to verify connectivity.
        Returns True when healthy, False on any error.
        Always returns True in mock mode (there is nothing to check).
        """
        if self.mock_mode:
            return True
        try:
            result = self.execute_one("SELECT 1 AS ping")
            return result is not None and result.get("ping") == 1
        except Exception:
            logger.exception("Databricks health check failed")
            return False


# ---------------------------------------------------------------------------
# LakebaseClient
# ---------------------------------------------------------------------------

class LakebaseClient:
    """
    Thin wrapper around psycopg2 for the Lakebase (PostgreSQL-compatible)
    operational database.

    Environment variables
    ---------------------
    LAKEBASE_HOST      — hostname of the Lakebase endpoint
    LAKEBASE_PORT      — port (default: 5432)
    LAKEBASE_DB        — database name (default: energy_copilot)
    LAKEBASE_USER      — database user (default: energy_copilot_app)
    LAKEBASE_PASSWORD  — password

    When LAKEBASE_HOST is not set the client operates in *mock mode*:
    all write operations are no-ops and reads return empty results.
    """

    def __init__(self) -> None:
        self.host     = os.environ.get("LAKEBASE_HOST", "")
        self.port     = int(os.environ.get("LAKEBASE_PORT", "5432"))
        self.dbname   = os.environ.get("LAKEBASE_DB", "energy_copilot")
        self.user     = os.environ.get("LAKEBASE_USER", "energy_copilot_app")
        self.password = os.environ.get("LAKEBASE_PASSWORD", "")
        self.mock_mode = not bool(self.host)

        if self.mock_mode:
            logger.warning(
                "LAKEBASE_HOST is not set — LakebaseClient running in mock mode. "
                "All write operations are no-ops; reads return empty results."
            )

    # ------------------------------------------------------------------ #
    # Internal connection factory                                          #
    # ------------------------------------------------------------------ #

    def _connect(self):
        """Return a psycopg2 connection."""
        try:
            import psycopg2  # type: ignore[import]
            import psycopg2.extras  # type: ignore[import]
        except ImportError as exc:
            raise RuntimeError(
                "psycopg2-binary is not installed. "
                "Run: pip install psycopg2-binary"
            ) from exc

        return psycopg2.connect(
            host=self.host,
            port=self.port,
            dbname=self.dbname,
            user=self.user,
            password=self.password,
            connect_timeout=10,
        )

    @contextmanager
    def _cursor(self):
        """Context manager yielding a psycopg2 DictCursor with auto-commit."""
        import psycopg2.extras  # type: ignore[import]

        conn = self._connect()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                yield cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    # ------------------------------------------------------------------ #
    # Public methods                                                       #
    # ------------------------------------------------------------------ #

    def execute(
        self,
        sql: str,
        params: Optional[Any] = None,
    ) -> List[Dict[str, Any]]:
        """
        Execute a SQL statement and return all rows as a list of dicts.
        Returns an empty list in mock mode.
        """
        if self.mock_mode:
            return []
        with self._cursor() as cur:
            cur.execute(sql, params)
            try:
                return [dict(row) for row in cur.fetchall()]
            except Exception:
                # DDL / DML statements have no result set
                return []

    def execute_one(
        self,
        sql: str,
        params: Optional[Any] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Execute a SQL statement and return the first row as a dict, or None.
        """
        if self.mock_mode:
            return None
        with self._cursor() as cur:
            cur.execute(sql, params)
            try:
                row = cur.fetchone()
                return dict(row) if row else None
            except Exception:
                return None

    def upsert(
        self,
        table: str,
        data: Dict[str, Any],
        conflict_cols: List[str],
    ) -> None:
        """
        INSERT … ON CONFLICT (conflict_cols) DO UPDATE SET … for all
        non-conflict columns.

        Parameters
        ----------
        table         : Fully-qualified table name, e.g. "public.alert_configs"
        data          : Dict mapping column names to values.
        conflict_cols : List of column names that form the unique key.

        No-op in mock mode.
        """
        if self.mock_mode:
            return

        columns      = list(data.keys())
        placeholders = [f"%({col})s" for col in columns]
        update_cols  = [c for c in columns if c not in conflict_cols]

        if not update_cols:
            # Nothing to update — use INSERT … ON CONFLICT DO NOTHING
            sql = (
                f"INSERT INTO {table} ({', '.join(columns)}) "
                f"VALUES ({', '.join(placeholders)}) "
                f"ON CONFLICT ({', '.join(conflict_cols)}) DO NOTHING"
            )
        else:
            update_set = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
            sql = (
                f"INSERT INTO {table} ({', '.join(columns)}) "
                f"VALUES ({', '.join(placeholders)}) "
                f"ON CONFLICT ({', '.join(conflict_cols)}) DO UPDATE SET {update_set}"
            )

        with self._cursor() as cur:
            cur.execute(sql, data)

    def health_check(self) -> bool:
        """
        Return True when the Lakebase connection is healthy.
        Always returns True in mock mode.
        """
        if self.mock_mode:
            return True
        try:
            result = self.execute_one("SELECT 1 AS ping")
            return result is not None and result.get("ping") == 1
        except Exception:
            logger.exception("Lakebase health check failed")
            return False

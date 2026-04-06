"""
delete.py — Delete real estate data for a specific season and optional city.

Removes matching records from transactions, rentals, and etl_log.
This is a destructive operation — only invoked manually via GitHub Actions.

CLI usage:
    python etl/scripts/delete.py --season 112S1
    python etl/scripts/delete.py --season 112S1 --city A
    python etl/scripts/delete.py --season 112S1 --city A,F,H
"""

import argparse
import logging
import sys
from pathlib import Path

# Path setup: add etl/ root so 'import config' works
_script_dir = Path(__file__).resolve().parent
_etl_root = _script_dir.parent
sys.path.insert(0, str(_etl_root))
sys.path.insert(0, str(_script_dir))

import config  # noqa: E402
from load import get_connection  # noqa: E402

logger = logging.getLogger(__name__)


def count_records(season: str, city_codes: list[str] | None, conn) -> dict:
    """Count records that will be deleted (dry-run preview)."""
    counts = {}
    for table in ["transactions", "rentals"]:
        sql = f"SELECT COUNT(*) FROM {table} WHERE source_season = %s"
        params: list = [season]
        if city_codes:
            placeholders = ",".join(["%s"] * len(city_codes))
            sql += f" AND city_code IN ({placeholders})"
            params.extend(city_codes)
        with conn.cursor() as cur:
            cur.execute(sql, params)
            counts[table] = cur.fetchone()[0]

    # etl_log: filter by season and optionally by file_name prefix (city code)
    sql = "SELECT COUNT(*) FROM etl_log WHERE season = %s"
    params = [season]
    if city_codes:
        # etl_log file_name format: '{city_code}_lvr_land_{type}.csv'
        conditions = " OR ".join(["file_name LIKE %s"] * len(city_codes))
        sql += f" AND ({conditions})"
        params.extend([f"{c}_%%" for c in city_codes])
    with conn.cursor() as cur:
        cur.execute(sql, params)
        counts["etl_log"] = cur.fetchone()[0]

    return counts


def delete_records(season: str, city_codes: list[str] | None, conn) -> dict:
    """Delete records for the given season and optional city codes.

    Returns dict with deleted counts per table.
    """
    deleted = {}
    for table in ["transactions", "rentals"]:
        sql = f"DELETE FROM {table} WHERE source_season = %s"
        params: list = [season]
        if city_codes:
            placeholders = ",".join(["%s"] * len(city_codes))
            sql += f" AND city_code IN ({placeholders})"
            params.extend(city_codes)
        with conn.cursor() as cur:
            cur.execute(sql, params)
            deleted[table] = cur.rowcount

    # etl_log
    sql = "DELETE FROM etl_log WHERE season = %s"
    params = [season]
    if city_codes:
        conditions = " OR ".join(["file_name LIKE %s"] * len(city_codes))
        sql += f" AND ({conditions})"
        params.extend([f"{c}_%%" for c in city_codes])
    with conn.cursor() as cur:
        cur.execute(sql, params)
        deleted["etl_log"] = cur.rowcount

    conn.commit()
    return deleted


def main():
    parser = argparse.ArgumentParser(
        description="Delete real estate data for a specific season"
    )
    parser.add_argument("--season", required=True, help="Season to delete, e.g. 112S1")
    parser.add_argument(
        "--city",
        help="City codes to delete (comma-separated, e.g. A,F,H). Omit for all cities.",
    )
    args = parser.parse_args()

    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    city_codes = None
    if args.city:
        city_codes = [c.strip().upper() for c in args.city.split(",")]

    city_label = ",".join(city_codes) if city_codes else "ALL"
    logger.info("Delete target: season=%s city=%s", args.season, city_label)

    conn = get_connection()
    try:
        # Preview: show how many records will be deleted
        counts = count_records(args.season, city_codes, conn)
        logger.info("Records to delete:")
        for table, count in counts.items():
            logger.info("  %s: %d rows", table, count)

        total = sum(counts.values())
        if total == 0:
            logger.info("No records found. Nothing to delete.")
            return

        # Execute delete
        deleted = delete_records(args.season, city_codes, conn)
        logger.info("Deleted:")
        for table, count in deleted.items():
            logger.info("  %s: %d rows", table, count)

        logger.info("Delete complete for season=%s city=%s", args.season, city_label)
    finally:
        conn.close()


if __name__ == "__main__":
    main()

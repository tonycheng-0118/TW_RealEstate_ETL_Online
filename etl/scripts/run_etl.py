"""
run_etl.py — Cloud ETL orchestrator for GitHub Actions.

Chains download → transform → load. No backup step (cloud DB is managed by Supabase).

CLI usage:
    python etl/scripts/run_etl.py --current
    python etl/scripts/run_etl.py --current --city all
    python etl/scripts/run_etl.py --season 114S1
    python etl/scripts/run_etl.py --from 112S1 --to 114S1
"""

import argparse
import logging
import sys
import time
from datetime import datetime
from pathlib import Path

# Path setup: add etl/ root so 'import config' works
_script_dir = Path(__file__).resolve().parent
_etl_root = _script_dir.parent
sys.path.insert(0, str(_etl_root))
sys.path.insert(0, str(_script_dir))

import config  # noqa: E402

from download import download_season, download_current, parse_season_range  # noqa: E402
from transform import process_season, process_current  # noqa: E402
from load import (  # noqa: E402
    get_connection,
    check_already_loaded,
    upsert_transactions,
    upsert_rentals,
    log_etl,
)

logger = logging.getLogger(__name__)


def setup_logging():
    """Configure logging to console (GitHub Actions captures stdout)."""
    root = logging.getLogger()
    root.setLevel(logging.DEBUG)

    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    root.addHandler(ch)


def _load_dataframes(dataframes: dict, season: str, conn) -> dict:
    """Load all DataFrames for a season into the database.

    Returns a summary dict: {file_name: {"rows": int, "status": str}}.
    Each file is processed independently — a failure in one does not block others.
    """
    summary = {}
    for key, df in dataframes.items():
        parts = key.split("_")
        city_code = parts[0]
        file_type = parts[1]
        file_name = f"{city_code}_lvr_land_{file_type}.csv"

        if check_already_loaded(season, file_name, conn):
            logger.info("Already loaded %s/%s, skipping", season, file_name)
            summary[file_name] = {"rows": 0, "status": "skipped"}
            continue

        started_at = datetime.now()
        try:
            if file_type in ("a", "b"):
                count = upsert_transactions(df, conn)
            else:
                count = upsert_rentals(df, conn)

            log_etl(season, file_name, count, "success", started_at, conn)
            summary[file_name] = {"rows": count, "status": "success"}

        except Exception as e:
            logger.error("Failed to load %s/%s: %s", season, file_name, e, exc_info=True)
            conn.rollback()
            log_etl(season, file_name, 0, "failed", started_at, conn)
            summary[file_name] = {"rows": 0, "status": "failed"}

    return summary


def run_etl(seasons: list[str], is_current: bool = False) -> dict:
    """Run the full ETL pipeline for a list of seasons."""
    overall = {}
    conn = get_connection()

    try:
        if is_current:
            logger.info("=== Processing current period ===")
            try:
                download_current()
                dataframes = process_current()
                summary = _load_dataframes(dataframes, "current", conn)
                overall["current"] = summary
            except Exception as e:
                logger.error("Failed to process current period: %s", e, exc_info=True)
                overall["current"] = {"error": str(e)}
        else:
            for i, season in enumerate(seasons):
                logger.info("=== Processing season %s (%d/%d) ===", season, i + 1, len(seasons))
                try:
                    download_season(season)
                    dataframes = process_season(season)
                    summary = _load_dataframes(dataframes, season, conn)
                    overall[season] = summary
                except Exception as e:
                    logger.error("Failed to process season %s: %s", season, e, exc_info=True)
                    overall[season] = {"error": str(e)}

                if i < len(seasons) - 1:
                    logger.info("Waiting %d seconds...", config.DOWNLOAD_DELAY_SEC)
                    time.sleep(config.DOWNLOAD_DELAY_SEC)
    finally:
        conn.close()

    return overall


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="TW RealEstate ETL (Cloud) — Download, transform, load"
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--season", help="Single season, e.g. 114S1")
    group.add_argument("--current", action="store_true", help="Process current period")
    parser.add_argument("--from", dest="from_s", help="Range start, e.g. 112S1")
    parser.add_argument("--to", dest="to_s", help="Range end, e.g. 114S1")
    parser.add_argument(
        "--city",
        help="Override city codes. Comma-separated, e.g. A,F,H. Use 'all' for every city.",
    )
    args = parser.parse_args()

    setup_logging()

    # Override city codes if --city is provided
    if args.city:
        if args.city.lower() == "all":
            config.TARGET_CITY_CODES = None
            logger.info("City override: ALL cities")
        else:
            config.TARGET_CITY_CODES = [c.strip().upper() for c in args.city.split(",")]
            logger.info("City override: %s", config.TARGET_CITY_CODES)

    logger.info("ETL started at %s", datetime.now().isoformat())

    if not (args.season or args.current or (args.from_s and args.to_s)):
        parser.error("Specify --season, --from/--to, or --current")

    if bool(args.from_s) != bool(args.to_s):
        parser.error("--from and --to must be used together")

    # Run ETL
    if args.current:
        overall = run_etl([], is_current=True)
    elif args.from_s and args.to_s:
        seasons = parse_season_range(args.from_s, args.to_s)
        overall = run_etl(seasons)
    else:
        overall = run_etl([args.season])

    # Print summary
    logger.info("=== ETL Summary ===")
    for season, info in overall.items():
        if isinstance(info, dict) and "error" in info:
            logger.error("  %s: ERROR — %s", season, info["error"])
        else:
            for fname, detail in info.items():
                logger.info("  %s/%s: %s (%d rows)", season, fname, detail["status"], detail["rows"])

    logger.info("ETL finished at %s", datetime.now().isoformat())


if __name__ == "__main__":
    main()

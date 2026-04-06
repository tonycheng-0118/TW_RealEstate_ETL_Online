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

from download import download_season, download_current  # noqa: E402
from season_utils import get_current_season, resolve_params, season_range  # noqa: E402
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
            current_season = get_current_season()
            logger.info("=== Processing current period (tagged as %s) ===", current_season)
            try:
                download_current()
                dataframes = process_current()
                summary = _load_dataframes(dataframes, current_season, conn)
                overall[current_season] = summary
            except Exception as e:
                logger.error("Failed to process current period: %s", e, exc_info=True)
                overall[current_season] = {"error": str(e)}
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
    parser.add_argument("--start", help="Start season, e.g. 113S1. Empty = current.")
    parser.add_argument("--end", help="End season, e.g. 114S4. Empty = start through current.")
    # Legacy flags (still supported for backward compat)
    parser.add_argument("--season", help="(Legacy) Single season, e.g. 114S1")
    parser.add_argument("--current", action="store_true", help="(Legacy) Process current period")
    parser.add_argument("--from", dest="from_s", help="(Legacy) Range start")
    parser.add_argument("--to", dest="to_s", help="(Legacy) Range end")
    parser.add_argument(
        "--city",
        help="City codes. Comma-separated, e.g. A,F,H. Use 'all' for every city.",
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

    # Resolve season parameters (new --start/--end or legacy flags)
    if args.start or args.end:
        # New style: --start / --end
        try:
            start, end, is_current = resolve_params(args.start, args.end)
        except ValueError as e:
            parser.error(str(e))
    elif args.current:
        start, end, is_current = resolve_params(None, None)
    elif args.from_s and args.to_s:
        start, end, is_current = resolve_params(args.from_s, args.to_s)
    elif args.season:
        start, end, is_current = resolve_params(args.season, args.season)
    else:
        # No args = current
        start, end, is_current = resolve_params(None, None)

    logger.info("Resolved: start=%s end=%s is_current=%s", start, end, is_current)

    # Build season list and run
    if is_current:
        overall = run_etl([], is_current=True)
    elif start == end:
        overall = run_etl([start])
    else:
        seasons = season_range(start, end)
        # If end == current season, also download current period for latest data
        current = get_current_season()
        if end == current:
            # Run historical seasons first, then current
            historical = [s for s in seasons if s != current]
            overall = run_etl(historical) if historical else {}
            current_result = run_etl([], is_current=True)
            overall.update(current_result)
        else:
            overall = run_etl(seasons)

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

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.statistics_service import (
    ALL_METRIC_COLUMNS,
    STALE_SYNC_THRESHOLD,
    _impact_score,
    _totals_dict,
    extract_metric_columns,
    needs_sync,
)


def _metric_row(**overrides):
    values = {c: None for c in ALL_METRIC_COLUMNS}
    values.update(overrides)
    return SimpleNamespace(**values)


def test_extract_metric_columns_maps_known_types():
    metrics = [
        {"type": "reactions", "name": "Reactions", "value": 12.0, "unit": "count"},
        {"type": "engagementRate", "name": "Eng. Rate", "value": 3.5, "unit": "percentage"},
    ]
    columns = extract_metric_columns(metrics)
    assert columns == {"reactions": 12.0, "engagement_rate": 3.5}


def test_extract_metric_columns_ignores_unknown_types():
    metrics = [{"type": "some_future_metric_type", "name": "?", "value": 1.0, "unit": "count"}]
    assert extract_metric_columns(metrics) == {}


def test_needs_sync_when_never_synced():
    assert needs_sync(existing=None, force=False) is True


def test_needs_sync_forced_even_if_fresh():
    fresh = SimpleNamespace(last_synced_at=datetime.now(timezone.utc))
    assert needs_sync(existing=fresh, force=True) is True


def test_needs_sync_false_within_threshold():
    recent = SimpleNamespace(last_synced_at=datetime.now(timezone.utc) - timedelta(hours=1))
    assert needs_sync(existing=recent, force=False) is False


def test_needs_sync_true_past_threshold():
    stale_at = datetime.now(timezone.utc) - STALE_SYNC_THRESHOLD - timedelta(minutes=1)
    stale = SimpleNamespace(last_synced_at=stale_at)
    assert needs_sync(existing=stale, force=False) is True


def test_totals_dict_sums_plain_metrics():
    rows = [_metric_row(views=100.0), _metric_row(views=50.0), _metric_row(views=None)]
    totals = _totals_dict(rows)
    assert totals["views"] == 150.0


def test_totals_dict_averages_engagement_rate_not_sums():
    rows = [_metric_row(engagement_rate=10.0), _metric_row(engagement_rate=20.0)]
    totals = _totals_dict(rows)
    assert totals["engagement_rate"] == 15.0


def test_totals_dict_missing_metric_stays_none():
    rows = [_metric_row(), _metric_row()]
    totals = _totals_dict(rows)
    assert totals["views"] is None
    assert totals["engagement_rate"] is None


def test_impact_score_ignores_engagement_rate():
    totals = {"views": 100.0, "reactions": 10.0, "engagement_rate": 99.0}
    assert _impact_score(totals) == 110.0


def test_impact_score_treats_missing_as_zero():
    totals = {c: None for c in ALL_METRIC_COLUMNS}
    assert _impact_score(totals) == 0

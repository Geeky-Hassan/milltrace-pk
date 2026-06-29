from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any


def dump_value(value: Any) -> str:
    return json.dumps(value, default=str, sort_keys=True)


def parse_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def to_csv(values: list[str]) -> str:
    return ",".join(values)


def serial_range(values: list[str]) -> str:
    if not values:
        return ""
    if len(values) == 1:
        return values[0]
    return f"{values[0]} - {values[-1]}"


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)

"""Environment settings for the deployed OreFlow service."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


@dataclass
class Settings:
    app_env: str = os.getenv("APP_ENV", "dev")
    app_host: str = os.getenv("APP_HOST", "127.0.0.1")
    app_port: int = int(os.getenv("APP_PORT", "8146"))
    dev_origins: str = os.getenv("DEV_ORIGINS", "http://localhost:5914")
    prod_origins: str = os.getenv("PROD_ORIGINS", "https://oreflow.ml.fasl-work.com")
    data_dir: str = os.getenv("DATA_DIR", "data/derived")


def origins(settings: Settings) -> list[str]:
    raw = settings.dev_origins if settings.app_env == "dev" else settings.prod_origins
    return [item.strip() for item in raw.split(",") if item.strip()]

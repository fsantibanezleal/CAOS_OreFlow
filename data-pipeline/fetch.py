#!/usr/bin/env python3
"""Explicit acquisition of pinned measured sources into an external cache."""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
from urllib.request import urlopen

from pipeline.io.storage import checkpoint_directory, raw_directory, source_path

HZDR_FILE = "SM1.Constructed_cases_data.xlsx"
HZDR_SHA256 = "1559e6c5fabd30988ea0de60bbdf04a750f7895401ffc31da974ea4477aa50b0"
SOURCES = {
    "hzdr": [(HZDR_FILE, "https://rodare.hzdr.de/record/336/files/SM1.Constructed%20cases%20data.xlsx?download=1",
              "sha256", HZDR_SHA256)],
    "geomet": [(f"geomet-{name}.csv", f"https://zenodo.org/api/records/7051975/files/{name}.csv/content", "md5", digest)
               for name, digest in (("flotation", "f2e90da6bfa81de1261177ee85a91570"),
                                    ("comminution", "1a33df8ba77f5d49c281ba3fff16b20b"),
                                    ("drillholes", "bf48a6b1135113b6e6cf7b32f95315ad"))],
    "iron-plant": [("iron-flotation-kaggle-v1.zip",
                    "https://www.kaggle.com/api/v1/datasets/download/edumagalhaes/quality-prediction-in-a-mining-process?datasetVersionNumber=1",
                    "sha256", "fa1fb0c928d84366ec1bd315e0ed1380f5d5576525603458b49ea4cfe446d98e")],
}


def fetch(dataset: str = "all", data_root: Path | None = None) -> list[Path]:
    raw_directory(data_root)  # fail before network or writes
    paths = []
    for group in (SOURCES if dataset == "all" else (dataset,)):
        for filename, url, algorithm, expected in SOURCES[group]:
            path = source_path(filename, data_root=data_root)
            data = path.read_bytes() if path.is_file() else _download(url)
            actual = hashlib.new(algorithm, data).hexdigest()
            if actual != expected:
                raise ValueError(f"{filename} checksum drift: {actual}; existing files are never overwritten")
            if not path.is_file():
                path.parent.mkdir(parents=True, exist_ok=True)
                try:
                    with path.open("xb") as stream:
                        stream.write(data)
                except FileExistsError:
                    if hashlib.new(algorithm, path.read_bytes()).hexdigest() != expected:
                        raise ValueError(f"{filename} checksum drift in concurrently populated cache") from None
            paths.append(path)
            print(f"Verified {filename}: {actual}")
    return paths


def _download(url: str) -> bytes:
    with urlopen(url, timeout=120) as response:
        return response.read()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-root", type=Path, help="external data root (or CAOS_DATA_ROOT)")
    parser.add_argument("--models-root", type=Path, help="external checkpoint root (or CAOS_MODELS_ROOT)")
    parser.add_argument("--dataset", choices=("all", *SOURCES), default="all")
    parser.add_argument("--check-paths", action="store_true", help="validate both roots without downloads or writes")
    args = parser.parse_args()
    if args.check_paths:
        print(f"Raw cache: {raw_directory(args.data_root)}")
        print(f"Checkpoints: {checkpoint_directory(args.models_root)}")
    else:
        fetch(args.dataset, args.data_root)


if __name__ == "__main__":
    main()

"""Direct-route fallback is required by the fixed-page app contract."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import __version__
from app.main import create_app
from app.main import SpaStaticFiles


def test_service_version_matches_package() -> None:
    client = TestClient(create_app())
    assert client.get("/healthz").json()["version"] == __version__
    assert client.get("/openapi.json").json()["info"]["version"] == __version__


import pytest


@pytest.mark.parametrize("with_404_page", [False, True])
def test_document_routes_fallback_without_masking_missing_assets(tmp_path, with_404_page):
    """The build has written no 404.html since 0.08.000 (the Pages build path went): 0.08.000 then answered a direct
    /methodology with 404 on the VPS, because Starlette raises on a miss when no 404.html exists, and this test had
    always written one."""
    (tmp_path / "index.html").write_text("<title>OreFlow</title>", encoding="utf-8")
    if with_404_page:
        (tmp_path / "404.html").write_text("missing", encoding="utf-8")
    app = FastAPI()
    app.mount("/", SpaStaticFiles(directory=tmp_path, html=True))
    client = TestClient(app)
    for route in ("/methodology", "/methodology/", "/implementation", "/experiments", "/benchmark", "/introduction",
                  "/focus/copper_porphyry_soft"):
        response = client.get(route)
        assert response.status_code == 200, route
        assert "OreFlow" in response.text
    assert client.get("/assets/missing.js").status_code == 404
    assert client.get("/api/missing").status_code == 404


def test_the_runtime_module_is_served_as_javascript(tmp_path):
    """The ONNX runtime is a JavaScript module: served as text/plain (Windows' type table) the browser refuses it and
    the learned lane never loads. The service declares the types itself."""
    import mimetypes

    from app import main  # noqa: F401  (registers the types)

    (tmp_path / "index.html").write_text("<title>OreFlow</title>", encoding="utf-8")
    (tmp_path / "ort").mkdir()
    (tmp_path / "ort" / "runtime.mjs").write_text("export {};", encoding="utf-8")
    (tmp_path / "ort" / "runtime.wasm").write_bytes(b"\0asm")
    mimetypes.add_type("text/plain", ".mjs")  # a host table that gets it wrong, as Windows' does
    from importlib import reload
    reload(main)
    app = FastAPI()
    app.mount("/", SpaStaticFiles(directory=tmp_path, html=True))
    client = TestClient(app)
    assert client.get("/ort/runtime.mjs").headers["content-type"].startswith("text/javascript")
    assert client.get("/ort/runtime.wasm").headers["content-type"].startswith("application/wasm")


def test_the_built_site_has_no_404_page():
    """The service's fallback is what answers deep links; the build writes no Pages 404.html (one deploy path)."""
    from pathlib import Path
    dist = Path(__file__).resolve().parents[1] / "frontend" / "dist"
    if dist.is_dir():
        assert not (dist / "404.html").exists()

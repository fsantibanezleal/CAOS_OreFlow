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


def test_document_routes_fallback_without_masking_missing_assets(tmp_path):
    (tmp_path / "index.html").write_text("<title>OreFlow</title>", encoding="utf-8")
    (tmp_path / "404.html").write_text("missing", encoding="utf-8")
    app = FastAPI()
    app.mount("/", SpaStaticFiles(directory=tmp_path, html=True))
    client = TestClient(app)
    for route in ("/methodology", "/implementation", "/experiments", "/benchmark"):
        response = client.get(route)
        assert response.status_code == 200
        assert "OreFlow" in response.text
    assert client.get("/assets/missing.js").status_code == 404
    assert client.get("/api/missing").status_code == 404

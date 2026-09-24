"""OreFlow service: static SPA plus read-only artifacts and bounded live API."""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from .config import Settings, origins
from .routers import content


class SpaStaticFiles(StaticFiles):
    """Serve the SPA for document routes, without masking missing assets or API paths."""

    async def get_response(self, path: str, scope: dict) -> Response:
        response = await super().get_response(path, scope)
        if (response.status_code == 404 and scope.get("method") == "GET"
                and not scope.get("path", "").startswith("/api/") and not Path(path).suffix):
            return FileResponse(Path(self.directory) / "index.html", media_type="text/html")
        return response


def create_app() -> FastAPI:
    settings = Settings()
    app = FastAPI(title="OreFlow process intelligence", version="0.02.000")
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(CORSMiddleware, allow_origins=origins(settings) or ["*"], allow_methods=["GET", "POST"], allow_headers=["*"])
    app.include_router(content.router)

    @app.get("/health")
    @app.get("/healthz")
    def health() -> dict:
        return {"status": "ok", "service": "oreflow", "version": "0.02.000"}

    dist = Path(__file__).resolve().parents[1] / "frontend" / "dist"
    if dist.exists():
        app.mount("/", SpaStaticFiles(directory=dist, html=True), name="oreflow-spa")
    else:
        @app.get("/")
        def missing_build() -> JSONResponse:
            return JSONResponse({"status": "ok", "service": "oreflow", "message": "frontend/dist is not built"})
    return app


app = create_app()

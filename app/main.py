"""OreFlow service: static SPA plus read-only artifacts and bounded live API."""
from __future__ import annotations

import mimetypes
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from starlette.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from . import __version__
from .config import Settings, origins
from .routers import content

# The browser runs the ONNX runtime as a JavaScript module, which it refuses unless it is served as JavaScript.
# Starlette takes the type from the host's table: Linux maps .mjs to text/javascript, while Windows maps it to
# text/plain, and the learned lane never loaded when the service ran there (the 0.08.001 release gate). The service
# declares the types it depends on instead of inheriting them.
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("application/wasm", ".wasm")


class SpaStaticFiles(StaticFiles):
    """Serve the SPA for document routes, without masking missing assets or API paths.

    Starlette's StaticFiles in html mode answers a missing path with a 404 response only when the build holds a
    404.html, and raises otherwise. The fallback took the raise for granted away: until 0.08.000 the GitHub Pages
    build wrote a 404.html, and once that build path was removed, a direct request for /methodology answered 404 on
    the VPS. Both forms of the miss now fall back to the app."""

    async def get_response(self, path: str, scope: dict) -> Response:
        try:
            response = await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
            response = None
        if ((response is None or response.status_code == 404) and scope.get("method") == "GET"
                and not scope.get("path", "").startswith("/api/") and not Path(path).suffix):
            return FileResponse(Path(self.directory) / "index.html", media_type="text/html")
        if response is None:
            raise HTTPException(status_code=404)
        return response


def create_app() -> FastAPI:
    settings = Settings()
    app = FastAPI(title="OreFlow process intelligence", version=__version__)
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(CORSMiddleware, allow_origins=origins(settings) or ["*"], allow_methods=["GET", "POST"], allow_headers=["*"])
    app.include_router(content.router)

    @app.get("/health")
    @app.get("/healthz")
    def health() -> dict:
        return {"status": "ok", "service": "oreflow", "version": __version__}

    dist = Path(__file__).resolve().parents[1] / "frontend" / "dist"
    if dist.exists():
        app.mount("/", SpaStaticFiles(directory=dist, html=True), name="oreflow-spa")
    else:
        @app.get("/")
        def missing_build() -> JSONResponse:
            return JSONResponse({"status": "ok", "service": "oreflow", "message": "frontend/dist is not built"})
    return app


app = create_app()

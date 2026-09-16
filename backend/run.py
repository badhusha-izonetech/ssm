import uvicorn

if __name__ == "__main__":
    # We disable Uvicorn's default logging configuration by passing log_config=None.
    # This bypasses a known bug on Windows where Python's logging dictConfig fails 
    # to resolve sys.stderr/sys.stdout during a multiprocessing spawn on reload.
    # Our application already sets up its own structured logging in the FastAPI lifespan 
    # (see app/core/logging.py), so Uvicorn's default config is not needed.
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_config=None
    )

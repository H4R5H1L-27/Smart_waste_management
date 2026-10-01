import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("WASTE_DB_PATH", str(Path(__file__).with_name("_test.db")))
os.environ.setdefault("WASTE_SKIP_SIMULATOR", "1")

# Import after env so db.db_path() points at the test file.
from main import app  # noqa: E402
from db import init_db  # noqa: E402
from simulate import seed_bins  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    test_db = Path(__file__).with_name("_test.db")
    if test_db.exists():
        try:
            test_db.unlink()
        except OSError:
            pass
    init_db()
    seed_bins()
    yield
    if test_db.exists():
        try:
            test_db.unlink()
        except OSError:
            pass


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

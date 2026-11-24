import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_accord360.db")

from configparser import ConfigParser

import pytest
from sqlalchemy.engine import make_url

from app.core.config import resolve_database_url, sqlalchemy_database_url

DB_VARS = ("DATABASE_URL", "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME")


@pytest.fixture
def clean_db_env(monkeypatch):
    for name in DB_VARS:
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


def set_split_vars(env, password):
    env.setenv("DB_HOST", "accord-db")
    env.setenv("DB_PORT", "5432")
    env.setenv("DB_USER", "accord360")
    env.setenv("DB_PASSWORD", password)
    env.setenv("DB_NAME", "accord360")


def test_split_variables_escape_special_characters(clean_db_env):
    password = "p@ss:w/rd%41#?@"
    set_split_vars(clean_db_env, password)

    url = make_url(sqlalchemy_database_url(resolve_database_url()))

    assert url.drivername == "postgresql+psycopg"
    assert url.host == "accord-db"
    assert url.port == 5432
    assert url.username == "accord360"
    assert url.password == password
    assert url.database == "accord360"


def test_split_url_survives_alembic_config_interpolation(clean_db_env):
    password = "p@ss%40word@"
    set_split_vars(clean_db_env, password)
    rendered = sqlalchemy_database_url(resolve_database_url())

    # Mirrors migrations/env.py: alembic stores the URL in a ConfigParser.
    parser = ConfigParser()
    parser.add_section("alembic")
    parser.set("alembic", "sqlalchemy.url", rendered.replace("%", "%%"))

    assert make_url(parser.get("alembic", "sqlalchemy.url")).password == password


def test_database_url_takes_precedence_over_split_variables(clean_db_env):
    set_split_vars(clean_db_env, "secret")
    clean_db_env.setenv("DATABASE_URL", "sqlite:///./explicit.db")

    assert resolve_database_url() == "sqlite:///./explicit.db"


def test_defaults_to_sqlite_without_database_settings(clean_db_env):
    assert resolve_database_url() == "sqlite:///./accord360.db"

from collections.abc import Generator

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, pool_pre_ping=True, poolclass=NullPool)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def repair_demo_schema_if_needed() -> bool:
    if not settings.repair_demo_schema_on_startup:
        return False

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if not table_names.intersection({"roles", "mills", "users"}):
        return False

    required_columns = {
        "roles": {"id", "code", "name"},
        "mills": {"id", "code", "name", "expected_recovery_percentage"},
        "users": {"id", "name", "email", "role_id", "mill_id"},
    }

    for table_name, columns in required_columns.items():
        if table_name not in table_names:
            continue
        existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
        if not columns.issubset(existing_columns):
            # MVP demo repair only: rebuild incompatible seed schemas from older deployments.
            Base.metadata.drop_all(bind=engine)
            return True
    return False


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

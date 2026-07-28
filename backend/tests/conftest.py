import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.auth import hash_pin, create_token
from app.models import Category, Item, User

SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Enable foreign keys for SQLite in tests
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db):
    user = User(name="Admin", pin_hash=hash_pin("1234"), role="admin")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def staff_user(db):
    user = User(name="Staff", pin_hash=hash_pin("5678"), role="staff")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user):
    return create_token(admin_user.id, admin_user.role)


@pytest.fixture
def staff_token(staff_user):
    return create_token(staff_user.id, staff_user.role)


@pytest.fixture
def admin_client(client, admin_token):
    client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return client


@pytest.fixture
def staff_client(client, staff_token):
    client.headers.update({"Authorization": f"Bearer {staff_token}"})
    return client


@pytest.fixture
def category_cafe(db):
    cat = Category(name="Cafe", position=0)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@pytest.fixture
def category_panaderia(db):
    cat = Category(name="Panadería", position=1)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@pytest.fixture
def item_coffee(db, category_cafe):
    item = Item(
        name="Ethiopia Yirgacheffe 1kg",
        category_id=category_cafe.id,
        unit="unidad",
        cost_per_unit=18.50,
        is_produced=False,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture
def item_croissant(db, category_panaderia):
    item = Item(
        name="Croissant mantequilla",
        category_id=category_panaderia.id,
        unit="unidad",
        cost_per_unit=0.85,
        is_produced=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

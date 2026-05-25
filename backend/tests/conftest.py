import pytest

from app import create_app
from app.config import TestConfig
from app.extensions import db
from app.models import User, UserRole, UserStatus
from app.security.token_blocklist import clear_revoked_for_tests


@pytest.fixture(autouse=True)
def _clear_jwt_blocklist():
    clear_revoked_for_tests()
    yield
    clear_revoked_for_tests()


@pytest.fixture()
def app(tmp_path):
    class DBTestConfig(TestConfig):
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{tmp_path / 'psc_test.db'}"

    application = create_app(DBTestConfig)
    yield application
    with application.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def admin_headers(client):
    """Create admin user and return Authorization headers."""
    with client.application.app_context():
        u = User(
            name="tadmin",
            email="tadmin@example.com",
            role=UserRole.ADMIN,
            status=UserStatus.ACTIVE,
        )
        u.set_password("AdminPassword!99")
        db.session.add(u)
        db.session.commit()
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "tadmin", "password": "AdminPassword!99"},
    )
    assert resp.status_code == 200
    token = resp.get_json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def user_headers(client):
    with client.application.app_context():
        u = User(
            name="tuser",
            email="tuser@example.com",
            role=UserRole.USER,
            status=UserStatus.ACTIVE,
        )
        u.set_password("UserPassword!99")
        db.session.add(u)
        db.session.commit()
    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "tuser", "password": "UserPassword!99"},
    )
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.get_json()['access_token']}"}

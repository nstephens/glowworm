"""
Pytest configuration for daemon tests.
"""
import pytest


# Configure pytest-asyncio to auto-detect async tests
pytest_plugins = ("pytest_asyncio",)


@pytest.fixture(scope="session")
def event_loop_policy():
    """Use default event loop policy."""
    import asyncio
    return asyncio.DefaultEventLoopPolicy()

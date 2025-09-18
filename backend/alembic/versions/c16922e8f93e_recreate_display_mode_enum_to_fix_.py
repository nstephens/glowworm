"""Recreate display_mode enum to fix caching issue

Revision ID: c16922e8f93e
Revises: eb81ce2b6740
Create Date: 2025-09-14 02:52:00.300126

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c16922e8f93e'
down_revision: Union[str, Sequence[str], None] = 'eb81ce2b6740'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

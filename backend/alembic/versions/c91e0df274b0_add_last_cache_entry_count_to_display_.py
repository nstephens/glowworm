"""add_last_cache_entry_count_to_display_devices

Revision ID: c91e0df274b0
Revises: 2024111000_exec_tracking
Create Date: 2026-02-28 18:29:15.739419

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c91e0df274b0'
down_revision: Union[str, Sequence[str], None] = '2024111000_exec_tracking'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'display_devices',
        sa.Column('last_cache_entry_count', sa.Integer(), nullable=True,
                  comment='Number of cached images')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('display_devices', 'last_cache_entry_count')

"""add_new_display_modes_to_playlist

Revision ID: 255babe9922e
Revises: c2d3e4f5g6h7
Create Date: 2025-11-03 11:51:28.944036

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '255babe9922e'
down_revision: Union[str, Sequence[str], None] = 'c2d3e4f5g6h7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # For MySQL, we need to ALTER the column to add new enum values
    # This replaces the entire enum definition with all values (old + new)
    op.alter_column(
        'playlists',
        'display_mode',
        existing_type=sa.Enum(
            'default',
            'auto_sort',
            'movement',
            'ken_burns_plus',
            'soft_glow',
            'ambient_pulse',
            'dreamy_reveal',
            'stacked_reveal',
            'parallax_depth',
            'color_harmony',
            'cinematic_bars',
            'magic_dust',
            'liquid_blend',
            name='displaymode'
        ),
        nullable=True
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Revert to the original enum values (only default, auto_sort, movement)
    # WARNING: This will fail if any playlists are using the new display modes
    op.alter_column(
        'playlists',
        'display_mode',
        existing_type=sa.Enum(
            'default',
            'auto_sort',
            'movement',
            name='displaymode'
        ),
        nullable=True
    )

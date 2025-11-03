"""add_dominant_colors_to_images

Revision ID: 75b7a1da5c06
Revises: 255babe9922e
Create Date: 2025-11-03 12:29:17.333971

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75b7a1da5c06'
down_revision: Union[str, Sequence[str], None] = '255babe9922e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add dominant_colors JSON column to images table
    op.add_column('images', sa.Column('dominant_colors', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove dominant_colors column from images table
    op.drop_column('images', 'dominant_colors')

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
    # Check if dominant_colors column already exists before adding it
    connection = op.get_bind()
    result = connection.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'images' AND column_name = 'dominant_colors'"
    ))
    column_exists = result.scalar() > 0
    
    if not column_exists:
        op.add_column('images', sa.Column('dominant_colors', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove dominant_colors column from images table
    op.drop_column('images', 'dominant_colors')

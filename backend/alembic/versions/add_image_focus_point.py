"""Add focus point columns to images table

Revision ID: add_focus_point_001
Revises: d1e2f3g4h5i6
Create Date: 2026-03-01

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_focus_point_001'
down_revision = 'd1e2f3g4h5i6'
branch_labels = None
depends_on = None


def upgrade():
    # Add focus point columns for smart cropping
    # Values are 0.0 to 1.0 representing percentage from top-left
    # Default 0.5 = center (fallback if saliency detection not run)
    op.add_column('images', sa.Column('focus_x', sa.Float(), nullable=True, server_default='0.5'))
    op.add_column('images', sa.Column('focus_y', sa.Float(), nullable=True, server_default='0.5'))


def downgrade():
    op.drop_column('images', 'focus_y')
    op.drop_column('images', 'focus_x')

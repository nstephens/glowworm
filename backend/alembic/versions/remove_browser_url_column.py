"""Remove browser_url column from display_devices

v3.0 uses Pi3D native display, no longer browser-based.
The browser_url column is no longer needed.

Revision ID: remove_browser_url_001
Revises: add_focus_point_001
Create Date: 2026-03-03

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'remove_browser_url_001'
down_revision = 'add_focus_point_001'
branch_labels = None
depends_on = None


def upgrade():
    # Remove browser_url column - no longer used in Pi3D v3.0
    op.drop_column('display_devices', 'browser_url')


def downgrade():
    # Re-add browser_url column if reverting
    op.add_column('display_devices', sa.Column('browser_url', sa.String(length=512), nullable=True, comment='Current browser URL for remote updates'))

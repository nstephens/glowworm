"""Add Pi3D device status columns

Revision ID: d1e2f3g4h5i6
Revises: c91e0df274b0
Create Date: 2026-03-01 09:25:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd1e2f3g4h5i6'
down_revision = 'c91e0df274b0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add Pi3D device columns to display_devices table
    op.add_column('display_devices', sa.Column('device_type', sa.String(20), nullable=True, comment='Device type: browser or pi3d'))
    op.add_column('display_devices', sa.Column('last_state', sa.String(32), nullable=True, comment='Last reported state: playing, paused, stopped, error'))
    op.add_column('display_devices', sa.Column('last_image_id', sa.Integer(), nullable=True, comment='ID of currently displayed image'))
    op.add_column('display_devices', sa.Column('last_cache_size_mb', sa.Float(), nullable=True, comment='Cache size in MB'))
    op.add_column('display_devices', sa.Column('last_cache_hit_rate', sa.Float(), nullable=True, comment='Cache hit rate 0-1'))
    op.add_column('display_devices', sa.Column('last_uptime_seconds', sa.Float(), nullable=True, comment='Daemon uptime in seconds'))
    op.add_column('display_devices', sa.Column('last_status_json', sa.Text(), nullable=True, comment='Full status JSON blob'))

    # Set default device_type for existing devices
    op.execute("UPDATE display_devices SET device_type = 'browser' WHERE device_type IS NULL")


def downgrade() -> None:
    op.drop_column('display_devices', 'last_status_json')
    op.drop_column('display_devices', 'last_uptime_seconds')
    op.drop_column('display_devices', 'last_cache_hit_rate')
    op.drop_column('display_devices', 'last_cache_size_mb')
    op.drop_column('display_devices', 'last_image_id')
    op.drop_column('display_devices', 'last_state')
    op.drop_column('display_devices', 'device_type')

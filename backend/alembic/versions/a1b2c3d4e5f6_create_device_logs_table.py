"""Create device_logs table for remote display troubleshooting

Revision ID: a1b2c3d4e5f6
Revises: 2cfb3ac760a2
Create Date: 2025-11-02 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '2cfb3ac760a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create device_logs table."""
    op.create_table(
        'device_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('log_level', sa.Enum('debug', 'info', 'warning', 'error', 'critical', name='loglevel'), nullable=False, server_default='info'),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('context', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['device_id'], ['display_devices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for efficient querying
    op.create_index('ix_device_logs_id', 'device_logs', ['id'])
    op.create_index('ix_device_logs_device_id', 'device_logs', ['device_id'])
    op.create_index('ix_device_logs_log_level', 'device_logs', ['log_level'])
    op.create_index('ix_device_logs_created_at', 'device_logs', ['created_at'])
    
    # Create composite index for common query patterns (device + time)
    op.create_index('ix_device_logs_device_time', 'device_logs', ['device_id', 'created_at'])


def downgrade() -> None:
    """Drop device_logs table."""
    op.drop_index('ix_device_logs_device_time', table_name='device_logs')
    op.drop_index('ix_device_logs_created_at', table_name='device_logs')
    op.drop_index('ix_device_logs_log_level', table_name='device_logs')
    op.drop_index('ix_device_logs_device_id', table_name='device_logs')
    op.drop_index('ix_device_logs_id', table_name='device_logs')
    op.drop_table('device_logs')


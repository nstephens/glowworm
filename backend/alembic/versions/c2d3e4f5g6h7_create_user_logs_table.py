"""Create user_logs table for webapp user activity tracking

Revision ID: c2d3e4f5g6h7
Revises: b2c3d4e5f6g7
Create Date: 2025-11-03 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c2d3e4f5g6h7'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6g7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create user_logs table."""
    op.create_table(
        'user_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('log_level', sa.Enum('DEBUG', 'INFO', 'WARNING', 'ERROR', name='userloglevel'), nullable=False, server_default='INFO'),
        sa.Column('action', sa.Enum('LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'UPLOAD', 'DOWNLOAD', 'ERROR', 'OTHER', name='userlogaction'), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('context', sa.JSON(), nullable=True),
        sa.Column('url', sa.String(length=500), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for efficient querying
    op.create_index('ix_user_logs_id', 'user_logs', ['id'])
    op.create_index('ix_user_logs_user_id', 'user_logs', ['user_id'])
    op.create_index('ix_user_logs_log_level', 'user_logs', ['log_level'])
    op.create_index('ix_user_logs_action', 'user_logs', ['action'])
    op.create_index('ix_user_logs_created_at', 'user_logs', ['created_at'])
    
    # Create composite index for common query patterns (user + time)
    op.create_index('ix_user_logs_user_time', 'user_logs', ['user_id', 'created_at'])


def downgrade() -> None:
    """Drop user_logs table."""
    op.drop_index('ix_user_logs_user_time', table_name='user_logs')
    op.drop_index('ix_user_logs_created_at', table_name='user_logs')
    op.drop_index('ix_user_logs_action', table_name='user_logs')
    op.drop_index('ix_user_logs_log_level', table_name='user_logs')
    op.drop_index('ix_user_logs_user_id', table_name='user_logs')
    op.drop_index('ix_user_logs_id', table_name='user_logs')
    op.drop_table('user_logs')


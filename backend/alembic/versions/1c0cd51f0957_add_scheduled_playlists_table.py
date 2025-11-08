"""add scheduled playlists table

Revision ID: 1c0cd51f0957
Revises: 2d718ca13543
Create Date: 2025-11-08 08:36:31.395969

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1c0cd51f0957'
down_revision: Union[str, Sequence[str], None] = '2d718ca13543'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create scheduled_playlists table
    op.create_table(
        'scheduled_playlists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('playlist_id', sa.Integer(), nullable=False),
        sa.Column('schedule_type', sa.Enum('recurring', 'specific_date', name='scheduletype'), nullable=False),
        sa.Column('days_of_week', sa.JSON(), nullable=True),
        sa.Column('start_time', sa.Time(), nullable=True),
        sa.Column('end_time', sa.Time(), nullable=True),
        sa.Column('specific_date', sa.Date(), nullable=True),
        sa.Column('specific_start_time', sa.Time(), nullable=True),
        sa.Column('specific_end_time', sa.Time(), nullable=True),
        sa.Column('annual_recurrence', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('priority', sa.Integer(), server_default='0', nullable=False),
        sa.Column('enabled', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['device_id'], ['display_devices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['playlist_id'], ['playlists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL')
    )
    
    # Create indexes for performance
    op.create_index('ix_scheduled_playlists_id', 'scheduled_playlists', ['id'], unique=False)
    op.create_index('ix_scheduled_playlists_device_id', 'scheduled_playlists', ['device_id'], unique=False)
    op.create_index('ix_scheduled_playlists_playlist_id', 'scheduled_playlists', ['playlist_id'], unique=False)
    op.create_index('ix_scheduled_playlists_schedule_type', 'scheduled_playlists', ['schedule_type'], unique=False)
    op.create_index('ix_scheduled_playlists_name', 'scheduled_playlists', ['name'], unique=False)
    op.create_index('ix_scheduled_playlists_priority', 'scheduled_playlists', ['priority'], unique=False)
    op.create_index('ix_scheduled_playlists_enabled', 'scheduled_playlists', ['enabled'], unique=False)
    # Composite index for fast filtering of active schedules
    op.create_index('ix_scheduled_playlists_device_enabled', 'scheduled_playlists', ['device_id', 'enabled'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indexes
    op.drop_index('ix_scheduled_playlists_device_enabled', table_name='scheduled_playlists')
    op.drop_index('ix_scheduled_playlists_enabled', table_name='scheduled_playlists')
    op.drop_index('ix_scheduled_playlists_priority', table_name='scheduled_playlists')
    op.drop_index('ix_scheduled_playlists_name', table_name='scheduled_playlists')
    op.drop_index('ix_scheduled_playlists_schedule_type', table_name='scheduled_playlists')
    op.drop_index('ix_scheduled_playlists_playlist_id', table_name='scheduled_playlists')
    op.drop_index('ix_scheduled_playlists_device_id', table_name='scheduled_playlists')
    op.drop_index('ix_scheduled_playlists_id', table_name='scheduled_playlists')
    
    # Drop table
    op.drop_table('scheduled_playlists')

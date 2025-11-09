"""add scheduled actions table

Revision ID: 2024110901_actions
Revises: 2024110900_daemon
Create Date: 2024-11-09 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '2024110901_actions'
down_revision = '2024110900_daemon'
branch_labels = None
depends_on = None


def upgrade():
    """Add scheduled_actions table"""
    
    op.create_table('scheduled_actions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('action_type', sa.Enum('power_on', 'power_off', 'set_input', name='actiontype'), nullable=False),
        sa.Column('action_data', sa.JSON(), nullable=True, comment='Action-specific parameters'),
        sa.Column('schedule_type', sa.String(length=20), nullable=False),
        sa.Column('days_of_week', sa.JSON(), nullable=True),
        sa.Column('start_time', sa.Time(), nullable=True),
        sa.Column('end_time', sa.Time(), nullable=True),
        sa.Column('specific_date', sa.Date(), nullable=True),
        sa.Column('specific_start_time', sa.Time(), nullable=True),
        sa.Column('specific_end_time', sa.Time(), nullable=True),
        sa.Column('annual_recurrence', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['display_devices.id'], name='fk_scheduled_actions_device', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], name='fk_scheduled_actions_user', ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_scheduled_actions_device_id', 'scheduled_actions', ['device_id'])
    op.create_index('idx_scheduled_actions_action_type', 'scheduled_actions', ['action_type'])
    op.create_index('idx_scheduled_actions_schedule_type', 'scheduled_actions', ['schedule_type'])
    op.create_index('idx_scheduled_actions_enabled', 'scheduled_actions', ['enabled'])
    op.create_index('idx_scheduled_actions_priority', 'scheduled_actions', ['priority'])
    op.create_index('idx_scheduled_actions_name', 'scheduled_actions', ['name'])


def downgrade():
    """Remove scheduled_actions table"""
    
    op.drop_index('idx_scheduled_actions_name', table_name='scheduled_actions')
    op.drop_index('idx_scheduled_actions_priority', table_name='scheduled_actions')
    op.drop_index('idx_scheduled_actions_enabled', table_name='scheduled_actions')
    op.drop_index('idx_scheduled_actions_schedule_type', table_name='scheduled_actions')
    op.drop_index('idx_scheduled_actions_action_type', table_name='scheduled_actions')
    op.drop_index('idx_scheduled_actions_device_id', table_name='scheduled_actions')
    op.drop_table('scheduled_actions')
    
    # Drop enum
    op.execute("DROP TYPE IF EXISTS actiontype")


"""add action execution tracking for catch-up

Revision ID: 2024111000_exec_tracking
Revises: 2024110901_actions
Create Date: 2024-11-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2024111000_exec_tracking'
down_revision = '2024110901_actions'
branch_labels = None
depends_on = None


def upgrade():
    """Add execution tracking columns to scheduled_actions"""
    
    # Add last_executed_at for tracking when action was last executed
    op.add_column('scheduled_actions',
        sa.Column('last_executed_at', sa.DateTime(timezone=True), nullable=True,
                  comment='Last time this action created a command')
    )
    
    # Add catch_up_window_minutes for defining how long to retry missed actions
    op.add_column('scheduled_actions',
        sa.Column('catch_up_window_minutes', sa.Integer(), nullable=False, server_default='10',
                  comment='How many minutes after scheduled time to still execute missed actions')
    )
    
    # Add index for faster lookups
    op.create_index('idx_scheduled_actions_last_executed', 'scheduled_actions', ['last_executed_at'])


def downgrade():
    """Remove execution tracking columns"""
    
    op.drop_index('idx_scheduled_actions_last_executed', table_name='scheduled_actions')
    op.drop_column('scheduled_actions', 'catch_up_window_minutes')
    op.drop_column('scheduled_actions', 'last_executed_at')

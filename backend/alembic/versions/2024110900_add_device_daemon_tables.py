"""add device daemon tables and columns

Revision ID: 2024110900_daemon
Revises: 1c0cd51f0957
Create Date: 2024-11-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '2024110900_daemon'
down_revision = '1c0cd51f0957'  # Previous migration ID
branch_labels = None
depends_on = None


def upgrade():
    """Add device daemon tables and columns"""
    
    # 1. Create device_daemon_status table
    op.create_table('device_daemon_status',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('daemon_version', sa.String(length=32), nullable=True),
        sa.Column('daemon_status', sa.Enum('online', 'offline', name='daemonstatus'), nullable=False, server_default='offline'),
        sa.Column('last_heartbeat', sa.DateTime(timezone=True), nullable=True),
        sa.Column('capabilities', sa.JSON(), nullable=True, comment='List of daemon capabilities'),
        sa.Column('cec_available', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('cec_devices', sa.JSON(), nullable=True, comment='List of detected CEC devices'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['device_id'], ['display_devices.id'], name='fk_daemon_status_device', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('device_id', name='uq_daemon_status_device_id')
    )
    op.create_index('idx_daemon_status_device_id', 'device_daemon_status', ['device_id'])
    op.create_index('idx_daemon_status_status', 'device_daemon_status', ['daemon_status'])
    op.create_index('idx_daemon_status_heartbeat', 'device_daemon_status', ['last_heartbeat'])
    
    # 2. Create device_commands table
    op.create_table('device_commands',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('command_type', sa.Enum('update_url', 'cec_power_on', 'cec_power_off', 'cec_set_input', 'cec_scan_inputs', name='commandtype'), nullable=False),
        sa.Column('command_data', sa.JSON(), nullable=True, comment='Command parameters'),
        sa.Column('status', sa.Enum('pending', 'sent', 'completed', 'failed', 'timeout', name='commandstatus'), nullable=False, server_default='pending'),
        sa.Column('result', sa.JSON(), nullable=True, comment='Command execution result'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['display_devices.id'], name='fk_device_commands_device', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], name='fk_device_commands_user', ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_device_commands_device_id', 'device_commands', ['device_id'])
    op.create_index('idx_device_commands_status', 'device_commands', ['status'])
    op.create_index('idx_device_commands_device_status', 'device_commands', ['device_id', 'status'])
    op.create_index('idx_device_commands_created_at', 'device_commands', ['created_at'])
    
    # 3. Add columns to display_devices table
    op.add_column('display_devices', sa.Column('browser_url', sa.String(length=512), nullable=True, comment='Current browser URL for remote updates'))
    op.add_column('display_devices', sa.Column('cec_input_name', sa.String(length=64), nullable=True, comment='Selected CEC input name'))
    op.add_column('display_devices', sa.Column('cec_input_address', sa.String(length=16), nullable=True, comment='Selected CEC input address'))
    op.add_column('display_devices', sa.Column('daemon_enabled', sa.Boolean(), nullable=False, server_default='0', comment='Whether daemon control is enabled'))


def downgrade():
    """Remove device daemon tables and columns"""
    
    # Remove columns from display_devices table
    op.drop_column('display_devices', 'daemon_enabled')
    op.drop_column('display_devices', 'cec_input_address')
    op.drop_column('display_devices', 'cec_input_name')
    op.drop_column('display_devices', 'browser_url')
    
    # Drop device_commands table
    op.drop_index('idx_device_commands_created_at', table_name='device_commands')
    op.drop_index('idx_device_commands_device_status', table_name='device_commands')
    op.drop_index('idx_device_commands_status', table_name='device_commands')
    op.drop_index('idx_device_commands_device_id', table_name='device_commands')
    op.drop_table('device_commands')
    
    # Drop device_daemon_status table
    op.drop_index('idx_daemon_status_heartbeat', table_name='device_daemon_status')
    op.drop_index('idx_daemon_status_status', table_name='device_daemon_status')
    op.drop_index('idx_daemon_status_device_id', table_name='device_daemon_status')
    op.drop_table('device_daemon_status')
    
    # Drop enums (MySQL-specific)
    op.execute("DROP TYPE IF EXISTS daemonstatus")
    op.execute("DROP TYPE IF EXISTS commandtype")
    op.execute("DROP TYPE IF EXISTS commandstatus")


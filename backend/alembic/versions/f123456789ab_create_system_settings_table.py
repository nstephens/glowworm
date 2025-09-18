"""Create system_settings table for database-based configuration

Revision ID: f123456789ab
Revises: eb81ce2b6740
Create Date: 2025-01-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision: str = 'f123456789ab'
down_revision: Union[str, Sequence[str], None] = 'eb81ce2b6740'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create system_settings table for storing application configuration in database"""
    # Create system_settings table
    op.create_table(
        'system_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('setting_key', sa.String(length=100), nullable=False),
        sa.Column('setting_value', sa.Text(), nullable=True),
        sa.Column('setting_type', sa.Enum('string', 'number', 'boolean', 'json', name='settingtype'), nullable=False, server_default='string'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_sensitive', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.TIMESTAMP(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.TIMESTAMP(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('setting_key')
    )
    
    # Create index on setting_key for faster lookups
    op.create_index('ix_system_settings_setting_key', 'system_settings', ['setting_key'])
    
    # Insert default application settings
    op.execute("""
        INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_sensitive) VALUES
        ('server_base_url', 'http://localhost:8001', 'string', 'Base URL for the server (used for API endpoints and image URLs)', 0),
        ('backend_port', '8001', 'number', 'Backend server port', 0),
        ('frontend_port', '3003', 'number', 'Frontend development server port', 0),
        ('default_display_time_seconds', '30', 'number', 'Default time to display each image in seconds', 0),
        ('upload_directory', 'uploads', 'string', 'Directory for uploaded files', 0),
        ('display_status_check_interval', '30', 'number', 'Interval for checking display device status (seconds)', 0),
        ('display_websocket_check_interval', '5', 'number', 'Interval for WebSocket display status checks (seconds)', 0),
        ('log_level', 'INFO', 'string', 'Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)', 0),
        ('enable_debug_logging', 'false', 'boolean', 'Enable debug logging for development', 0),
        ('google_client_id', '', 'string', 'Google OAuth client ID', 1),
        ('google_client_secret', '', 'string', 'Google OAuth client secret', 1),
        ('target_display_sizes', '["1080x1920", "2k-portrait", "4k-portrait"]', 'json', 'Available display sizes for image optimization', 0)
    """)


def downgrade() -> None:
    """Remove system_settings table"""
    op.drop_index('ix_system_settings_setting_key', table_name='system_settings')
    op.drop_table('system_settings')

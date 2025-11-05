"""add smart pairing schema

Revision ID: e1f2a3b4c5d6
Revises: abc123def456
Create Date: 2025-11-03 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'e1f2a3b4c5d6'
down_revision = 'abc123def456'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if orientation column already exists before adding it
    connection = op.get_bind()
    result = connection.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'display_devices' AND column_name = 'orientation'"
    ))
    orientation_exists = result.scalar() > 0
    
    if not orientation_exists:
        # Add orientation column to display_devices
        op.add_column('display_devices', 
            sa.Column('orientation', sa.String(length=20), nullable=True)
        )
        
        # Populate orientation based on screen dimensions
        # If screen_height > screen_width: portrait
        # If screen_width > screen_height: landscape
        # Else: default to portrait
        op.execute("""
            UPDATE display_devices 
            SET orientation = CASE 
                WHEN screen_height > screen_width THEN 'portrait'
                WHEN screen_width > screen_height THEN 'landscape'
                ELSE 'portrait'
            END
            WHERE orientation IS NULL
        """)
        
        # Make orientation non-nullable after population
        op.alter_column('display_devices', 'orientation',
            existing_type=sa.String(length=20),
            nullable=False,
            server_default='portrait'
        )
    
    # Check if computed_sequence column already exists before adding it
    result = connection.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'playlists' AND column_name = 'computed_sequence'"
    ))
    computed_sequence_exists = result.scalar() > 0
    
    if not computed_sequence_exists:
        # Add computed_sequence to playlists
        op.add_column('playlists', 
            sa.Column('computed_sequence', sa.JSON(), nullable=True)
        )


def downgrade() -> None:
    # Remove computed_sequence from playlists
    op.drop_column('playlists', 'computed_sequence')
    
    # Remove orientation from display_devices
    op.drop_column('display_devices', 'orientation')


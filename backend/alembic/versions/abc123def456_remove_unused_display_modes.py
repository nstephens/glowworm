"""remove unused display modes

Revision ID: abc123def456
Revises: 75b7a1da5c06
Create Date: 2025-11-03 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'abc123def456'
down_revision = '75b7a1da5c06'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # First, update any playlists using removed modes to 'default'
    # Also migrate 'movement' to 'ken_burns_plus' since it's legacy
    op.execute("""
        UPDATE playlists 
        SET display_mode = 'default' 
        WHERE display_mode IN ('auto_sort', 'parallax_depth', 'color_harmony', 'cinematic_bars', 'magic_dust', 'liquid_blend')
    """)
    
    op.execute("""
        UPDATE playlists 
        SET display_mode = 'ken_burns_plus' 
        WHERE display_mode = 'movement'
    """)
    
    # Update the displaymode enum to remove unused modes including 'movement'
    # Keep only: default, ken_burns_plus, soft_glow, ambient_pulse, dreamy_reveal, stacked_reveal
    op.alter_column(
        'playlists',
        'display_mode',
        existing_type=sa.Enum(
            'default', 'ken_burns_plus', 'soft_glow', 
            'ambient_pulse', 'dreamy_reveal', 'stacked_reveal',
            name='displaymode'
        ),
        nullable=True
    )


def downgrade() -> None:
    # Restore display modes (without movement, it's permanently removed)
    op.alter_column(
        'playlists',
        'display_mode',
        existing_type=sa.Enum(
            'default', 'auto_sort', 'ken_burns_plus', 'soft_glow', 'ambient_pulse',
            'dreamy_reveal', 'stacked_reveal', 'parallax_depth', 'color_harmony', 'cinematic_bars',
            'magic_dust', 'liquid_blend',
            name='displaymode'
        ),
        nullable=True
    )


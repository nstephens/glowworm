"""remove_movement_display_mode

Revision ID: f9a8b7c6d5e4
Revises: e1f2a3b4c5d6
Create Date: 2025-11-05 03:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f9a8b7c6d5e4'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade():
    """Migrate playlists using 'movement' mode to 'ken_burns_plus'"""
    # Update any playlists using 'movement' to use 'ken_burns_plus' instead
    op.execute("""
        UPDATE playlists 
        SET display_mode = 'ken_burns_plus' 
        WHERE display_mode = 'movement'
    """)


def downgrade():
    """Revert ken_burns_plus back to movement for migrated playlists"""
    # Note: This is a lossy downgrade - we can't know which playlists were originally 'movement'
    # vs which were already 'ken_burns_plus', so we don't change anything on downgrade
    pass


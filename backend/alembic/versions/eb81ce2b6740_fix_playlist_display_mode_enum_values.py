"""Fix playlist display_mode enum values

Revision ID: eb81ce2b6740
Revises: 
Create Date: 2025-09-14 02:49:37.187692

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision: str = 'eb81ce2b6740'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # First, update existing data from uppercase to lowercase
    op.execute("UPDATE playlists SET display_mode = 'default' WHERE display_mode = 'DEFAULT'")
    op.execute("UPDATE playlists SET display_mode = 'auto_sort' WHERE display_mode = 'AUTO_SORT'")
    op.execute("UPDATE playlists SET display_mode = 'movement' WHERE display_mode = 'MOVEMENT'")
    
    # Now change the column type to use the proper enum with lowercase values
    op.alter_column('playlists', 'display_mode',
                   existing_type=mysql.VARCHAR(collation='utf8mb4_unicode_ci', length=20),
                   type_=sa.Enum('default', 'auto_sort', 'movement', name='displaymode'),
                   existing_nullable=True,
                   existing_server_default=sa.text("'default'"))


def downgrade() -> None:
    """Downgrade schema."""
    # Revert the column type back to VARCHAR
    op.alter_column('playlists', 'display_mode',
                   existing_type=sa.Enum('default', 'auto_sort', 'movement', name='displaymode'),
                   type_=mysql.VARCHAR(collation='utf8mb4_unicode_ci', length=20),
                   existing_nullable=True,
                   existing_server_default=sa.text("'default'"))
    
    # Revert data back to uppercase (if needed)
    op.execute("UPDATE playlists SET display_mode = 'DEFAULT' WHERE display_mode = 'default'")
    op.execute("UPDATE playlists SET display_mode = 'AUTO_SORT' WHERE display_mode = 'auto_sort'")
    op.execute("UPDATE playlists SET display_mode = 'MOVEMENT' WHERE display_mode = 'movement'")

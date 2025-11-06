"""add_show_exif_date_to_playlists

Revision ID: 8e979971ad76
Revises: g8h9i0j1k2l3
Create Date: 2025-11-05 20:58:52.169422

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8e979971ad76'
down_revision: Union[str, Sequence[str], None] = 'g8h9i0j1k2l3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Check if column exists before adding
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('playlists')]
    
    if 'show_exif_date' not in columns:
        op.add_column('playlists', sa.Column('show_exif_date', sa.Boolean(), nullable=True, server_default='0'))


def downgrade() -> None:
    """Downgrade schema."""
    # Check if column exists before dropping
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('playlists')]
    
    if 'show_exif_date' in columns:
        op.drop_column('playlists', 'show_exif_date')

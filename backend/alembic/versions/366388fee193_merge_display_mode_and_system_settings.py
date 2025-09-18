"""merge_display_mode_and_system_settings

Revision ID: 366388fee193
Revises: 606a912adbee, f123456789ab
Create Date: 2025-09-17 14:16:41.259421

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '366388fee193'
down_revision: Union[str, Sequence[str], None] = ('606a912adbee', 'f123456789ab')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

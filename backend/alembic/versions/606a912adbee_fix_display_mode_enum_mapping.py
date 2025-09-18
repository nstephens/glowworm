"""fix_display_mode_enum_mapping

Revision ID: 606a912adbee
Revises: c16922e8f93e
Create Date: 2025-09-14 11:53:26.426725

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '606a912adbee'
down_revision: Union[str, Sequence[str], None] = 'c16922e8f93e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

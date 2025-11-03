"""Fix device_logs enum case to uppercase

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2025-11-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6g7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Update enum values to uppercase."""
    # For MySQL, we need to modify the enum by altering the column
    op.execute("""
        ALTER TABLE device_logs 
        MODIFY COLUMN log_level 
        ENUM('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL') 
        NOT NULL DEFAULT 'INFO'
    """)


def downgrade() -> None:
    """Revert enum values to lowercase."""
    op.execute("""
        ALTER TABLE device_logs 
        MODIFY COLUMN log_level 
        ENUM('debug', 'info', 'warning', 'error', 'critical') 
        NOT NULL DEFAULT 'info'
    """)


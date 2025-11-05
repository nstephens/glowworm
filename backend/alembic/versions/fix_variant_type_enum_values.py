"""fix_variant_type_enum_values

Revision ID: g8h9i0j1k2l3
Revises: f9a8b7c6d5e4
Create Date: 2025-11-05 03:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'g8h9i0j1k2l3'
down_revision = 'f9a8b7c6d5e4'
branch_labels = None
depends_on = None


def upgrade():
    """Update playlist variant type enum to match Python code format"""
    
    # First, update existing data to new format
    op.execute("""
        UPDATE playlist_variants 
        SET variant_type = 'ORIGINAL'
        WHERE variant_type = 'original'
    """)
    
    op.execute("""
        UPDATE playlist_variants 
        SET variant_type = 'PORTRAIT_2K'
        WHERE variant_type = '2k_portrait'
    """)
    
    op.execute("""
        UPDATE playlist_variants 
        SET variant_type = 'PORTRAIT_4K'
        WHERE variant_type = '4k_portrait'
    """)
    
    op.execute("""
        UPDATE playlist_variants 
        SET variant_type = 'LANDSCAPE_2K'
        WHERE variant_type = '2k_landscape'
    """)
    
    op.execute("""
        UPDATE playlist_variants 
        SET variant_type = 'LANDSCAPE_4K'
        WHERE variant_type = '4k_landscape'
    """)
    
    op.execute("""
        UPDATE playlist_variants 
        SET variant_type = 'CUSTOM'
        WHERE variant_type = 'custom'
    """)
    
    # Recreate the enum with new values
    # MySQL doesn't support ALTER TYPE on enum, so we need to:
    # 1. Change column to VARCHAR temporarily
    # 2. Drop old enum type
    # 3. Create new enum type
    # 4. Change column back to new enum
    
    op.execute("ALTER TABLE playlist_variants MODIFY variant_type VARCHAR(20)")
    op.execute("DROP TYPE IF EXISTS playlistvarianttype")
    
    # Note: SQLAlchemy will handle enum creation when we change the column back
    op.execute("""
        ALTER TABLE playlist_variants 
        MODIFY variant_type ENUM('ORIGINAL', 'PORTRAIT_2K', 'PORTRAIT_4K', 'LANDSCAPE_2K', 'LANDSCAPE_4K', 'CUSTOM') NOT NULL
    """)


def downgrade():
    """Revert to old format"""
    # Update data back to old format
    op.execute("UPDATE playlist_variants SET variant_type = 'original' WHERE variant_type = 'ORIGINAL'")
    op.execute("UPDATE playlist_variants SET variant_type = '2k_portrait' WHERE variant_type = 'PORTRAIT_2K'")
    op.execute("UPDATE playlist_variants SET variant_type = '4k_portrait' WHERE variant_type = 'PORTRAIT_4K'")
    op.execute("UPDATE playlist_variants SET variant_type = '2k_landscape' WHERE variant_type = 'LANDSCAPE_2K'")
    op.execute("UPDATE playlist_variants SET variant_type = '4k_landscape' WHERE variant_type = 'LANDSCAPE_4K'")
    op.execute("UPDATE playlist_variants SET variant_type = 'custom' WHERE variant_type = 'CUSTOM'")
    
    # Recreate old enum
    op.execute("ALTER TABLE playlist_variants MODIFY variant_type VARCHAR(20)")
    op.execute("""
        ALTER TABLE playlist_variants 
        MODIFY variant_type ENUM('original', '2k_portrait', '4k_portrait', '2k_landscape', '4k_landscape', 'custom') NOT NULL
    """)


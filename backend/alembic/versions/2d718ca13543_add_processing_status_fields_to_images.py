"""add_processing_status_fields_to_images

Revision ID: 2d718ca13543
Revises: 8e979971ad76
Create Date: 2025-11-06 19:59:33.446833

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2d718ca13543'
down_revision: Union[str, Sequence[str], None] = '8e979971ad76'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add background processing status fields to images table."""
    # Create enum types for processing statuses
    processing_status_enum = sa.Enum('pending', 'processing', 'complete', 'failed', name='processing_status_enum')
    thumbnail_status_enum = sa.Enum('pending', 'processing', 'complete', 'failed', name='thumbnail_status_enum')
    variant_status_enum = sa.Enum('pending', 'processing', 'complete', 'failed', name='variant_status_enum')
    
    # Create the enum types in the database
    processing_status_enum.create(op.get_bind(), checkfirst=True)
    thumbnail_status_enum.create(op.get_bind(), checkfirst=True)
    variant_status_enum.create(op.get_bind(), checkfirst=True)
    
    # Add processing status columns
    op.add_column('images', sa.Column('processing_status', processing_status_enum, nullable=False, server_default='pending'))
    op.add_column('images', sa.Column('thumbnail_status', thumbnail_status_enum, nullable=False, server_default='pending'))
    op.add_column('images', sa.Column('variant_status', variant_status_enum, nullable=False, server_default='pending'))
    
    # Add processing metadata columns
    op.add_column('images', sa.Column('processing_error', sa.Text(), nullable=True))
    op.add_column('images', sa.Column('processing_attempts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('images', sa.Column('last_processing_attempt', sa.DateTime(timezone=True), nullable=True))
    op.add_column('images', sa.Column('processing_completed_at', sa.DateTime(timezone=True), nullable=True))
    
    # Create indexes for faster queries
    op.create_index('ix_images_processing_status', 'images', ['processing_status'])
    op.create_index('ix_images_thumbnail_status', 'images', ['thumbnail_status'])
    op.create_index('ix_images_variant_status', 'images', ['variant_status'])


def downgrade() -> None:
    """Downgrade schema - remove background processing status fields from images table."""
    # Drop indexes first
    op.drop_index('ix_images_variant_status', table_name='images')
    op.drop_index('ix_images_thumbnail_status', table_name='images')
    op.drop_index('ix_images_processing_status', table_name='images')
    
    # Drop columns
    op.drop_column('images', 'processing_completed_at')
    op.drop_column('images', 'last_processing_attempt')
    op.drop_column('images', 'processing_attempts')
    op.drop_column('images', 'processing_error')
    op.drop_column('images', 'variant_status')
    op.drop_column('images', 'thumbnail_status')
    op.drop_column('images', 'processing_status')
    
    # Drop enum types
    sa.Enum(name='variant_status_enum').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='thumbnail_status_enum').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='processing_status_enum').drop(op.get_bind(), checkfirst=True)

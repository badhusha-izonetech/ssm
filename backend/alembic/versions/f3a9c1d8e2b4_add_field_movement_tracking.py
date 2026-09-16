"""Add field movement GPS tracking (locations + last-known-position)

Revision ID: f3a9c1d8e2b4
Revises: 0a3b11d65bc6
Create Date: 2026-08-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a9c1d8e2b4'
down_revision: Union[str, None] = 'a6898c7b2c05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── New GPS location history table ──────────────────────────────────────
    op.create_table(
        'field_movement_locations',
        sa.Column('field_movement_id', sa.String(length=36), nullable=False),
        sa.Column('employee_id', sa.String(length=36), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('accuracy', sa.Float(), nullable=False),
        sa.Column('speed', sa.Float(), nullable=True),
        sa.Column('heading', sa.Float(), nullable=True),
        sa.Column('captured_at', sa.DateTime(), nullable=False),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['solar.employees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['field_movement_id'], ['solar.field_movements.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema='solar',
    )
    op.create_index(
        op.f('ix_solar_field_movement_locations_field_movement_id'),
        'field_movement_locations', ['field_movement_id'], unique=False, schema='solar',
    )
    op.create_index(
        op.f('ix_solar_field_movement_locations_employee_id'),
        'field_movement_locations', ['employee_id'], unique=False, schema='solar',
    )
    op.create_index(
        op.f('ix_solar_field_movement_locations_captured_at'),
        'field_movement_locations', ['captured_at'], unique=False, schema='solar',
    )

    # ── Denormalized "last known position" on field_movements ──────────────
    op.add_column('field_movements', sa.Column('last_latitude', sa.Float(), nullable=True), schema='solar')
    op.add_column('field_movements', sa.Column('last_longitude', sa.Float(), nullable=True), schema='solar')
    op.add_column('field_movements', sa.Column('last_accuracy', sa.Float(), nullable=True), schema='solar')
    op.add_column('field_movements', sa.Column('last_speed', sa.Float(), nullable=True), schema='solar')
    op.add_column('field_movements', sa.Column('last_heading', sa.Float(), nullable=True), schema='solar')
    op.add_column('field_movements', sa.Column('last_location_at', sa.DateTime(), nullable=True), schema='solar')


def downgrade() -> None:
    op.drop_column('field_movements', 'last_location_at', schema='solar')
    op.drop_column('field_movements', 'last_heading', schema='solar')
    op.drop_column('field_movements', 'last_speed', schema='solar')
    op.drop_column('field_movements', 'last_accuracy', schema='solar')
    op.drop_column('field_movements', 'last_longitude', schema='solar')
    op.drop_column('field_movements', 'last_latitude', schema='solar')

    op.drop_index(op.f('ix_solar_field_movement_locations_captured_at'), table_name='field_movement_locations', schema='solar')
    op.drop_index(op.f('ix_solar_field_movement_locations_employee_id'), table_name='field_movement_locations', schema='solar')
    op.drop_index(op.f('ix_solar_field_movement_locations_field_movement_id'), table_name='field_movement_locations', schema='solar')
    op.drop_table('field_movement_locations', schema='solar')

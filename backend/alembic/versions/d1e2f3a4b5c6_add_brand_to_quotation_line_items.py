"""add brand to quotation line items

Revision ID: d1e2f3a4b5c6
Revises: 77ccbfbd55ae
Create Date: 2026-09-10 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: str = '1dbf8f65d4e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'quotation_line_items',
        sa.Column('brand', sa.String(length=200), nullable=True),
        schema='solar',
    )


def downgrade() -> None:
    op.drop_column('quotation_line_items', 'brand', schema='solar')

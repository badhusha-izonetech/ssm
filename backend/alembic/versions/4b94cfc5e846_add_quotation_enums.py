"""add_quotation_enums

Revision ID: 4b94cfc5e846
Revises: 1dbf8f65d4e0
Create Date: 2026-09-09 12:26:42.534259

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4b94cfc5e846'
down_revision: Union[str, None] = '1dbf8f65d4e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE solar.department_enum ADD VALUE IF NOT EXISTS 'Quotation'")
        op.execute("ALTER TYPE solar.designation_enum ADD VALUE IF NOT EXISTS 'Quotation Manager'")


def downgrade() -> None:
    pass

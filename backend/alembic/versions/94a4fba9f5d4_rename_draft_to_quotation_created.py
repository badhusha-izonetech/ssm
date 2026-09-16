"""rename_draft_to_quotation_created

Revision ID: 94a4fba9f5d4
Revises: f4526ac18ec9
Create Date: 2026-09-03 15:48:49.852649

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '94a4fba9f5d4'
down_revision: Union[str, None] = 'f4526ac18ec9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename "Draft" to "Quotation Created" in quotation_status_enum
    op.execute("ALTER TYPE solar.quotation_status_enum RENAME VALUE 'Draft' TO 'Quotation Created'")


def downgrade() -> None:
    # Rename "Quotation Created" back to "Draft"
    op.execute("ALTER TYPE solar.quotation_status_enum RENAME VALUE 'Quotation Created' TO 'Draft'")

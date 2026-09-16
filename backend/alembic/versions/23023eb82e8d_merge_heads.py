"""merge heads

Revision ID: 23023eb82e8d
Revises: 8831bd19dd8a, b5920c4fcbf1
Create Date: 2026-08-28 10:50:03.925471

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '23023eb82e8d'
down_revision: Union[str, None] = ('8831bd19dd8a', 'b5920c4fcbf1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

"""merge heads

Revision ID: 3e815cb7dfd7
Revises: 12ae031159a1, dfc7414c4e4c
Create Date: 2026-08-29 13:24:45.913039

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3e815cb7dfd7'
down_revision: Union[str, None] = ('12ae031159a1', 'dfc7414c4e4c')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

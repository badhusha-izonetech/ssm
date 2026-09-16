"""Merge Alembic heads

Revision ID: 220e3b0bf1ad
Revises: 4b94cfc5e846, d1e2f3a4b5c6
Create Date: 2026-09-10 17:12:50.412574

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '220e3b0bf1ad'
down_revision: Union[str, None] = ('4b94cfc5e846', 'd1e2f3a4b5c6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

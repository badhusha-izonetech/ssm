"""merge migration heads

Revision ID: b5920c4fcbf1
Revises: b0823cc29d90, e4a7b625a602
Create Date: 2026-08-27 13:51:36.863495

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5920c4fcbf1'
down_revision: Union[str, None] = ('b0823cc29d90', 'e4a7b625a602')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

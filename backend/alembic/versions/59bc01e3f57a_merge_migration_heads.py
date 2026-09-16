"""merge migration heads

Revision ID: 59bc01e3f57a
Revises: 412ff2f4f4e3, c49c8aba9923
Create Date: 2026-08-28 16:17:45.860185

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '59bc01e3f57a'
down_revision: Union[str, None] = ('412ff2f4f4e3', 'c49c8aba9923')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

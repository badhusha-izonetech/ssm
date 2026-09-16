"""
Add site visit evidence media fields.

Revision ID: b0823cc29d90
Revises: 77ccbfbd55ae
Create Date: 2026-08-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b0823cc29d90"
down_revision: Union[str, None] = "77ccbfbd55ae"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "site_visits",
        sa.Column(
            "videos",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="[]",
            nullable=False,
        ),
        schema="solar",
    )

    op.add_column(
        "site_visits",
        sa.Column(
            "measurement_images",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="[]",
            nullable=False,
        ),
        schema="solar",
    )

    op.add_column(
        "site_visits",
        sa.Column(
            "documents",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="[]",
            nullable=False,
        ),
        schema="solar",
    )


def downgrade() -> None:
    op.drop_column(
        "site_visits",
        "documents",
        schema="solar",
    )

    op.drop_column(
        "site_visits",
        "measurement_images",
        schema="solar",
    )

    op.drop_column(
        "site_visits",
        "videos",
        schema="solar",
    )
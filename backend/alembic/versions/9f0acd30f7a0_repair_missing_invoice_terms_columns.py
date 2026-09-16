"""
Repair missing invoice terms columns.

Revision ID: 9f0acd30f7a0
Revises: 3e815cb7dfd7
Create Date: 2026-08-30 18:16:14.393178
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9f0acd30f7a0"
down_revision: Union[str, None] = "3e815cb7dfd7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_columns = {
        column["name"]
        for column in inspector.get_columns(
            "invoices",
            schema="solar",
        )
    }

    if "payment_terms" not in existing_columns:
        op.add_column(
            "invoices",
            sa.Column(
                "payment_terms",
                sa.Text(),
                nullable=True,
            ),
            schema="solar",
        )

    if "installation_terms" not in existing_columns:
        op.add_column(
            "invoices",
            sa.Column(
                "installation_terms",
                sa.Text(),
                nullable=True,
            ),
            schema="solar",
        )

    if "terms_and_conditions" not in existing_columns:
        op.add_column(
            "invoices",
            sa.Column(
                "terms_and_conditions",
                sa.Text(),
                nullable=True,
            ),
            schema="solar",
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_columns = {
        column["name"]
        for column in inspector.get_columns(
            "invoices",
            schema="solar",
        )
    }

    if "terms_and_conditions" in existing_columns:
        op.drop_column(
            "invoices",
            "terms_and_conditions",
            schema="solar",
        )

    if "installation_terms" in existing_columns:
        op.drop_column(
            "invoices",
            "installation_terms",
            schema="solar",
        )

    if "payment_terms" in existing_columns:
        op.drop_column(
            "invoices",
            "payment_terms",
            schema="solar",
        )
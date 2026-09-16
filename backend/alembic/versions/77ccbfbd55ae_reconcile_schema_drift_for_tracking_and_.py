"""Reconcile schema drift for tracking and site visits.

Revision ID: 77ccbfbd55ae
Revises: f3a9c1d8e2b4
Create Date: 2026-08-25 12:45:37.424085
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "77ccbfbd55ae"
down_revision: Union[str, None] = "f3a9c1d8e2b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SCHEMA = "solar"


def _inspector():
    return sa.inspect(op.get_bind())


def _table_exists(table_name: str) -> bool:
    inspector = _inspector()
    return table_name in inspector.get_table_names(schema=SCHEMA)


def _columns(table_name: str) -> dict:
    inspector = _inspector()
    return {
        column["name"]: column
        for column in inspector.get_columns(table_name, schema=SCHEMA)
    }


def _indexes(table_name: str) -> dict:
    inspector = _inspector()
    return {
        index["name"]: index
        for index in inspector.get_indexes(table_name, schema=SCHEMA)
    }


def _foreign_keys(table_name: str) -> list[dict]:
    inspector = _inspector()
    return inspector.get_foreign_keys(table_name, schema=SCHEMA)


def upgrade() -> None:
    # ================================================================
    # 1. field_movements - last known GPS position
    # ================================================================
    field_movement_columns = _columns("field_movements")

    gps_columns = {
        "last_latitude": sa.Column(
            "last_latitude",
            sa.Float(),
            nullable=True,
        ),
        "last_longitude": sa.Column(
            "last_longitude",
            sa.Float(),
            nullable=True,
        ),
        "last_accuracy": sa.Column(
            "last_accuracy",
            sa.Float(),
            nullable=True,
        ),
        "last_speed": sa.Column(
            "last_speed",
            sa.Float(),
            nullable=True,
        ),
        "last_heading": sa.Column(
            "last_heading",
            sa.Float(),
            nullable=True,
        ),
        "last_location_at": sa.Column(
            "last_location_at",
            sa.DateTime(),
            nullable=True,
        ),
    }

    for name, column in gps_columns.items():
        if name not in field_movement_columns:
            op.add_column(
                "field_movements",
                column,
                schema=SCHEMA,
            )

    # ================================================================
    # 2. field_movement_locations
    # ================================================================
    if not _table_exists("field_movement_locations"):
        op.create_table(
            "field_movement_locations",
            sa.Column(
                "field_movement_id",
                sa.String(length=36),
                nullable=False,
            ),
            sa.Column(
                "employee_id",
                sa.String(length=36),
                nullable=False,
            ),
            sa.Column(
                "latitude",
                sa.Float(),
                nullable=False,
            ),
            sa.Column(
                "longitude",
                sa.Float(),
                nullable=False,
            ),
            sa.Column(
                "accuracy",
                sa.Float(),
                nullable=False,
            ),
            sa.Column(
                "speed",
                sa.Float(),
                nullable=True,
            ),
            sa.Column(
                "heading",
                sa.Float(),
                nullable=True,
            ),
            sa.Column(
                "captured_at",
                sa.DateTime(),
                nullable=False,
            ),
            sa.Column(
                "id",
                sa.String(length=36),
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ["employee_id"],
                [f"{SCHEMA}.employees.id"],
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["field_movement_id"],
                [f"{SCHEMA}.field_movements.id"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
            schema=SCHEMA,
        )

    # Make sure the indexes expected by the GPS migration exist.
    indexes = _indexes("field_movement_locations")

    required_indexes = {
        "ix_solar_field_movement_locations_field_movement_id": [
            "field_movement_id"
        ],
        "ix_solar_field_movement_locations_employee_id": [
            "employee_id"
        ],
        "ix_solar_field_movement_locations_captured_at": [
            "captured_at"
        ],
    }

    for index_name, columns in required_indexes.items():
        if index_name not in indexes:
            op.create_index(
                index_name,
                "field_movement_locations",
                columns,
                unique=False,
                schema=SCHEMA,
            )

    # ================================================================
    # 3. site_visits - project/stage/schema fields
    # ================================================================
    site_visit_columns = _columns("site_visits")

    if "project_id" not in site_visit_columns:
        op.add_column(
            "site_visits",
            sa.Column(
                "project_id",
                sa.String(length=36),
                nullable=True,
            ),
            schema=SCHEMA,
        )

    if "system_type" not in site_visit_columns:
        op.add_column(
            "site_visits",
            sa.Column(
                "system_type",
                sa.String(length=100),
                nullable=True,
            ),
            schema=SCHEMA,
        )

    if "completed_stages" not in site_visit_columns:
        op.add_column(
            "site_visits",
            sa.Column(
                "completed_stages",
                postgresql.JSONB(astext_type=sa.Text()),
                server_default=sa.text("'[]'::jsonb"),
                nullable=False,
            ),
            schema=SCHEMA,
        )

    # ================================================================
    # 4. site_visits - tool photo/submission fields
    # ================================================================
    if "tool_photo_before" not in site_visit_columns:
        op.add_column(
            "site_visits",
            sa.Column(
                "tool_photo_before",
                sa.Text(),
                nullable=True,
            ),
            schema=SCHEMA,
        )

    if "tool_photo_after" not in site_visit_columns:
        op.add_column(
            "site_visits",
            sa.Column(
                "tool_photo_after",
                sa.Text(),
                nullable=True,
            ),
            schema=SCHEMA,
        )

    if "submitted_at" not in site_visit_columns:
        op.add_column(
            "site_visits",
            sa.Column(
                "submitted_at",
                sa.DateTime(timezone=True),
                nullable=True,
            ),
            schema=SCHEMA,
        )

    # ================================================================
    # 5. site_visits.lead_id must be nullable
    # ================================================================
    site_visit_columns = _columns("site_visits")

    if (
        "lead_id" in site_visit_columns
        and not site_visit_columns["lead_id"]["nullable"]
    ):
        op.alter_column(
            "site_visits",
            "lead_id",
            existing_type=sa.VARCHAR(length=36),
            nullable=True,
            schema=SCHEMA,
        )

    # ================================================================
    # 6. site_visits.project_id -> solar.projects.id
    # ================================================================
    site_visit_fks = _foreign_keys("site_visits")

    project_fk_exists = any(
        fk.get("constrained_columns") == ["project_id"]
        and fk.get("referred_schema") == SCHEMA
        and fk.get("referred_table") == "projects"
        and fk.get("referred_columns") == ["id"]
        for fk in site_visit_fks
    )

    if not project_fk_exists:
        op.create_foreign_key(
            "fk_site_visits_project_id_projects",
            "site_visits",
            "projects",
            ["project_id"],
            ["id"],
            source_schema=SCHEMA,
            referent_schema=SCHEMA,
            ondelete="CASCADE",
        )

    # ================================================================
    # 7. site_visit_photos.stage
    # ================================================================
    site_visit_photo_columns = _columns("site_visit_photos")

    if "stage" not in site_visit_photo_columns:
        op.add_column(
            "site_visit_photos",
            sa.Column(
                "stage",
                sa.String(length=100),
                nullable=True,
            ),
            schema=SCHEMA,
        )


def downgrade() -> None:
    # This migration repairs schema drift in an already-evolved database.
    #
    # We intentionally do not remove these columns/tables during downgrade
    # because they belong to earlier application migrations and deleting them
    # here could destroy existing application data.
    pass
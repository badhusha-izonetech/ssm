"""
Seed script — populates the database with:
  - 7 departments (with teams)
  - 11 employees (one per designation) using SEED_DEFAULT_PASSWORD from .env
  - Sample leads, quotations, projects, stock items

Run: python seed.py
Idempotent: skips records that already exist (by username / name / code).
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv  # type: ignore
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from app.core.config import settings
from app.core.database import AsyncSessionLocal, create_schema_if_not_exists, engine
from app.core.security import hash_password
from sqlalchemy import select, text

DEPARTMENTS = [
    {"name": "CEO",       "teams": ["Leadership", "Strategy"]},
    {"name": "Marketing", "teams": ["Telecalling", "Direct Marketing", "Lead Management"]},
    {"name": "Site Visit","teams": ["Site Assessment", "Customer Visit"]},
    {"name": "Accounts",  "teams": ["Billing", "Collections", "Verification"]},
    {"name": "Project",   "teams": ["Project Management", "Documentation", "Field Execution"]},
    {"name": "Warehouse", "teams": ["Inventory", "Dispatch", "Quality Check"]},
    {"name": "Transport", "teams": ["Logistics", "Driver Coordination"]},
]

# CEO is handled dynamically using INITIAL_CEO settings

STOCK_ITEMS = [
    {"product_name": "Solar Panel 400W", "category": "Panels", "brand": "Waaree", "unit": "pcs", "current_quantity": 50, "minimum_level": 10, "cost_per_unit": 8500},
    {"product_name": "Inverter 5kW", "category": "Inverters", "brand": "Sungrow", "unit": "pcs", "current_quantity": 15, "minimum_level": 3, "cost_per_unit": 35000},
    {"product_name": "Mounting Structure", "category": "Structure", "brand": "Generic", "unit": "set", "current_quantity": 30, "minimum_level": 5, "cost_per_unit": 4500},
    {"product_name": "DC Cable 4mm²", "category": "Cables", "brand": "Polycab", "unit": "mtr", "current_quantity": 500, "minimum_level": 100, "cost_per_unit": 45},
    {"product_name": "MC4 Connector", "category": "Connectors", "brand": "Staubli", "unit": "pairs", "current_quantity": 200, "minimum_level": 50, "cost_per_unit": 80},
]

PRODUCTS = [
    {
        "name": "Power Plant (On-Grid and Off-Grid)",
        "category": "Solar Power Plant",
        "unit": "Kilowatt",
        "unit_price": 48000,
        "gst_percent": 18,
        "description": (
            "• 5 kW On-Grid / Off-Grid Solar Power System\n"
            "• High-efficiency mono-crystalline solar panels with standard mounting arrangement\n"
            "• Grid-tied & hybrid solar inverter with monitoring and protection system\n"
            "• GI mounting structure, DC/AC protection, earthing, cables, installation, testing & Commissioning\n"
            "• Concrete pillar work for structure leg, sprinkler system with motor, & EB Net Meter payment"
        ),
        "sort_order": 1,
    },
    {
        "name": "Solar Hybrid System",
        "category": "Solar Systems",
        "unit": "Kilowatt",
        "unit_price": 55000,
        "gst_percent": 18,
        "description": (
            "• High-efficiency Mono-crystalline PERC Solar Panels\n"
            "• Hybrid Solar Inverter with LiFePO4 Lithium Battery Storage Backup\n"
            "• HDG Roof Structure, ACDB/DCDB Surge Protection (SPD), Earthing & Solar DC Cables\n"
            "• Complete Installation, Testing & Commissioning with Net Metering support"
        ),
        "sort_order": 2,
    },
    {
        "name": "On-Grid Solar System",
        "category": "Solar Systems",
        "unit": "Kilowatt",
        "unit_price": 45000,
        "gst_percent": 18,
        "description": (
            "• Tier-1 Bi-facial Mono PERC Solar Panels (ALMM Approved)\n"
            "• High-efficiency Grid-Tied Solar Inverter with Wi-Fi Remote Monitoring\n"
            "• Aluminium / Galvanized Structure with ACDB/DCDB Surge Protectors\n"
            "• TANGEDCO / EB Net-metering approval facilitation and commissioning"
        ),
        "sort_order": 3,
    },
    {
        "name": "Off-Grid Solar System",
        "category": "Solar Systems",
        "unit": "Kilowatt",
        "unit_price": 52000,
        "gst_percent": 18,
        "description": (
            "• Mono-crystalline Solar Photovoltaic Module Array\n"
            "• Pure Sine Wave Off-Grid Solar PCU / Inverter\n"
            "• Solar Tubular / Lithium Battery Bank for Uninterrupted Power Backup\n"
            "• Complete BOS (Balance of System), Earthing & Lightning Protection"
        ),
        "sort_order": 4,
    },
    {
        "name": "Solar Water Heater",
        "category": "Solar Heating",
        "unit": "Kilowatt",
        "unit_price": 28000,
        "gst_percent": 12,
        "description": (
            "• Evacuated Tube Collector (ETC) Solar Water Heating System\n"
            "• Food-grade SS304 Inner Tank with High Density PUF Insulation\n"
            "• Galvanized Stand Frame, Piping, Safety Valves & Backup Electric Heating Element"
        ),
        "sort_order": 5,
    },
    {
        "name": "Solar Street Light",
        "category": "Solar Lighting",
        "unit": "Kilowatt",
        "unit_price": 12500,
        "gst_percent": 12,
        "description": (
            "• All-In-One Integrated LED Solar Street Light with Motion Sensor & MPPT Controller\n"
            "• High-Lumen LED Luminaire, LiFePO4 Lithium Battery & Mono Solar Module\n"
            "• Heavy-Duty GI Pole & Mounting Bracket Assembly"
        ),
        "sort_order": 6,
    },
    {
        "name": "Solar Pumpset",
        "category": "Solar Pumps",
        "unit": "Kilowatt",
        "unit_price": 85000,
        "gst_percent": 12,
        "description": (
            "• High-efficiency Submersible / Surface Solar Water Pump & Solar VFD Controller Drive\n"
            "• Mono-crystalline Solar Panel Array with Heavy-Duty Ground/Structure Mount\n"
            "• IP65 Protection Box, Cables, Anti-Theft Mounting & Pipeline Connectors"
        ),
        "sort_order": 7,
    },
]


async def seed():
    await create_schema_if_not_exists()

    # ── Fix enum values to match frontend ─────────────────────────────────────
    async with engine.begin() as conn:
        schema = settings.POSTGRES_SCHEMA

        # Check if leads table exists already
        result = await conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            f"WHERE table_schema = '{schema}' AND table_name = 'leads')"
        ))
        leads_table_exists = result.scalar()

        if leads_table_exists:
            # Table exists — safely add missing enum values via ALTER TYPE
            lead_source_values = [
                "Previous Customer", "Referral", "Inquiry Call", "Walk-in",
                "Justdial", "IndiaMART", "Google Search", "BNI",
                "Direct Field Visit", "New Construction", "Commercial Building", "Other"
            ]
            for val in lead_source_values:
                await conn.execute(text(
                    f"DO $$ BEGIN "
                    f"ALTER TYPE {schema}.lead_source_enum ADD VALUE IF NOT EXISTS '{val}'; "
                    f"EXCEPTION WHEN others THEN NULL; END $$;"
                ))

            lost_reason_values = [
                "Price", "Product Unavailable", "Company Cannot Provide Requirement",
                "Customer Postponed", "Competitor", "Not Interested",
                "Technical Infeasibility", "Other"
            ]
            for val in lost_reason_values:
                await conn.execute(text(
                    f"DO $$ BEGIN "
                    f"ALTER TYPE {schema}.lead_lost_reason_enum ADD VALUE IF NOT EXISTS '{val}'; "
                    f"EXCEPTION WHEN others THEN NULL; END $$;"
                ))
            print("OK - Enum values patched (ALTER TYPE)")
        else:
            # Table doesn't exist yet — drop old enums so SQLAlchemy creates them fresh
            for enum_name in ("lead_source_enum", "lead_lost_reason_enum"):
                await conn.execute(text(
                    f"DROP TYPE IF EXISTS {schema}.{enum_name} CASCADE"
                ))
            print("OK - Old enums dropped (will be recreated with correct values)")

    # ── Create all tables ───────────────────────────────────────────────────────────────
    import app.models  # noqa: ensure all models registered on Base.metadata
    from app.core.database import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("OK - Tables created/verified")

    async with AsyncSessionLocal() as db:
        # ── Departments ───────────────────────────────────────────────────────
        from app.models.department import Department
        for dept_data in DEPARTMENTS:
            existing = (await db.execute(
                select(Department).where(Department.name == dept_data["name"])
            )).scalar_one_or_none()
            if not existing:
                db.add(Department(
                    name=dept_data["name"],
                    teams_json=json.dumps(dept_data["teams"]),
                ))
        await db.commit()
        print(f"OK - {len(DEPARTMENTS)} departments seeded")

        # ── CEO (Employee) ────────────────────────────────────────────────────────
        from app.models.employee import Employee
        # Check if the CEO already exists
        existing_ceo = (await db.execute(
            select(Employee).where(Employee.designation == "CEO")
        )).scalar_one_or_none()

        if existing_ceo:
            # Update existing CEO credentials in case they changed in .env
            existing_ceo.username = settings.INITIAL_CEO_USERNAME
            existing_ceo.hashed_password = hash_password(settings.INITIAL_CEO_PASSWORD)
            # Ensure name and department are correct
            existing_ceo.name = "Initial CEO"
            existing_ceo.department = "CEO"
            db.add(existing_ceo)
            print(f"OK - CEO verified/updated: {settings.INITIAL_CEO_USERNAME}")
        else:
            # Check if username is taken by a non-CEO (edge case fallback)
            username_taken = (await db.execute(
                select(Employee).where(Employee.username == settings.INITIAL_CEO_USERNAME)
            )).scalar_one_or_none()

            if username_taken:
                print(f"WARN - Cannot create CEO, username '{settings.INITIAL_CEO_USERNAME}' is taken by another employee.")
            else:
                db.add(Employee(
                    employee_code="SSC-001",
                    name="Initial CEO",
                    mobile="9876543210",
                    email="ceo@successsolar.com",
                    joining_date="2022-01-01",
                    department="CEO",
                    designation="CEO",
                    username=settings.INITIAL_CEO_USERNAME,
                    hashed_password=hash_password(settings.INITIAL_CEO_PASSWORD),
                    employment_status="Active",
                    avatar_color="#3B82F6",
                ))
                print(f"OK - CEO created: {settings.INITIAL_CEO_USERNAME}")
                
        # Also report on total employees for clarity
        total_employees = (await db.execute(select(Employee))).scalars().all()
        if len(total_employees) > 1:
            print(f"OK - {len(total_employees)} employees verified in total (others preserved)")

        # ── Stock items ───────────────────────────────────────────────────────
        from app.models.stock_item import StockItem
        from decimal import Decimal
        seeded_stock = 0
        for item_data in STOCK_ITEMS:
            existing = (
    await db.execute(
        select(StockItem)
        .where(StockItem.product_name == item_data["product_name"])
        .order_by(StockItem.created_at.asc())
    )
).scalars().first()
            if not existing:
                db.add(StockItem(
                    product_name=item_data["product_name"],
                    category=item_data["category"],
                    brand=item_data["brand"],
                    unit=item_data["unit"],
                    current_quantity=Decimal(str(item_data["current_quantity"])),
                    reserved_quantity=Decimal("0"),
                    minimum_level=Decimal(str(item_data["minimum_level"])),
                    cost_per_unit=Decimal(str(item_data["cost_per_unit"])),
                ))
                seeded_stock += 1
        # ── Quotation Products ───────────────────────────────────────────────
        from app.models.product import Product
        seeded_products = 0
        for prod_data in PRODUCTS:
            existing = (
                await db.execute(
                    select(Product).where(Product.name == prod_data["name"])
                )
            ).scalars().first()
            if not existing:
                db.add(Product(
                    name=prod_data["name"],
                    category=prod_data["category"],
                    unit=prod_data["unit"],
                    unit_price=Decimal(str(prod_data["unit_price"])),
                    gst_percent=Decimal(str(prod_data["gst_percent"])),
                    description=prod_data["description"],
                    sort_order=prod_data.get("sort_order", 0),
                    is_active=True,
                ))
                seeded_products += 1
            else:
                # Update description/pricing if existing is missing it
                existing.description = prod_data["description"]
                existing.category = prod_data["category"]
                existing.unit = prod_data["unit"]
                existing.unit_price = Decimal(str(prod_data["unit_price"]))
                existing.gst_percent = Decimal(str(prod_data["gst_percent"]))
                existing.sort_order = prod_data.get("sort_order", 0)
                db.add(existing)
        await db.commit()
        print(f"OK - {seeded_products} new products seeded (all verified/updated)")

        print("\nOK Seed complete!")
        print(f"   CEO configured as -> {settings.INITIAL_CEO_USERNAME}")


if __name__ == "__main__":
    asyncio.run(seed())

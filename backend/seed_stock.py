import asyncio
import re
from sqlalchemy import select
from decimal import Decimal
from app.core.database import AsyncSessionLocal
from app.models.stock_item import StockItem, StockTransaction

raw_data = """
1.
Description: ADANI BIFACIAL PANEL DCR
Size: 555 W
Taken Material: 6 NOS
Usage Material: 6 NOS
Balance Material: 0
Material Rate: 82518

2.
Description: V Sole Inverter
Size: 3 KW-1 Ph
Taken Material: 1 NOS
Usage Material: 1 NOS
Balance Material: 0
Material Rate: 14527

3.
Description: ACDB
Size: 1-5 KW
Taken Material: 1 NOS
Usage Material: 1 NOS
Balance Material: 0
Material Rate: 1457

4.
Description: DCDB
Size: 1-5 KW
Taken Material: 1 NOS
Usage Material: 1 NOS
Balance Material: 0
Material Rate: 1711

5.
Description: Earth Cable
Size: 16 Sqmm
Taken Material: 70 MTR
Usage Material: 47 NOS
Balance Material: 23 MTR
Material Rate: 1598

6.
Description: Earthing Rod
Size: 1 Mtr
Taken Material: 2 NOS
Usage Material: 2 NOS
Balance Material: 0
Material Rate: 424

7.
Description: Earth Bit Cover
Size: 6
Taken Material: 2 NOS
Usage Material: 2 NOS
Balance Material: 0
Material Rate: 368

8.
Description: Lightning Arrestor
Size: Micron 1.2 Mtr
Taken Material: 1 NOS
Usage Material: 1 NOS
Balance Material: 0
Material Rate: 1398

9.
Description: DC Cable Kanbery
Size: 4 SQmm
Taken Material: 70 MTR
Usage Material: 39 MTR
Balance Material: 31 MTR
Material Rate: 2145

10.
Description: AC RR Cable (Black)
Size: 2.5 Sqmm
Taken Material: 15 MTR
Usage Material: 9 MTR
Balance Material: 6 MTR
Material Rate: 270

11.
Description: AC RR Cable (Green)
Size: 2.5 Sqmm
Taken Material: 10 MTR
Usage Material: 5 MTR
Balance Material: 5 MTR
Material Rate: 150

12.
Description: Chemical bag
Size: 10 KG
Taken Material: 1 NOS
Usage Material: 1 NOS
Balance Material: 0
Material Rate: 75

13.
Description: MC4 Connector
Size: -
Taken Material: 5 NOS
Usage Material: 4 NOS
Balance Material: 1 NOS
Material Rate: 108

14.
Description: Half Set Type Bend
Size: 3/4 Inch
Taken Material: 4 NOS
Usage Material: 1 NOS
Balance Material: 3 NOS
Material Rate: 48

15.
Description: Duck Channel
Size: 45*45
Taken Material: 1 NOS
Usage Material: 1 NOS
Balance Material: 0
Material Rate: 89

16.
Description: Earth Bolt
Size: 8mm
Taken Material: 6 NOS
Usage Material: 4 NOS
Balance Material: 2 NOS
Material Rate: 31

17.
Description: Leg
Size: 16mm
Taken Material: 6 NOS
Usage Material: 5 NOS
Balance Material: 1 NOS
Material Rate: 100

18.
Description: Wooden screw
Size: -
Taken Material: 1 PKT
Usage Material: 1 PKT
Balance Material: 0
Material Rate: 615

19.
Description: Wooden Plug
Size: -
Taken Material: 1 PKT
Usage Material: 1 PKT
Balance Material: 0
Material Rate: 41

20.
Description: Cable tie
Size: 300mm
Taken Material: 1 PKT
Usage Material: 1/2 PKT
Balance Material: 1/2 PKT
Material Rate: 57

21.
Description: Cable tie
Size: 400mm
Taken Material: 10 NOS
Usage Material: 10 NOS
Balance Material: 0
Material Rate: 32

22.
Description: Plumbing Pipe
Size: 3/4 Inch
Taken Material: 6 NOS
Usage Material: 4 NOS
Balance Material: 2 NOS
Material Rate: 1084

23.
Description: Bend
Size: 3/4 Inch
Taken Material: 15 NOS
Usage Material: 3 NOS
Balance Material: 12 NOS
Material Rate: 54

24.
Description: L-Bow
Size: 3/4 Inch
Taken Material: 15 NOS
Usage Material: 14 NOS
Balance Material: 1 NOS
Material Rate: 127

25.
Description: Tee
Size: 3/4 Inch
Taken Material: 10 NOS
Usage Material: 1 NOS
Balance Material: 9 NOS
Material Rate: 15

26.
Description: Shoe
Size: 3/4 Inch
Taken Material: 10 NOS
Usage Material: 6 NOS
Balance Material: 4 NOS
Material Rate: 54

27.
Description: Cupler
Size: 3/4 Inch
Taken Material: 10 NOS
Usage Material: 0
Balance Material: 10 NOS
Material Rate: 0

28.
Description: Saddle Clamp
Size: 3/4 Inch
Taken Material: 35 NOS
Usage Material: 21 NOS
Balance Material: 14 NOS
Material Rate: 110

29.
Description: Electrical Pipe
Size: 20mm
Taken Material: 10 NOS
Usage Material: 6 NOS
Balance Material: 4 NOS
Material Rate: 297

30.
Description: Bend
Size: 20mm
Taken Material: 15 NOS
Usage Material: 6 NOS
Balance Material: 9 NOS
Material Rate: 25

31.
Description: L Bow
Size: 20mm
Taken Material: 15 NOS
Usage Material: 14 NOS
Balance Material: 1 NOS
Material Rate: 39

32.
Description: Tee
Size: 20mm
Taken Material: 10 NOS
Usage Material: 0
Balance Material: 10 NOS
Material Rate: 0

33.
Description: Electrical Saddle Clamp
Size: 20mm
Taken Material: 35 NOS
Usage Material: 15 NOS
Balance Material: 15 NOS
Material Rate: 38

34.
Description: GI Structure Leg
Size: 5 Feet
Taken Material: 2 NOS
Usage Material: 2 NOS
Balance Material: 0
Material Rate: 1210

35.
Description: GI Structure Leg
Size: 3.1/2 Feet
Taken Material: 2 NOS
Usage Material: 2 NOS
Balance Material: 0
Material Rate: 847

36.
Description: GI Structure Base
Size: 12 Feet
Taken Material: 2 NOS
Usage Material: 2 NOS
Balance Material: 0
Material Rate: 2124

37.
Description: Burlin Bolt
Size: 2.1/2 Inch
Taken Material: 12 NOS
Usage Material: 8 NOS
Balance Material: 4 NOS
Material Rate: 208

38.
Description: Base Bolt
Size: 1.1/4 Inch
Taken Material: 20 NOS
Usage Material: 16 NOS
Balance Material: 4 NOS
Material Rate: 321

39.
Description: Anchor Bolt
Size: 100mm
Taken Material: 6 NOS
Usage Material: 3 NOS
Balance Material: 3 NOS
Material Rate: 42

40.
Description: Bullet Bolt
Size: 10mm
Taken Material: 25 NOS
Usage Material: 13 NOS
Balance Material: 12 NOS
Material Rate: 230

41.
Description: U Bolt
Size: 75mm
Taken Material: 20 NOS
Usage Material: 16 NOS
Balance Material: 4 NOS
Material Rate: 415

42.
Description: Panel Bolt Nut
Size: -
Taken Material: 4 NOS
Usage Material: 4 NOS
Balance Material: 0
Material Rate: 42

43.
Description: Cozuse Screw
Size: -
Taken Material: 5 NOS
Usage Material: 2 NOS
Balance Material: 3 NOS
Material Rate: 30

44.
Description: Middle Clamp
Size: 2 Hole 29mm
Taken Material: 10 NOS
Usage Material: 8 NOS
Balance Material: 2 NOS
Material Rate: 198

45.
Description: End Clamp
Size: 2 Hole 30mm
Taken Material: 10 NOS
Usage Material: 9 NOS
Balance Material: 1 NOS
Material Rate: 189

46.
Description: Chemical Liquid
Size: -
Taken Material: 1 NOS
Usage Material: 1 NOS
Balance Material: 0
Material Rate: 300

47.
Description: Insulation Tape R,Y,G,B2
Size: -
Taken Material: 5 NOS
Usage Material: 5 NOS
Balance Material: 0
Material Rate: 70
"""

def parse_float(val_str):
    v = val_str.replace("1/2", "0.5").split()[0]
    try:
        return float(v)
    except:
        return 0.0

def determine_category(desc):
    desc = desc.lower()
    if 'panel' in desc: return 'Panels'
    if 'inverter' in desc: return 'Inverters'
    if 'cable' in desc: return 'Cables'
    if 'earth' in desc or 'lightning' in desc: return 'Earthing'
    if 'structure' in desc or 'leg' in desc or 'base' in desc: return 'Structure'
    if 'bolt' in desc or 'screw' in desc or 'nut' in desc or 'clamp' in desc: return 'Fasteners'
    if 'plumbing' in desc or 'pipe' in desc or 'bend' in desc or 'bow' in desc or 'tee' in desc: return 'Plumbing'
    if 'acdb' in desc or 'dcdb' in desc or 'connector' in desc or 'tie' in desc: return 'Electrical'
    return 'Accessories'

async def seed():
    records = []
    blocks = raw_data.strip().split("\n\n")
    for block in blocks:
        lines = block.split("\n")
        if len(lines) < 6: continue
        desc = lines[1].split(": ", 1)[1]
        size = lines[2].split(": ", 1)[1]
        bal_str = lines[5].split(": ", 1)[1]
        rate_str = lines[6].split(": ", 1)[1]
        
        parts = bal_str.split(" ")
        unit = "pcs"
        if len(parts) > 1 and parts[1].strip() != "0":
            unit = parts[1].strip().lower()
        if unit == "nos":
            unit = "pcs"
        elif unit == "mtr":
            unit = "m"
        elif unit == "pkt":
            unit = "pack"
            
        qty = parse_float(bal_str)
        rate = float(rate_str)
        cat = determine_category(desc)
        
        records.append({
            "product_name": desc,
            "model": size if size != "-" else None,
            "category": cat,
            "unit": unit,
            "current_quantity": Decimal(str(qty)),
            "cost_per_unit": Decimal(str(rate)),
            "minimum_level": Decimal("0")
        })

    async with AsyncSessionLocal() as db:
        inserted = 0
        skipped = 0
        for r in records:
            # Check duplicate
            stmt = select(StockItem).where(
                StockItem.product_name == r["product_name"],
                StockItem.unit == r["unit"]
            )
            if r["model"]:
                stmt = stmt.where(StockItem.model == r["model"])
            
            existing = (await db.execute(stmt)).scalars().first()
            if existing:
                skipped += 1
                continue
                
            item = StockItem(**r)
            db.add(item)
            await db.flush() # get ID
            
            if r["current_quantity"] > 0:
                txn = StockTransaction(
                    stock_item_id=item.id,
                    transaction_type="Stock In",
                    quantity=r["current_quantity"],
                    reference="Initial Seed",
                    notes="Imported from balance material",
                )
                db.add(txn)
                
            inserted += 1
            
        await db.commit()
        print(f"Seed complete. Inserted {inserted}, Skipped {skipped}.")

if __name__ == "__main__":
    asyncio.run(seed())

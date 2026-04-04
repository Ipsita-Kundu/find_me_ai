import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient("mongodb://findmeai-mongo:27017")
    db = client["find_me_ai"]

    print("=== ALERTS ===")
    alerts = await db["alerts"].find({}).to_list(5)
    for a in alerts:
        aid = a["_id"]
        mid = a.get("missing_id")
        fid = a.get("found_id")
        sim = a.get("similarity")
        mcb = a.get("missing_created_by")
        fcb = a.get("found_created_by")
        print(f"  alert={aid}  missing_id={mid}(type={type(mid).__name__})  found_id={fid}(type={type(fid).__name__})  sim={sim}  mcb={mcb}  fcb={fcb}")

    print("\n=== USERS ===")
    users = await db["users"].find({}).to_list(10)
    for u in users:
        print(f"  id={u['_id']}  email={u.get('email')}  provider={u.get('provider')}")

    print("\n=== MISSING REPORTS ===")
    missing = await db["missing_reports"].find({}, {"_id": 1, "name": 1, "created_by": 1, "status": 1}).to_list(10)
    for m in missing:
        print(f"  id={m['_id']}  name={m.get('name')}  created_by={m.get('created_by')}  status={m.get('status')}")

    print("\n=== FOUND REPORTS ===")
    found = await db["found_reports"].find({}, {"_id": 1, "created_by": 1, "status": 1}).to_list(10)
    for f in found:
        print(f"  id={f['_id']}  created_by={f.get('created_by')}  status={f.get('status')}")

asyncio.run(check())

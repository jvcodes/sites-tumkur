from listings.mongo import site_collection

from pymongo import ReturnDocument

def generate_site_code():
    counter = site_collection.database.counters.find_one_and_update(
        {"_id": "site_code"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return f"SITE-{counter['seq']:04d}"

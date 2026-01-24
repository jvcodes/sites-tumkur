from listings.mongo import site_collection

def generate_site_code():
    counter = site_collection.database.counters.find_one_and_update(
        {"_id": "site_code"},
        {"$inc": {"seq": 1}},
        return_document=True
    )
    return f"TUMK-{counter['seq']:04d}"

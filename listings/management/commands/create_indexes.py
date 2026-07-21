from django.core.management.base import BaseCommand
from listings.mongo import site_collection, locations_collection
import pymongo

class Command(BaseCommand):
    help = 'Creates MongoDB indexes for faster querying'

    def handle(self, *args, **options):
        self.stdout.write("Creating MongoDB indexes...")
        
        # Indexes for site_collection
        # 1. Compound index for default queries (status, is_deleted)
        site_collection.create_index([("status", pymongo.ASCENDING), ("is_deleted", pymongo.ASCENDING)])
        
        # 2. Indexes for frequently filtered fields
        site_collection.create_index("location_id")
        site_collection.create_index("price")
        site_collection.create_index("area")
        site_collection.create_index("facing")
        site_collection.create_index("is_layout")
        
        # 3. Index for sorting
        site_collection.create_index([("created_at", pymongo.DESCENDING)])
        
        # Indexes for locations_collection
        locations_collection.create_index("city")
        
        self.stdout.write(self.style.SUCCESS('Successfully created MongoDB indexes!'))

from pymongo import MongoClient

client = MongoClient("mongodb://127.0.0.1:27017/")
db = client["site_db"]
site_collection = db["sites"]
chat_collection = db["chats"]
booking_collection = db["bookings"]

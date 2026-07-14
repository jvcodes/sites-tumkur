import json
from unittest.mock import patch, MagicMock
from django.test import TestCase
from rest_framework.test import APIRequestFactory
from api.views import filter_sites_api

class FilterSitesAPITests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    @patch('api.views.site_collection')
    def test_search_by_keyword(self, mock_site_collection):
        # Mock the MongoDB cursor and count_documents
        mock_cursor = MagicMock()
        mock_cursor.skip.return_value.limit.return_value = [
            {"_id": "1", "name": "Tumkur Plot", "location": "Tumkur", "price": 1000000}
        ]
        mock_site_collection.find.return_value = mock_cursor
        mock_site_collection.count_documents.return_value = 1

        request = self.factory.get('/api/sites/filter/?search=Tumkur')
        response = filter_sites_api(request)
        response.render()
        
        data = json.loads(response.content)
        self.assertEqual(data['total'], 1)
        self.assertEqual(len(data['results']), 1)
        
        # Verify that MongoDB was queried with the correct $regex
        find_call_args = mock_site_collection.find.call_args[0][0]
        self.assertIn('$or', find_call_args)
        
        # Ensure 'name', 'location', 'landmark', 'site_code' are in the $or query
        or_conditions = find_call_args['$or']
        fields_searched = [list(cond.keys())[0] for cond in or_conditions]
        self.assertIn('name', fields_searched)
        self.assertIn('location', fields_searched)

    @patch('api.views.site_collection')
    def test_filter_by_multiple_locations(self, mock_site_collection):
        mock_cursor = MagicMock()
        mock_cursor.skip.return_value.limit.return_value = []
        mock_site_collection.find.return_value = mock_cursor
        mock_site_collection.count_documents.return_value = 0

        request = self.factory.get('/api/sites/filter/?location=Tumkur,Sira')
        response = filter_sites_api(request)
        
        find_call_args = mock_site_collection.find.call_args[0][0]
        
        # Should translate into an $in regex query
        self.assertIn('location', find_call_args)
        self.assertIn('$in', find_call_args['location'])
        self.assertEqual(len(find_call_args['location']['$in']), 2)

    @patch('api.views.site_collection')
    def test_filter_by_price_range(self, mock_site_collection):
        mock_cursor = MagicMock()
        mock_cursor.skip.return_value.limit.return_value = []
        mock_site_collection.find.return_value = mock_cursor

        request = self.factory.get('/api/sites/filter/?min_price=1000&max_price=5000')
        response = filter_sites_api(request)
        
        find_call_args = mock_site_collection.find.call_args[0][0]
        
        self.assertIn('price', find_call_args)
        self.assertEqual(find_call_args['price']['$gte'], 1000)
        self.assertEqual(find_call_args['price']['$lte'], 5000)

class CreateSiteAPITests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    @patch('api.views.site_collection')
    @patch('listings.mongo.locations_collection')
    @patch('listings.mongo.site_images_collection')
    def test_create_site_with_lat_long(self, mock_site_images, mock_locations, mock_site_collection):
        # Mock location lookup
        mock_locations.find_one.return_value = {"_id": "loc123", "city": "Tumkur", "area": "Tumkur"}
        
        # We also need to mock default_storage.save inside create_site_api, but we aren't passing images here, so it's fine.
        
        request = self.factory.post('/api/sites/create', {
            "name": "GPS Plot",
            "location": "Tumkur",
            "price": "1500000",
            "latitude": "13.33",
            "longitude": "77.10"
        })
        
        from api.views import create_site_api
        response = create_site_api(request)
        
        self.assertEqual(response.status_code, 201)
        
        # Verify the data that was inserted
        insert_args = mock_site_collection.insert_one.call_args[0][0]
        self.assertEqual(insert_args['name'], "GPS Plot")
        self.assertEqual(insert_args['latitude'], 13.33)
        self.assertEqual(insert_args['longitude'], 77.10)

    @patch('api.views.site_collection')
    @patch('listings.mongo.locations_collection')
    def test_create_site_invalid_coordinates(self, mock_locations, mock_site_collection):
        mock_locations.find_one.return_value = {"_id": "loc123", "city": "Tumkur"}
        request = self.factory.post('/api/sites/create', {
            "name": "Bad GPS Plot",
            "location": "Tumkur",
            "latitude": "invalid_lat",
            "longitude": "77.10"
        })
        
        from api.views import create_site_api
        response = create_site_api(request)
        
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.data)
        mock_site_collection.insert_one.assert_not_called()

    @patch('api.views.site_collection')
    @patch('listings.mongo.locations_collection')
    def test_create_site_duplicate_prevention(self, mock_locations, mock_site_collection):
        mock_locations.find_one.return_value = {"_id": "loc123", "city": "Tumkur"}
        # Mock that a site already exists with this user, dimension, and location
        mock_site_collection.find_one.return_value = {"_id": "dup123"}
        
        request = self.factory.post('/api/sites/create', {
            "name": "Dup Plot",
            "location": "Tumkur",
            "dimension": "30x40",
            "user_id": "user123"
        })
        
        from api.views import create_site_api
        response = create_site_api(request)
        
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.data)
        mock_site_collection.insert_one.assert_not_called()

class HydrateSitesTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    @patch('listings.mongo.locations_collection')
    @patch('listings.mongo.site_images_collection')
    def test_hydrate_sites_with_location_and_gps(self, mock_site_images, mock_locations):
        mock_locations.find.return_value = [{"_id": "507f1f77bcf86cd799439011", "city": "Tumkur City", "area": "Tumkur Area"}]
        mock_site_images.find.return_value.sort.return_value = []
        
        raw_sites = [
            {
                "_id": "site1",
                "site_code": "SITE-001",
                "location_id": "507f1f77bcf86cd799439011",
                "latitude": 13.0,
                "longitude": 77.0
            }
        ]
        
        from api.views import hydrate_sites
        request = self.factory.get('/')
        hydrated = hydrate_sites(request, raw_sites)
        
        self.assertEqual(len(hydrated), 1)
        self.assertEqual(hydrated[0]["location"], "Tumkur City")
        self.assertEqual(hydrated[0]["latitude"], 13.0)
        self.assertEqual(hydrated[0]["longitude"], 77.0)

class CreateBookingAPITests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    @patch('api.views.booking_collection')
    @patch('listings.mongo.user_profiles_collection')
    def test_create_booking_valid(self, mock_user_profiles, mock_booking_collection):
        request = self.factory.post('/api/bookings/create', {
            "name": "Test Booker",
            "phone": "9999999999",
            "date": "2026-08-01",
            "time": "10:00",
            "sites": ["SITE-1", "SITE-2"]
        }, format='json')
        
        from api.views import create_booking_api
        response = create_booking_api(request)
        
        self.assertEqual(response.status_code, 201)
        insert_args = mock_booking_collection.insert_one.call_args[0][0]
        self.assertEqual(insert_args['name'], "Test Booker")
        self.assertEqual(insert_args['sites'], ["SITE-1", "SITE-2"])

    def test_create_booking_empty_cart(self):
        request = self.factory.post('/api/bookings/create', {
            "name": "Test Booker",
            "phone": "9999999999",
            "date": "2026-08-01",
            "time": "10:00",
            "sites": []  # Empty cart!
        }, format='json')
        
        from api.views import create_booking_api
        response = create_booking_api(request)
        
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.data)



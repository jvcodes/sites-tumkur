import json
from unittest.mock import patch, MagicMock
from django.test import TestCase
from rest_framework.test import APIRequestFactory
from api.views import filter_sites_api


def _get_match_stage(pipeline):
    """Extract the $match stage query dict from an aggregation pipeline.
    
    Every pipeline built by filter_sites_api starts with a $match stage.
    This helper locates it for test assertions.
    """
    for stage in pipeline:
        if "$match" in stage:
            return stage["$match"]
    return {}


def _get_stage(pipeline, stage_name):
    """Extract the first occurrence of a specific aggregation stage.
    
    Useful for checking $addFields, $sort, $skip, $limit stages.
    Returns the stage dict (e.g. {"boost_score": ...}) or None.
    """
    for stage in pipeline:
        if stage_name in stage:
            return stage[stage_name]
    return None


class FilterSitesAPITests(TestCase):
    """Tests for the filter_sites_api endpoint.
    
    IMPORTANT: filter_sites_api now uses a MongoDB Aggregation Pipeline
    (site_collection.aggregate) instead of a simple cursor (site_collection.find).
    All tests mock .aggregate() and verify the pipeline stages.
    """
    def setUp(self):
        self.factory = APIRequestFactory()

    @patch('api.views.site_collection')
    def test_search_by_keyword(self, mock_site_collection):
        """Verify that a search term triggers $or regex queries across
        name, location, landmark, site_code, and layout_name fields."""
        # Mock aggregate to return a list of matching sites
        mock_site_collection.aggregate.return_value = [
            {"_id": "1", "name": "Tumkur Plot", "location": "Tumkur", "price": 1000000}
        ]
        mock_site_collection.count_documents.return_value = 1

        request = self.factory.get('/api/sites/filter/?search=Tumkur')
        response = filter_sites_api(request)
        response.render()
        
        data = json.loads(response.content)
        self.assertEqual(data['total'], 1)
        self.assertEqual(len(data['results']), 1)
        
        # Extract the pipeline passed to aggregate()
        pipeline = mock_site_collection.aggregate.call_args[0][0]
        match_query = _get_match_stage(pipeline)
        
        # Verify that MongoDB was queried with the correct $regex
        self.assertIn('$or', match_query)
        
        # Ensure 'name', 'location', 'landmark', 'site_code' are in the $or query
        or_conditions = match_query['$or']
        fields_searched = [list(cond.keys())[0] for cond in or_conditions]
        self.assertIn('name', fields_searched)
        self.assertIn('location', fields_searched)

    @patch('api.views.site_collection')
    def test_filter_by_multiple_locations(self, mock_site_collection):
        """Verify that comma-separated locations produce an $in regex array."""
        mock_site_collection.aggregate.return_value = []
        mock_site_collection.count_documents.return_value = 0

        request = self.factory.get('/api/sites/filter/?location=Tumkur,Sira')
        response = filter_sites_api(request)
        
        pipeline = mock_site_collection.aggregate.call_args[0][0]
        match_query = _get_match_stage(pipeline)
        
        # Should translate into an $in regex query
        self.assertIn('location', match_query)
        self.assertIn('$in', match_query['location'])
        self.assertEqual(len(match_query['location']['$in']), 2)

    @patch('api.views.site_collection')
    def test_filter_by_price_range(self, mock_site_collection):
        """Verify that min_price and max_price produce $gte/$lte on the price field."""
        mock_site_collection.aggregate.return_value = []

        request = self.factory.get('/api/sites/filter/?min_price=1000&max_price=5000')
        response = filter_sites_api(request)
        
        pipeline = mock_site_collection.aggregate.call_args[0][0]
        match_query = _get_match_stage(pipeline)
        
        self.assertIn('price', match_query)
        self.assertEqual(match_query['price']['$gte'], 1000)
        self.assertEqual(match_query['price']['$lte'], 5000)

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

class CartAPITests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    @patch('api.cart_views.carts_collection')
    @patch('api.cart_views.site_collection')
    def test_get_cart(self, mock_site_collection, mock_carts_collection):
        mock_carts_collection.find_one.return_value = {
            "user_id": "9999999999",
            "sites": ["SITE-1", "SITE-2"]
        }
        
        # Mock site_collection.find to return hydrated sites
        mock_cursor = MagicMock()
        mock_cursor.__iter__.return_value = [
            {"_id": "1", "site_code": "SITE-1", "name": "Test 1", "price": 100, "location": "Test Loc 1"},
            {"_id": "2", "site_code": "SITE-2", "name": "Test 2", "price": 200, "location": "Test Loc 2"}
        ]
        mock_site_collection.find.return_value = mock_cursor

        request = self.factory.get('/api/cart/?user_id=9999999999')
        from api.cart_views import get_cart
        response = get_cart(request)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        
    @patch('api.cart_views.carts_collection')
    def test_sync_cart(self, mock_carts_collection):
        request = self.factory.post('/api/cart/sync/', {
            "user_id": "9999999999",
            "cart": [
                {"site_code": "SITE-1"},
                {"site_code": "SITE-2"},
                {"site_code": "SITE-1"}  # Test deduplication
            ]
        }, format='json')
        
        from api.cart_views import sync_cart
        response = sync_cart(request)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total"], 2)
        
        update_call_args = mock_carts_collection.update_one.call_args[0]
        self.assertEqual(update_call_args[0], {"user_id": "9999999999"})
        self.assertEqual(update_call_args[1], {"$set": {"sites": ["SITE-1", "SITE-2"]}})
        self.assertTrue(mock_carts_collection.update_one.call_args[1]["upsert"])

class DraftAndLayoutAPITests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    @patch('api.views.drafts_collection')
    def test_save_draft_api(self, mock_drafts_collection):
        request = self.factory.post('/api/sites/draft/', {
            "phone": "9999999999",
            "name": "Test User",
            "form_data": {"price": "1000", "isLayout": True, "layoutName": "Green Valley"}
        }, format='json')
        
        from api.views import save_draft_api
        response = save_draft_api(request)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "draft saved")
        
        mock_drafts_collection.update_one.assert_called_once()
        update_args, update_kwargs = mock_drafts_collection.update_one.call_args
        self.assertEqual(update_args[0], {"phone": "9999999999"})
        self.assertEqual(update_args[1]["$set"]["name"], "Test User")
        self.assertTrue(update_kwargs["upsert"])

    @patch('api.views.site_collection')
    def test_layout_filter(self, mock_site_collection):
        """Verify that is_layout=true and search work together in the pipeline."""
        mock_site_collection.aggregate.return_value = []
        mock_site_collection.count_documents.return_value = 0

        request = self.factory.get('/api/sites/filter/?is_layout=true&search=Valley')
        from api.views import filter_sites_api
        response = filter_sites_api(request)
        
        pipeline = mock_site_collection.aggregate.call_args[0][0]
        match_query = _get_match_stage(pipeline)
        self.assertTrue(match_query["is_layout"])
        
        or_conditions = match_query['$or']
        fields_searched = [list(cond.keys())[0] for cond in or_conditions]
        self.assertIn('layout_name', fields_searched)


class BoostLocationAPITests(TestCase):
    """Tests for the Hybrid Boosting personalization feature.
    
    These tests verify that:
    1. Passing `boost_location` injects an $addFields stage with boost_score
    2. Boosting is skipped when an explicit sort is active (user intent wins)
    3. Empty boost_location produces no $addFields stage (default sort only)
    """
    def setUp(self):
        self.factory = APIRequestFactory()

    @patch('api.views.site_collection')
    def test_boost_location_injects_addfields_and_sort(self, mock_site_collection):
        """When boost_location is provided and no explicit sort is set,
        the pipeline should contain an $addFields stage with boost_score
        and a $sort stage ordering by boost_score DESC, created_at DESC."""
        mock_site_collection.aggregate.return_value = []
        mock_site_collection.count_documents.return_value = 0

        request = self.factory.get('/api/sites/filter/?boost_location=S.S. Puram')
        response = filter_sites_api(request)

        pipeline = mock_site_collection.aggregate.call_args[0][0]

        # Verify $addFields stage exists with boost_score
        add_fields = _get_stage(pipeline, "$addFields")
        self.assertIsNotNone(add_fields, "Pipeline should contain $addFields for boosting")
        self.assertIn("boost_score", add_fields)

        # Verify the $cond uses $regexMatch on the location field
        cond = add_fields["boost_score"]["$cond"]
        self.assertIn("$regexMatch", cond["if"])
        self.assertEqual(cond["then"], 1)
        self.assertEqual(cond["else"], 0)

        # Verify $sort stage orders by boost_score first
        sort_stage = _get_stage(pipeline, "$sort")
        self.assertIsNotNone(sort_stage, "Pipeline should contain $sort")
        self.assertEqual(sort_stage.get("boost_score"), -1)
        self.assertEqual(sort_stage.get("created_at"), -1)

    @patch('api.views.site_collection')
    def test_boost_location_disabled_when_explicit_sort(self, mock_site_collection):
        """When user sets an explicit sort (e.g. price_low), boosting should
        be completely disabled — no $addFields, and sort should be by price."""
        mock_site_collection.aggregate.return_value = []
        mock_site_collection.count_documents.return_value = 0

        # User sends both boost_location AND sort — explicit sort should win
        request = self.factory.get('/api/sites/filter/?boost_location=Gubbi&sort=price_low')
        response = filter_sites_api(request)

        pipeline = mock_site_collection.aggregate.call_args[0][0]

        # $addFields should NOT exist — user's manual sort takes priority
        add_fields = _get_stage(pipeline, "$addFields")
        self.assertIsNone(add_fields, "Boosting should be disabled when explicit sort is active")

        # $sort should be price ascending
        sort_stage = _get_stage(pipeline, "$sort")
        self.assertEqual(sort_stage, {"price": 1})

    @patch('api.views.site_collection')
    def test_no_boost_when_empty_location(self, mock_site_collection):
        """When boost_location is empty or missing, no $addFields should
        be injected and the default sort (created_at DESC) should apply."""
        mock_site_collection.aggregate.return_value = []
        mock_site_collection.count_documents.return_value = 0

        request = self.factory.get('/api/sites/filter/')
        response = filter_sites_api(request)

        pipeline = mock_site_collection.aggregate.call_args[0][0]

        # No $addFields for boosting
        add_fields = _get_stage(pipeline, "$addFields")
        self.assertIsNone(add_fields, "No boosting should occur without boost_location")

        # Default sort by created_at DESC
        sort_stage = _get_stage(pipeline, "$sort")
        self.assertEqual(sort_stage, {"created_at": -1})

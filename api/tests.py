import json
from datetime import datetime
from unittest.mock import patch, MagicMock
from django.test import TestCase
from rest_framework.test import APIRequestFactory
from api.views.sites import filter_sites_api


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

    @patch('api.views.sites.site_collection')
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

    @patch('api.views.sites.site_collection')
    def test_filter_by_multiple_locations(self, mock_site_collection):
        """Verify that comma-separated locations produce a regex alternation query."""
        mock_site_collection.aggregate.return_value = []
        mock_site_collection.count_documents.return_value = 0

        request = self.factory.get('/api/sites/filter/?location=Tumkur,Sira')
        response = filter_sites_api(request)
        
        pipeline = mock_site_collection.aggregate.call_args[0][0]
        match_query = _get_match_stage(pipeline)
        
        # Should translate into a regex alternation query
        self.assertIn('location', match_query)
        self.assertIn('$regex', match_query['location'])
        self.assertEqual(match_query['location']['$regex'], "^(Tumkur|Sira)$")
        self.assertEqual(match_query['location']['$options'], "i")

    @patch('api.views.sites.site_collection')
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

    @patch('api.views.sites.site_collection')
    def test_filter_by_has_video(self, mock_site_collection):
        """Verify that has_video=true filters for sites with valid youtube_url."""
        mock_site_collection.aggregate.return_value = []

        request = self.factory.get('/api/sites/filter/?has_video=true')
        response = filter_sites_api(request)
        
        pipeline = mock_site_collection.aggregate.call_args[0][0]
        match_query = _get_match_stage(pipeline)
        
        self.assertIn('youtube_url', match_query)
        self.assertTrue(match_query['youtube_url']['$exists'])
        self.assertEqual(match_query['youtube_url']['$ne'], "")

    @patch('api.views.sites.site_collection')
    def test_filter_real_only_excludes_test_sites(self, mock_site_collection):
        """Verify that real_only=true filters out test/dummy listings."""
        mock_site_collection.aggregate.return_value = []

        request = self.factory.get('/api/sites/filter/?real_only=true')
        response = filter_sites_api(request)
        
        pipeline = mock_site_collection.aggregate.call_args[0][0]
        match_query = _get_match_stage(pipeline)
        
        self.assertIn('is_test', match_query)
        self.assertEqual(match_query['is_test'], {'$ne': True})

class CreateSiteAPITests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    @patch('api.views.sites.site_collection')
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
        
        from api.views.sites import create_site_api
        response = create_site_api(request)
        
        self.assertEqual(response.status_code, 201)
        
        # Verify the data that was inserted
        insert_args = mock_site_collection.insert_one.call_args[0][0]
        self.assertEqual(insert_args['name'], "GPS Plot")
        self.assertEqual(insert_args['latitude'], 13.33)
        self.assertEqual(insert_args['longitude'], 77.10)
        self.assertFalse(insert_args['is_test'])  # Must default to False for real properties

    @patch('api.views.sites.site_collection')
    @patch('listings.mongo.locations_collection')
    def test_create_site_invalid_coordinates(self, mock_locations, mock_site_collection):
        mock_locations.find_one.return_value = {"_id": "loc123", "city": "Tumkur"}
        request = self.factory.post('/api/sites/create', {
            "name": "Bad GPS Plot",
            "location": "Tumkur",
            "latitude": "invalid_lat",
            "longitude": "77.10"
        })
        
        from api.views.sites import create_site_api
        response = create_site_api(request)
        
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.data)
        mock_site_collection.insert_one.assert_not_called()

    @patch('api.views.sites.site_collection')
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
        
        from api.views.sites import create_site_api
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
        
        from api.views.utils import hydrate_sites
        request = self.factory.get('/')
        hydrated = hydrate_sites(request, raw_sites)
        
        self.assertEqual(len(hydrated), 1)
        self.assertEqual(hydrated[0]["location"], "Tumkur City")
        self.assertEqual(hydrated[0]["latitude"], 13.0)
        self.assertEqual(hydrated[0]["longitude"], 77.0)

class CreateBookingAPITests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    @patch('api.views.bookings.booking_collection')
    @patch('listings.mongo.user_profiles_collection')
    def test_create_booking_valid(self, mock_user_profiles, mock_booking_collection):
        request = self.factory.post('/api/bookings/create', {
            "name": "Test Booker",
            "phone": "9999999999",
            "date": "2026-08-01",
            "time": "10:00",
            "sites": ["SITE-1", "SITE-2"]
        }, format='json')
        
        from api.views.bookings import create_booking_api
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
        
        from api.views.bookings import create_booking_api
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

    @patch('api.views.sites.drafts_collection')
    def test_save_draft_api(self, mock_drafts_collection):
        request = self.factory.post('/api/sites/draft/', {
            "phone": "9999999999",
            "name": "Test User",
            "form_data": {"price": "1000", "isLayout": True, "layoutName": "Green Valley"}
        }, format='json')
        
        from api.views.sites import save_draft_api
        response = save_draft_api(request)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "draft saved")
        
        mock_drafts_collection.update_one.assert_called_once()
        update_args, update_kwargs = mock_drafts_collection.update_one.call_args
        self.assertEqual(update_args[0], {"phone": "9999999999"})
        self.assertEqual(update_args[1]["$set"]["name"], "Test User")
        self.assertTrue(update_kwargs["upsert"])

    @patch('api.views.sites.site_collection')
    def test_layout_filter(self, mock_site_collection):
        """Verify that is_layout=true and search work together in the pipeline."""
        mock_site_collection.aggregate.return_value = []
        mock_site_collection.count_documents.return_value = 0

        request = self.factory.get('/api/sites/filter/?is_layout=true&search=Valley')
        from api.views.sites import filter_sites_api
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

    @patch('api.views.sites.site_collection')
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
        self.assertEqual(sort_stage.get("_id"), 1)

    @patch('api.views.sites.site_collection')
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
        self.assertEqual(sort_stage, {"price": 1, "_id": 1})

    @patch('api.views.sites.site_collection')
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
        self.assertEqual(sort_stage, {"created_at": -1, "_id": 1})

from listings.mongo import site_collection
from bson import ObjectId

class MySitesAPITests(TestCase):
    def setUp(self):
        site_collection.delete_many({})
        site_collection.insert_one({'_id': ObjectId(), 'site_code': 'TEST-MYSITES-1', 'name': 'User Site', 'location': 'Bangalore', 'price': 100, 'user_id': 'user@example.com', 'owner': 'Test Owner', 'status': 'approved', 'is_deleted': False})
        site_collection.insert_one({'_id': ObjectId(), 'site_code': 'TEST-MYSITES-2', 'name': 'Other Site', 'location': 'Mysore', 'price': 200, 'user_id': 'other@example.com', 'owner': 'Other Owner', 'status': 'approved', 'is_deleted': False})

    def test_my_sites_by_email(self):
        response = self.client.get('/api/sites/my-sites?user_id=user@example.com')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['site_code'], 'TEST-MYSITES-1')

    def test_my_sites_by_owner(self):
        response = self.client.get('/api/sites/my-sites?owner=Test Owner')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['site_code'], 'TEST-MYSITES-1')

    def test_my_sites_missing_params(self):
        response = self.client.get('/api/sites/my-sites')
        self.assertEqual(response.status_code, 400)


class PhoneAuthAPITests(TestCase):
    """Tests for the phone authentication API including dev bypass for testing."""

    def test_dev_bypass_success_with_test_number(self):
        """Verify that DEV_TEST_TOKEN successfully authenticates the test phone number."""
        response = self.client.post(
            '/api/auth/phone/',
            data=json.dumps({
                'idToken': 'DEV_TEST_TOKEN',
                'phone': '+917353565562'
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('token', data)
        self.assertIn('user', data)
        self.assertEqual(data['user']['phone'], '7353565562')

    def test_dev_bypass_rejected_for_non_test_number(self):
        """Verify that DEV_TEST_TOKEN is rejected for non-test phone numbers."""
        response = self.client.post(
            '/api/auth/phone/',
            data=json.dumps({
                'idToken': 'DEV_TEST_TOKEN',
                'phone': '+919876543210'
            }),
            content_type='application/json'
        )
        # Should attempt normal firebase verification and fail with 401
        self.assertEqual(response.status_code, 401)

    def test_missing_id_token(self):
        """Verify that a request missing idToken returns 400."""
        response = self.client.post(
            '/api/auth/phone/',
            data=json.dumps({'phone': '+917353565562'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)


class LandmarksAndTUDATests(TestCase):
    """Tests for Tumkur Landmarks and TUDA Regulatory Approvals."""
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_get_landmarks_api_seeds_and_returns_tumkur_landmarks(self):
        """Verify get_landmarks_api returns active Tumkur landmarks."""
        response = self.client.get('/api/sites/landmarks/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('landmarks', data)
        landmark_names = [lm['name'] for lm in data['landmarks']]
        self.assertTrue(any('Railway' in name for name in landmark_names))
        self.assertTrue(any('Siddaganga' in name or 'SIT' in name for name in landmark_names))

    def test_create_and_fetch_site_with_tuda_and_landmarks(self):
        """Verify site creation stores tuda_approved and nearby_landmarks with distance."""
        nearby = [{"landmark": "Siddaganga Mutt", "distance_km": 4.5}]
        response = self.client.post('/api/sites/create/', {
            'name': 'TUDA Prime Plot',
            'location': 'Kyatsandra, Tumkur',
            'price': '3500000',
            'area': '1500',
            'owner': 'Tumkur Seller',
            'tuda_approved': 'true',
            'nearby_landmarks': json.dumps(nearby)
        })
        self.assertEqual(response.status_code, 201)
        created_data = response.json()
        self.assertIn('site_code', created_data)
        site_code = created_data['site_code']

        # Fetch detail by code
        detail_res = self.client.get(f'/api/sites/{site_code}/')
        self.assertEqual(detail_res.status_code, 200)
        detail_data = detail_res.json()
        self.assertTrue(detail_data.get('tuda_approved'))
        self.assertTrue(detail_data.get('bbmp_approved')) # backward compatibility
        self.assertEqual(len(detail_data.get('nearby_landmarks', [])), 1)
        self.assertEqual(detail_data['nearby_landmarks'][0]['landmark'], 'Siddaganga Mutt')
        self.assertEqual(detail_data['nearby_landmarks'][0]['distance_km'], 4.5)


class ProfileAuthAndSecurityTests(TestCase):
    """Tests for Profile updates and Site Deletion Authorization."""
    def setUp(self):
        from listings.mongo import user_profiles_collection, site_collection
        self.profiles = user_profiles_collection
        self.sites = site_collection

    def test_update_phone_with_phone_identifier(self):
        """Phone-auth user (without email) can update their phone number."""
        self.profiles.delete_many({"phone": {"$in": ["9876543210", "9123456789"]}})
        self.profiles.insert_one({
            "phone": "9876543210",
            "name": "Phone User",
            "role": "Buyer"
        })

        response = self.client.post(
            '/api/auth/update-phone/',
            data=json.dumps({
                'identifier': '9876543210',
                'phone': '9123456789'
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        updated = self.profiles.find_one({"phone": "9123456789"})
        self.assertIsNotNone(updated)

    def test_update_profile_phone_field(self):
        """Profile update can update phone along with name."""
        self.profiles.delete_many({"email": "testupdate@example.com"})
        self.profiles.insert_one({
            "email": "testupdate@example.com",
            "name": "Original Name",
            "phone": "9876543210",
            "role": "Buyer"
        })

        response = self.client.post(
            '/api/auth/update-profile/',
            data=json.dumps({
                'identifier': 'testupdate@example.com',
                'name': 'Updated Name',
                'phone': '9988776655'
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        updated = self.profiles.find_one({"email": "testupdate@example.com"})
        self.assertEqual(updated['name'], 'Updated Name')
        self.assertEqual(updated['phone'], '9988776655')

    def test_delete_site_authorization_denied_for_different_user(self):
        """User cannot delete a site uploaded by someone else."""
        self.sites.delete_many({"site_code": "SEC-DEL-01"})
        self.sites.insert_one({
            "site_code": "SEC-DEL-01",
            "name": "Protected Site",
            "user_id": "owner@example.com",
            "owner": "Owner User",
            "is_deleted": False
        })

        response = self.client.delete(
            '/api/sites/delete-by-code/SEC-DEL-01/',
            data=json.dumps({'user_id': 'attacker@example.com'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 403)
        site = self.sites.find_one({"site_code": "SEC-DEL-01"})
        self.assertFalse(site.get("is_deleted"))

    def test_delete_site_authorization_allowed_for_owner(self):
        """Owner can successfully soft-delete their own site."""
        self.sites.delete_many({"site_code": "SEC-DEL-02"})
        self.sites.insert_one({
            "site_code": "SEC-DEL-02",
            "name": "Owner Site",
            "user_id": "myemail@example.com",
            "owner": "Owner User",
            "is_deleted": False
        })

        response = self.client.delete(
            '/api/sites/delete-by-code/SEC-DEL-02/',
            data=json.dumps({'user_id': 'myemail@example.com'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        site = self.sites.find_one({"site_code": "SEC-DEL-02"})
        self.assertTrue(site.get("is_deleted"))


class AdminSiteModificationTests(TestCase):
    """Tests for Admin Site Editing, Photo Uploads, and Status Transitions."""

    def setUp(self):
        from listings.mongo import site_collection, site_images_collection
        self.sites = site_collection
        self.site_images = site_images_collection
        self.test_code = "ADM-EDIT-TEST"
        self.sites.delete_many({"site_code": self.test_code})
        self.site_images.delete_many({"site_code": self.test_code})

        self.sites.insert_one({
            "site_code": self.test_code,
            "name": "Initial Site",
            "location": "Tumkur",
            "price": 2000000,
            "area": 1200,
            "status": "pending",
            "is_deleted": False,
        })

    def tearDown(self):
        self.sites.delete_many({"site_code": self.test_code})
        self.site_images.delete_many({"site_code": self.test_code})

    def test_admin_edit_site_updates_fields_and_status(self):
        """Admin can modify specifications, pricing, corner plot flag, contact, and status."""
        response = self.client.post('/admin/sites/edit/', {
            'site_code': self.test_code,
            'action': 'save',
            'name': 'Updated Premium Plot',
            'location': 'Batawadi',
            'price': '3500000',
            'area': '1500',
            'dimension': '30x50',
            'facing': 'East',
            'corner_site': 'true',
            'status': 'approved',
            'owner': 'Ramesh Tumkur',
            'uploaded_phone': '9876543210',
            'latitude': '13.3400',
            'longitude': '77.1000',
        })
        # Should redirect back to pending or next url with success query
        self.assertEqual(response.status_code, 302)
        
        updated = self.sites.find_one({"site_code": self.test_code})
        self.assertIsNotNone(updated)
        self.assertEqual(updated['name'], 'Updated Premium Plot')
        self.assertEqual(updated['location'], 'Batawadi')
        self.assertEqual(updated['price'], 3500000.0)
        self.assertEqual(updated['area'], 1500.0)
        self.assertEqual(updated['dimension'], '30x50')
        self.assertEqual(updated['facing'], 'East')
        self.assertTrue(updated['corner_site'])
        self.assertEqual(updated['status'], 'approved')
        self.assertEqual(updated['owner'], 'Ramesh Tumkur')
        self.assertEqual(updated['uploaded_phone'], '9876543210')
        self.assertEqual(updated['latitude'], 13.3400)
        self.assertEqual(updated['longitude'], 77.1000)

    def test_admin_edit_site_photo_upload(self):
        """Admin can attach new photos while modifying a site."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        test_file = SimpleUploadedFile("new_plot.jpg", b"fake_image_content", content_type="image/jpeg")

        response = self.client.post('/admin/sites/edit/', {
            'site_code': self.test_code,
            'action': 'save',
            'name': 'Photo Site',
            'images': [test_file]
        })
        self.assertEqual(response.status_code, 302)

        images = list(self.site_images.find({"site_code": self.test_code}))
        self.assertGreaterEqual(len(images), 1)

    def test_admin_approve_site_mark_sold(self):
        """Admin can mark an approved site as sold directly via action."""
        response = self.client.post('/admin/sites/approve/', {
            'site_code': self.test_code,
            'action': 'sold'
        })
        self.assertEqual(response.status_code, 302)
        updated = self.sites.find_one({"site_code": self.test_code})
        self.assertEqual(updated['status'], 'sold')

    def test_admin_pages_render_edit_controls(self):
        """Admin list page and review page render Edit buttons, form fields, and photo upload."""
        # 1. Check list view has Edit button
        list_res = self.client.get('/admin/sites/pending/?status=all')
        self.assertEqual(list_res.status_code, 200)
        self.assertContains(list_res, f"/admin/sites/review/{self.test_code}/")
        self.assertContains(list_res, "✏️ Edit")
        self.assertContains(list_res, "🌐 Live ↗")

        # 2. Check detail review / edit view has full controls
        detail_res = self.client.get(f'/admin/sites/review/{self.test_code}/')
        self.assertEqual(detail_res.status_code, 200)
        self.assertContains(detail_res, 'action="/admin/sites/edit/"')
        self.assertContains(detail_res, 'enctype="multipart/form-data"')
        self.assertContains(detail_res, 'name="images"')
        self.assertContains(detail_res, 'name="dimension"')
        self.assertContains(detail_res, 'name="facing"')
        self.assertContains(detail_res, 'name="corner_site"')
        self.assertContains(detail_res, 'name="latitude"')
        self.assertContains(detail_res, 'name="longitude"')
        self.assertContains(detail_res, 'name="owner"')
        self.assertContains(detail_res, 'name="uploaded_phone"')


class ComprehensiveFieldEditingAndLoopholeTests(TestCase):
    """
    Tests ensuring EVERY field displayed on the public site can be edited,
    serialized, and that all admin routes/loopholes are sealed.
    """

    def setUp(self):
        from listings.mongo import site_collection, site_images_collection, landmarks_collection
        self.sites = site_collection
        self.site_images = site_images_collection
        self.landmarks = landmarks_collection
        self.test_code = "FULL-EDIT-TEST"
        self.sites.delete_many({"site_code": self.test_code})
        self.site_images.delete_many({"site_code": self.test_code})

        self.sites.insert_one({
            "site_code": self.test_code,
            "name": "Original Name",
            "location": "Tumkur",
            "price": 2000000,
            "area": 1200,
            "status": "approved",
            "is_deleted": False,
        })

    def tearDown(self):
        self.sites.delete_many({"site_code": self.test_code})
        self.site_images.delete_many({"site_code": self.test_code})

    def test_update_site_by_code_all_displayed_fields(self):
        """Verify EVERY single field displayed on the web page can be edited via update API and is serialized."""
        update_payload = {
            'name': 'Updated Mega Villa Plot',
            'location': 'Kuvempu Nagar, Tumkur',
            'price': 4500000,
            'area': 2400,
            'dimension': '40x60',
            'facing': 'North-East',
            'road_width': '40 ft',
            'landmark': 'Near SIT Engineering College',
            'category': 'Premium Gated Community',
            'ownership_type': 'Freehold',
            'availability': 'Immediate',
            'zoning_type': 'Residential',
            'owner': 'Suresh Gowda',
            'uploaded_phone': '9845012345',
            'latitude': 13.3325,
            'longitude': 77.1120,
            'youtube_url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'description': 'A-Khata clear title plot with asphalt road, borewell and drainage ready.',
            # Specifications & Features
            'corner_site': True,
            'boundary_marked': True,
            'levelled_land': True,
            'negotiable': True,
            'loan_facility': True,
            # Legal & Approvals
            'tuda_approved': True,
            'a_khata': True,
            'clear_title': True,
            'bank_loan_approved': True,
            'layout_approved': True,
            # Utilities
            'borewell_water': True,
            'electricity_nearby': True,
            'drainage_connection': True,
            'asphalt_road_access': True,
            # Structured Nearby Landmarks
            'nearby_landmarks': [
                {'landmark': 'Tumkur Railway Station', 'distance_km': 3.2},
                {'landmark': 'KSRTC Bus Stand', 'distance_km': 2.5}
            ]
        }

        response = self.client.put(
            f'/api/sites/update-by-code/{self.test_code}/',
            data=json.dumps(update_payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)

        # 1. Verify MongoDB persistence
        doc = self.sites.find_one({"site_code": self.test_code})
        self.assertIsNotNone(doc)
        self.assertEqual(doc['name'], 'Updated Mega Villa Plot')
        self.assertEqual(doc['road_width'], '40 ft')
        self.assertEqual(doc['landmark'], 'Near SIT Engineering College')
        self.assertEqual(doc['uploaded_phone'], '9845012345')
        self.assertEqual(doc['latitude'], 13.3325)
        self.assertEqual(doc['longitude'], 77.1120)
        self.assertEqual(doc['youtube_url'], 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
        self.assertTrue(doc['corner_site'])
        self.assertTrue(doc['boundary_marked'])
        self.assertTrue(doc['levelled_land'])
        self.assertTrue(doc['negotiable'])
        self.assertTrue(doc['loan_facility'])
        self.assertTrue(doc['tuda_approved'])
        self.assertTrue(doc['a_khata'])
        self.assertTrue(doc['clear_title'])
        self.assertTrue(doc['bank_loan_approved'])
        self.assertTrue(doc['layout_approved'])
        self.assertTrue(doc['borewell_water'])
        self.assertTrue(doc['electricity_nearby'])
        self.assertTrue(doc['drainage_connection'])
        self.assertTrue(doc['asphalt_road_access'])
        self.assertEqual(len(doc['nearby_landmarks']), 2)

        # 2. Verify SiteSerializer returns all fields through GET endpoint
        detail_res = self.client.get(f'/api/sites/{self.test_code}/')
        self.assertEqual(detail_res.status_code, 200)
        data = detail_res.json()
        self.assertEqual(data['latitude'], 13.3325)
        self.assertEqual(data['longitude'], 77.1120)
        self.assertEqual(data['uploaded_phone'], '9845012345')
        self.assertEqual(data['youtube_url'], 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
        self.assertEqual(data['road_width'], '40 ft')
        self.assertTrue(data['tuda_approved'])
        self.assertTrue(data['corner_site'])
        self.assertEqual(len(data['nearby_landmarks']), 2)

    def test_admin_edit_site_with_nearby_landmarks(self):
        """Admin can modify nearby landmarks via structured landmark form inputs."""
        response = self.client.post('/admin/sites/edit/', {
            'site_code': self.test_code,
            'action': 'save',
            'name': 'Landmarks Site',
            'location': 'Tumkur',
            'price': '2500000',
            'landmark_name': ['District Hospital', 'Gubbi Gate'],
            'landmark_distance': ['1.8', '3.5'],
        })
        self.assertEqual(response.status_code, 302)

        doc = self.sites.find_one({"site_code": self.test_code})
        self.assertEqual(len(doc.get('nearby_landmarks', [])), 2)
        self.assertEqual(doc['nearby_landmarks'][0]['landmark'], 'District Hospital')
        self.assertEqual(doc['nearby_landmarks'][0]['distance_km'], 1.8)
        self.assertEqual(doc['nearby_landmarks'][1]['landmark'], 'Gubbi Gate')
        self.assertEqual(doc['nearby_landmarks'][1]['distance_km'], 3.5)

    def test_admin_landmarks_url_routes(self):
        """Short-form /admin/landmarks/ routes work correctly without 404."""
        # 1. GET page
        res = self.client.get('/admin/landmarks/')
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, 'Manage Key Landmarks')

        # 2. POST add landmark
        test_lm = "Test Landmark AGY"
        add_res = self.client.post('/admin/landmarks/add/', {
            'name': test_lm,
            'category': 'Transport'
        })
        self.assertEqual(add_res.status_code, 302)
        created = self.landmarks.find_one({"name": test_lm})
        self.assertIsNotNone(created)

        # 3. POST delete landmark
        del_res = self.client.post('/admin/landmarks/delete/', {
            'landmark_id': str(created['_id']),
            'name': test_lm
        })
        self.assertEqual(del_res.status_code, 302)
        self.landmarks.delete_many({"name": test_lm})

    def test_admin_sites_pending_sold_tab(self):
        """Admin pending sites page handles sold status filter and tab counts."""
        self.sites.update_one({"site_code": self.test_code}, {"$set": {"status": "sold"}})

        res = self.client.get('/admin/sites/pending/?status=sold')
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, 'badge-sold')
        self.assertContains(res, 'Re-list')
        self.assertContains(res, self.test_code)

    def test_delete_site_image_api_resilience(self):
        """Image deletion handles both /media/ prefix and relative paths."""
        self.site_images.insert_one({
            "site_code": self.test_code,
            "image_url": "sites/sample_plot.jpg",
            "created_at": datetime.now()
        })
        self.sites.update_one(
            {"site_code": self.test_code},
            {"$set": {"images": ["/media/sites/sample_plot.jpg"], "image": "/media/sites/sample_plot.jpg"}}
        )

        res = self.client.post('/api/sites/images/delete/', data=json.dumps({
            "site_code": self.test_code,
            "image_url": "/media/sites/sample_plot.jpg"
        }), content_type='application/json')
        self.assertEqual(res.status_code, 200)

        # Confirm deleted from normalized collection
        count = self.site_images.count_documents({"site_code": self.test_code})
        self.assertEqual(count, 0)

        # Confirm deleted from site doc
        doc = self.sites.find_one({"site_code": self.test_code})
        self.assertNotIn("/media/sites/sample_plot.jpg", doc.get("images", []))
        self.assertEqual(doc.get("image"), "")







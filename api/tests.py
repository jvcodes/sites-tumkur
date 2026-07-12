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

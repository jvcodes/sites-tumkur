import pytest
from rest_framework.test import APIClient
from unittest.mock import patch

@pytest.fixture
def client():
    return APIClient()

@pytest.fixture
def valid_booking_payload():
    return {
        "name": "Test User",
        "phone": "9876543210",
        "email": "test@example.com",
        "date": "2025-10-10",
        "time": "14:00",
        "sites": [
            {
                "site_code": "TEST1234",
                "name": "Test Plot",
                "location": "Tumkur",
                "price": 1000000
            }
        ]
    }

@patch('listings.mongo.booking_collection.insert_one')
@patch('listings.mongo.user_profiles_collection.update_one')
def test_create_booking_success(mock_update_profile, mock_insert, client, valid_booking_payload):
    response = client.post('/api/bookings/create', valid_booking_payload, format='json')
    assert response.status_code == 201
    assert "request submitted" in response.data['message']
    
    # Verify booking insertion was called
    mock_insert.assert_called_once()
    
    # Verify profile upsert was called
    mock_update_profile.assert_called_once()


def test_create_booking_missing_fields(client):
    payload = {
        "name": "Test User",
        # missing phone, date, etc.
    }
    response = client.post('/api/bookings/create', payload, format='json')
    assert response.status_code == 400
    assert "Missing booking details" in response.data['error']


@patch('listings.mongo.booking_collection.find')
@patch('listings.mongo.user_profiles_collection.find_one')
def test_my_bookings_api_success(mock_find_one, mock_find, client):
    # Mock return values for DB
    mock_find_one.return_value = {"phone": "9876543210"}
    
    # Mocking the cursor to return a list of items
    class MockCursor:
        def sort(self, *args, **kwargs):
            return [{"_id": "test_id", "status": "pending", "sites": []}]
            
    mock_find.return_value = MockCursor()

    response = client.get('/api/bookings/me?phone=9876543210')
    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]['status'] == 'pending'

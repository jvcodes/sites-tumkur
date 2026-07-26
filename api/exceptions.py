from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc, context):
    """
    Custom global exception handler for Django REST Framework.
    Standardizes error responses across the entire API.
    """
    # Call REST framework's default exception handler first,
    # to get the standard error response.
    response = exception_handler(exc, context)

    if response is not None:
        # Standardize the format: { "error": "code", "detail": "message" }
        error_code = "bad_request"
        
        if response.status_code == status.HTTP_404_NOT_FOUND:
            error_code = "not_found"
        elif response.status_code == status.HTTP_401_UNAUTHORIZED:
            error_code = "unauthorized"
        elif response.status_code == status.HTTP_403_FORBIDDEN:
            error_code = "forbidden"
        elif response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
            error_code = "validation_error"

        # Try to extract a clean string message if it's a dict or list
        detail = response.data
        if isinstance(detail, dict) and "detail" in detail:
            detail = detail["detail"]

        response.data = {
            "error": error_code,
            "detail": detail
        }
    
    return response

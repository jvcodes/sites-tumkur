from django.urls import path
from . import views, auth_views, wishlist_views, visits_views

urlpatterns = [
    path('sites/', views.approved_sites_api),                    # GET
    path('sites/filter/', views.filter_sites_api),               # GET
    path('sites/create/', views.create_site_api),                # POST
    path('sites/update-by-code/<str:site_code>/', views.update_site_by_code_api),  # PUT
    path('sites/delete-by-code/<str:site_code>/', views.delete_site_by_code_api),  # DELETE
    path('sites/my-sites/', views.my_sites_api),                 # GET My Sites
    
    path('sites/visits/', visits_views.visit_site_api),         # POST Visit Site
    path('sites/visits/me/', visits_views.my_visits_api),       # GET My Visits
    path('auth/profile/me/', auth_views.my_profile_api),        # GET My Profile
    
    path("bookings/create/", views.create_booking_api),
    path("bookings/me/", views.my_bookings_api),
    path("bookings/admin/", views.admin_bookings_api),
    path("admin/bookings/", views.admin_bookings_page),
    path("bookings/update/<str:booking_id>/", views.update_booking_status_api),
    path("sites/<str:site_code>/", views.site_detail_by_code_api),


    # Auth
    # Auth (Google)
    path("auth/google/", auth_views.google_auth_api),

    # Wishlist (MongoDB)
    path("wishlist/", wishlist_views.get_wishlist),
    path("wishlist/toggle/", wishlist_views.toggle_wishlist),

]


from django.urls import path, re_path
from . import auth_views, wishlist_views, visits_views, cart_views
from .views import sites as site_views
from .views import bookings as booking_views
from .views import locations as location_views
from .views import agents as agent_views

urlpatterns = [
    re_path(r'^sites/?$', site_views.approved_sites_api),
    re_path(r'^sites/filter/?$', site_views.filter_sites_api),
    re_path(r'^sites/locations/?$', location_views.get_locations_api),
    re_path(r'^sites/images/delete/?$', site_views.delete_site_image_api),
    re_path(r'^sites/create/?$', site_views.create_site_api),
    re_path(r'^sites/update-by-code/(?P<site_code>[^/]+)/?$', site_views.update_site_by_code_api),
    re_path(r'^sites/delete-by-code/(?P<site_code>[^/]+)/?$', site_views.delete_site_by_code_api),
    re_path(r'^sites/my-sites/?$', site_views.my_sites_api),
    re_path(r'^sites/draft/?$', site_views.save_draft_api),

    re_path(r'^sites/visits/?$', visits_views.visit_site_api),
    re_path(r'^sites/visits/me/?$', visits_views.my_visits_api),
    re_path(r'^auth/profile/me/?$', auth_views.my_profile_api),

    re_path(r'^bookings/create/?$', booking_views.create_booking_api),
    re_path(r'^bookings/me/?$', booking_views.my_bookings_api),
    re_path(r'^bookings/admin/?$', booking_views.admin_bookings_api),
    re_path(r'^admin/bookings/?$', booking_views.admin_bookings_page),
    re_path(r'^bookings/update/(?P<booking_id>[^/]+)/?$', booking_views.update_booking_status_api),
    re_path(r'^sites/(?P<site_code>[^/]+)/?$', site_views.site_detail_by_code_api),

    # -----------------------------------------------
    # 🔷 Admin Hub
    # -----------------------------------------------
    re_path(r'^admin/hub/?$', site_views.admin_hub_page),

    # Agent Management
    re_path(r'^admin/agents/?$', agent_views.admin_agents_page),
    re_path(r'^admin/agents/add/?$', agent_views.admin_add_agent),
    re_path(r'^admin/agents/toggle/?$', agent_views.admin_toggle_agent),

    # Site Management
    re_path(r'^admin/sites/pending/?$', site_views.admin_sites_pending_page),
    re_path(r'^admin/sites/review/(?P<site_code>[^/]+)/?$', site_views.admin_site_review_page),
    re_path(r'^admin/sites/approve/?$', site_views.admin_approve_site),
    re_path(r'^admin/sites/upload/?$', site_views.admin_upload_site_page),
    re_path(r'^admin/sites/edit/?$', site_views.admin_edit_site),
    re_path(r'^admin/bookings/update/(?P<booking_id>[^/]+)/?$', booking_views.admin_update_booking),
    re_path(r'^admin/bookings/check-conflict/?$', booking_views.admin_check_conflict_api),
    re_path(r'^admin/user-profile/?$', site_views.admin_user_profile),

    # -----------------------------------------------
    # 🔶 SiteHub Agent Portal
    # -----------------------------------------------
    re_path(r'^agent/portal/?$', agent_views.agent_portal_page),
    re_path(r'^agent/portal/login/?$', agent_views.agent_portal_login),
    re_path(r'^agent/portal/logout/?$', agent_views.agent_portal_logout),
    re_path(r'^agent/visits/?$', agent_views.agent_visits_page),
    re_path(r'^agent/visits/complete/?$', agent_views.agent_complete_visit),
    re_path(r'^agent/sites/?$', agent_views.agent_sites_page),
    re_path(r'^agent/sites/review/?$', agent_views.agent_review_site),

    # Auth
    re_path(r'^auth/google/?$', auth_views.google_auth_api),
    re_path(r'^auth/phone/?$', auth_views.phone_auth_api),
    re_path(r'^auth/update-phone/?$', auth_views.update_phone_api),
    re_path(r'^auth/update-profile/?$', auth_views.update_profile_api),

    # Wishlist (MongoDB)
    re_path(r'^wishlist/?$', wishlist_views.get_wishlist),
    re_path(r'^wishlist/toggle/?$', wishlist_views.toggle_wishlist),
    
    # Cart (MongoDB)
    re_path(r'^cart/?$', cart_views.get_cart),
    re_path(r'^cart/sync/?$', cart_views.sync_cart),
]

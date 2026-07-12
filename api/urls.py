from django.urls import path, re_path
from . import views, auth_views, wishlist_views, visits_views

urlpatterns = [
    re_path(r'^sites/?$', views.approved_sites_api),
    re_path(r'^sites/filter/?$', views.filter_sites_api),
    re_path(r'^sites/locations/?$', views.get_locations_api),
    re_path(r'^sites/images/delete/?$', views.delete_site_image_api),
    re_path(r'^sites/create/?$', views.create_site_api),
    re_path(r'^sites/update-by-code/(?P<site_code>[^/]+)/?$', views.update_site_by_code_api),
    re_path(r'^sites/delete-by-code/(?P<site_code>[^/]+)/?$', views.delete_site_by_code_api),
    re_path(r'^sites/my-sites/?$', views.my_sites_api),

    re_path(r'^sites/visits/?$', visits_views.visit_site_api),
    re_path(r'^sites/visits/me/?$', visits_views.my_visits_api),
    re_path(r'^auth/profile/me/?$', auth_views.my_profile_api),

    re_path(r'^bookings/create/?$', views.create_booking_api),
    re_path(r'^bookings/me/?$', views.my_bookings_api),
    re_path(r'^bookings/admin/?$', views.admin_bookings_api),
    re_path(r'^admin/bookings/?$', views.admin_bookings_page),
    re_path(r'^bookings/update/(?P<booking_id>[^/]+)/?$', views.update_booking_status_api),
    re_path(r'^sites/(?P<site_code>[^/]+)/?$', views.site_detail_by_code_api),

    # -----------------------------------------------
    # 🔷 Admin Hub
    # -----------------------------------------------
    re_path(r'^admin/hub/?$', views.admin_hub_page),

    # Agent Management
    re_path(r'^admin/agents/?$', views.admin_agents_page),
    re_path(r'^admin/agents/add/?$', views.admin_add_agent),
    re_path(r'^admin/agents/toggle/?$', views.admin_toggle_agent),

    # Site Management
    re_path(r'^admin/sites/pending/?$', views.admin_sites_pending_page),
    re_path(r'^admin/sites/review/(?P<site_code>[^/]+)/?$', views.admin_site_review_page),
    re_path(r'^admin/sites/approve/?$', views.admin_approve_site),
    re_path(r'^admin/sites/upload/?$', views.admin_upload_site_page),
    re_path(r'^admin/sites/edit/?$', views.admin_edit_site),
    re_path(r'^admin/bookings/update/(?P<booking_id>[^/]+)/?$', views.admin_update_booking),
    re_path(r'^admin/bookings/check-conflict/?$', views.admin_check_conflict_api),
    re_path(r'^admin/user-profile/?$', views.admin_user_profile),

    # -----------------------------------------------
    # 🔶 SiteHub Agent Portal
    # -----------------------------------------------
    re_path(r'^agent/portal/?$', views.agent_portal_page),
    re_path(r'^agent/portal/login/?$', views.agent_portal_login),
    re_path(r'^agent/portal/logout/?$', views.agent_portal_logout),
    re_path(r'^agent/visits/?$', views.agent_visits_page),
    re_path(r'^agent/visits/complete/?$', views.agent_complete_visit),
    re_path(r'^agent/sites/?$', views.agent_sites_page),
    re_path(r'^agent/sites/review/?$', views.agent_review_site),

    # Auth
    re_path(r'^auth/google/?$', auth_views.google_auth_api),
    re_path(r'^auth/phone/?$', auth_views.phone_auth_api),
    re_path(r'^auth/update-phone/?$', auth_views.update_phone_api),
    re_path(r'^auth/update-profile/?$', auth_views.update_profile_api),

    # Wishlist (MongoDB)
    re_path(r'^wishlist/?$', wishlist_views.get_wishlist),
    re_path(r'^wishlist/toggle/?$', wishlist_views.toggle_wishlist),
]

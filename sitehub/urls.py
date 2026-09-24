"""
URL configuration for sitehub project.
"""

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from api.views import sites as site_views
from api.views import agents as agent_views
from api.views import bookings as booking_views
from api.views import landmarks as landmark_views

urlpatterns = [
    path('api/', include('api.urls')),
    path('django-admin/', admin.site.urls),   # Django built-in admin (moved to avoid conflict)
    path('', include('listings.urls')),

    # -----------------------------------------------
    # Short-form Admin Hub URLs (without /api/ prefix)
    # -----------------------------------------------
    re_path(r'^admin/?$', site_views.admin_hub_page),
    re_path(r'^admin/hub/?$', site_views.admin_hub_page),
    path('admin/agents/', agent_views.admin_agents_page),
    path('admin/agents/add/', agent_views.admin_add_agent),
    path('admin/agents/toggle/', agent_views.admin_toggle_agent),
    path('admin/sites/pending/', site_views.admin_sites_pending_page),
    path('admin/sites/review/<str:site_code>/', site_views.admin_site_review_page),
    path('admin/sites/approve/', site_views.admin_approve_site),
    path('admin/sites/upload/', site_views.admin_upload_site_page),
    path('admin/sites/edit/', site_views.admin_edit_site),
    path('admin/bookings/', booking_views.admin_bookings_page),
    path('admin/bookings/update/<str:booking_id>/', booking_views.admin_update_booking),
    path('admin/bookings/check-conflict/', booking_views.admin_check_conflict_api),
    path('admin/user-profile/', site_views.admin_user_profile),
    path('admin/landmarks/', landmark_views.admin_landmarks_page),
    path('admin/landmarks/add/', landmark_views.admin_add_landmark),
    path('admin/landmarks/delete/', landmark_views.admin_delete_landmark),
    path('bookings/update/<str:booking_id>/', booking_views.update_booking_status_api),

    # -----------------------------------------------
    # Short-form Agent Portal URLs (without /api/ prefix)
    # -----------------------------------------------
    path('agent/portal/', agent_views.agent_portal_page),
    path('agent/portal/login/', agent_views.agent_portal_login),
    path('agent/portal/logout/', agent_views.agent_portal_logout),
    path('agent/visits/', agent_views.agent_visits_page),
    path('agent/visits/complete/', agent_views.agent_complete_visit),
    path('agent/sites/', agent_views.agent_sites_page),
    path('agent/sites/review/', agent_views.agent_review_site),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

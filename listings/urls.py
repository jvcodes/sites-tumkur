from django.urls import path
from django.views.generic import RedirectView
from . import views

urlpatterns = [
    # Root → redirect to Admin Hub (Django backend is admin-only)
    path('', RedirectView.as_view(url='/admin/hub/', permanent=False), name='root'),

    # Create & Update
    path('upload/', views.upload_site, name='upload_site'),
    path('edit/<str:site_id>/', views.upload_site, name='edit_site'),

    # Admin (legacy /dashboard removed, now handled in sitehub/urls.py -> admin/hub)

    # View on Map
    path('map/<str:site_id>/', views.view_on_map, name='view_on_map'),

    path('site/<str:site_id>/', views.site_detail, name='site_detail'),
    path('chat/', views.chat, name='chat'),






]

from django.urls import path
from . import views

urlpatterns = [
    # Public
    path('', views.site_list, name='site_list'),

    # Create & Update
    path('upload/', views.upload_site, name='upload_site'),
    path('edit/<str:site_id>/', views.upload_site, name='edit_site'),

    # Admin
    path('admin/', views.admin_dashboard, name='admin_dashboard'),
    path('approve/<str:site_id>/', views.approve_site, name='approve_site'),
    path('reject/<str:site_id>/', views.reject_site, name='reject_site'),
    path('rejected/', views.rejected_sites, name='rejected_sites'),

    # View on Map
    path('map/<str:site_id>/', views.view_on_map, name='view_on_map'),

    path('site/<str:site_id>/', views.site_detail, name='site_detail'),
    path('chat/', views.chat, name='chat'),
    path('admin/edit/<str:site_id>/', views.edit_site, name='edit_site'),
    path('admin/approved/', views.approved_sites_admin, name='approved_sites_admin'),






]

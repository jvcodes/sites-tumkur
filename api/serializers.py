from rest_framework import serializers

class SiteSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    site_code = serializers.CharField(read_only=True)
    name = serializers.CharField()
    location = serializers.CharField()

    # ✅ FIX: make area optional + safe
    area = serializers.FloatField(
        required=False,
        allow_null=True,
        default=0
    )

    price = serializers.FloatField()
    owner = serializers.CharField()
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True
    )

    image = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True
    )
    
    user_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    dimension = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    facing = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    road_width = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    landmark = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    
    corner_site = serializers.BooleanField(default=False)
    boundary_marked = serializers.BooleanField(default=False)
    levelled_land = serializers.BooleanField(default=False)
    negotiable = serializers.BooleanField(default=False)
    loan_facility = serializers.BooleanField(default=False)
    
    bbmp_approved = serializers.BooleanField(default=False)
    a_khata = serializers.BooleanField(default=False)
    clear_title = serializers.BooleanField(default=False)
    bank_loan_approved = serializers.BooleanField(default=False)
    layout_approved = serializers.BooleanField(default=False)
    
    borewell_water = serializers.BooleanField(default=False)
    electricity_nearby = serializers.BooleanField(default=False)
    drainage_connection = serializers.BooleanField(default=False)
    asphalt_road_access = serializers.BooleanField(default=False)
    
    images = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_null=True
    )

    youtube_url = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True
    )

    status = serializers.CharField(read_only=True)
    
    # Optional visit tracking fields
    visit_date = serializers.DateTimeField(required=False, allow_null=True)
    visit_status = serializers.CharField(required=False, allow_null=True)

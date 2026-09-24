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
    tuda_approved = serializers.BooleanField(default=False, required=False)
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

    nearby_landmarks = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        allow_null=True
    )

    is_test = serializers.BooleanField(default=False, required=False)
    status = serializers.CharField(read_only=True)
    
    # Coordinates & Seller Info
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)
    uploaded_phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    ownership_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    availability = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    zoning_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    category = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    distance_to_main_road = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    # Optional visit tracking fields
    visit_date = serializers.DateTimeField(required=False, allow_null=True)
    visit_status = serializers.CharField(required=False, allow_null=True)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Bidirectional fallback between tuda_approved and bbmp_approved
        tuda_val = instance.get("tuda_approved") if isinstance(instance, dict) else getattr(instance, "tuda_approved", None)
        bbmp_val = instance.get("bbmp_approved") if isinstance(instance, dict) else getattr(instance, "bbmp_approved", None)
        
        effective_approved = bool(tuda_val if tuda_val is not None else bbmp_val)
        ret["tuda_approved"] = effective_approved
        ret["bbmp_approved"] = effective_approved
        return ret

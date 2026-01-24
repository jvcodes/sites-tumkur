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

    image = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True
    )

    status = serializers.CharField(read_only=True)

from django.db import models

# Create your models here.
class Site(models.Model):
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=200)
    area = models.FloatField()
    price = models.DecimalField(max_digits=12, decimal_places=2)
    owner = models.CharField(max_length=100)
    latitude = models.FloatField()
    longitude = models.FloatField()

    image = models.ImageField(upload_to='site_images/')
    is_approved = models.BooleanField(default=False)

    def __str__(self):
        return self.name

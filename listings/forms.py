# from django import forms


# class MultipleFileInput(forms.ClearableFileInput):
#     allow_multiple_selected = True


# class SiteForm(forms.Form):

#     # ---------- BASIC ----------
#     name = forms.CharField()
#     location = forms.CharField()
#     area = forms.CharField()
#     price = forms.FloatField()
#     owner = forms.CharField()

#     # ---------- FILTER FIELDS ----------
#     plot_size = forms.IntegerField(required=False)
#     road_width = forms.IntegerField(required=False)
#     landmark = forms.CharField(required=False)
#     distance_to_main_road = forms.IntegerField(required=False)

#     facing = forms.ChoiceField(
#         choices=[('east','East'),('west','West'),('north','North'),('south','South')],
#         required=False
#     )

#     ownership_type = forms.ChoiceField(
#         choices=[('individual','Individual'),('developer','Developer'),('broker','Broker')],
#         required=False
#     )

#     availability = forms.ChoiceField(
#         choices=[('available','Available'),('sold','Sold')],
#         required=False
#     )

#     zoning_type = forms.ChoiceField(
#         choices=[('residential','Residential'),('commercial','Commercial'),('agricultural','Agricultural')],
#         required=False
#     )

#     latitude = forms.FloatField(required=False)
#     longitude = forms.FloatField(required=False)

#     # ---------- MULTIPLE IMAGES ----------
#     images = forms.FileField(
#         widget=MultipleFileInput(),
#         required=False
#     )
from django import forms


class SiteForm(forms.Form):

    # -------- BASIC FIELDS --------
    name = forms.CharField()
    location = forms.CharField()
    area = forms.FloatField()
    price = forms.FloatField()
    owner = forms.CharField()

    # -------- PROPERTY DETAILS --------
    plot_size = forms.IntegerField(required=False)
    road_width = forms.IntegerField(required=False)
    landmark = forms.CharField(required=False)
    distance_to_main_road = forms.IntegerField(required=False)

    facing = forms.ChoiceField(
        choices=[
            ('east', 'East'),
            ('west', 'West'),
            ('north', 'North'),
            ('south', 'South')
        ],
        required=False
    )

    ownership_type = forms.ChoiceField(
        choices=[
            ('individual', 'Individual'),
            ('developer', 'Developer'),
            ('broker', 'Broker')
        ],
        required=False
    )

    availability = forms.ChoiceField(
        choices=[
            ('available', 'Available'),
            ('sold', 'Sold')
        ],
        required=False
    )

    zoning_type = forms.ChoiceField(
        choices=[
            ('residential', 'Residential'),
            ('commercial', 'Commercial'),
            ('agricultural', 'Agricultural')
        ],
        required=False
    )

    latitude = forms.FloatField(required=False)
    longitude = forms.FloatField(required=False)

    # ✅ SINGLE IMAGE ONLY
    image = forms.ImageField(required=False)


from django.urls import path
from . import views

urlpatterns = [
    path("repair/", views.repair, name="repair_code"),
]
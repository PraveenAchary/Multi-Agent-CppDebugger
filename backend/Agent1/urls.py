from django.urls import  path 

from .views import analyze_code,get_history

urlpatterns = [
    path('analyze/',analyze_code,name='analyze_code'),
    path('history/',get_history,name='get_history'),
]

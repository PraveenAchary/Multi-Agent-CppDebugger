from django.db import models

# Create your models here.
class Submission(models.Model):
    session_key = models.CharField(max_length=40)
    code = models.TextField()
    compiles = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
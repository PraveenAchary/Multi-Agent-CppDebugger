from django.db import models

class Submission(models.Model):
    session_key = models.CharField(max_length=40)
    code = models.TextField()
    corrected_code = models.TextField(blank=True, null=True)  # Stores the fixed code with inline comments
    compiles = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ["-created_at"]
